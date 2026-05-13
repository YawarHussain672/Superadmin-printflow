"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, ArrowLeft, Save, Loader2, AlertCircle } from "lucide-react"
import { formatCurrency, applyGST, getGSTAmount } from "@/utils/formatters"
import { toast } from "sonner"
import Link from "next/link"
import { getUnitPriceFromSlabs, type VolumeSlab } from "@/lib/rate-card-pricing"

interface CollateralItem { id: string; itemName: string; quantity: number; unitPrice: number; totalPrice: number }
interface POC { id: string; name: string }
interface RateCardItem { id: string; name: string; defaultPrice: number; volumeSlabs: VolumeSlab[] }
interface Location { location: string; state: string }

export default function EditProjectPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [pocs, setPocs] = useState<POC[]>([])
  const [rateCards, setRateCards] = useState<RateCardItem[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({ name: "", pocId: "", location: "", deliveryDate: "", instructions: "" })
  const [collaterals, setCollaterals] = useState<CollateralItem[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [projRes, teamRes, rateRes] = await Promise.all([
          fetch(`/api/projects/${id}`),
          fetch("/api/team-list"),
          fetch("/api/rate-card-list"),
        ])

        if (!projRes.ok) { toast.error("Project not found"); router.push("/projects"); return }

        const [project, team, rates] = await Promise.all([projRes.json(), teamRes.json(), rateRes.json()])

        setPocs(team.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })))
        setRateCards(rates)

        // Build locations from project data + defaults
        const defaultLocations: Location[] = [
          { location: "Mumbai", state: "Maharashtra" }, { location: "Delhi", state: "Delhi" },
          { location: "Bangalore", state: "Karnataka" }, { location: "Chennai", state: "Tamil Nadu" },
          { location: "Pune", state: "Maharashtra" }, { location: "Hyderabad", state: "Telangana" },
          { location: "Kolkata", state: "West Bengal" }, { location: "Gurgaon", state: "Haryana" },
          { location: "Noida", state: "Uttar Pradesh" }, { location: "Ahmedabad", state: "Gujarat" },
          { location: "Jaipur", state: "Rajasthan" }, { location: "Lucknow", state: "Uttar Pradesh" },
        ]
        setLocations(defaultLocations)

        setFormData({
          name: project.name || "",
          pocId: project.pocId || "",
          location: project.location || "",
          deliveryDate: project.deliveryDate ? project.deliveryDate.split("T")[0] : "",
          instructions: project.instructions || "",
        })
        setCollaterals((project.collaterals || []).map((c: CollateralItem) => ({ ...c })))
      } catch {
        toast.error("Failed to load project data")
      } finally {
        setIsFetching(false)
      }
    }
    load()
  }, [id, router])

  const today = new Date().toISOString().split("T")[0]

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!formData.name.trim() || formData.name.trim().length < 3) errs.name = "Project name must be at least 3 characters"
    if (!formData.pocId) errs.pocId = "Please select a POC"
    if (!formData.location) errs.location = "Please select a location"
    if (!formData.deliveryDate) errs.deliveryDate = "Delivery date is required"
    const validCollaterals = collaterals.filter((c) => c.itemName && c.quantity > 0)
    if (validCollaterals.length === 0) errs.collaterals = "Add at least one collateral"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const addCollateral = () => {
    setCollaterals([...collaterals, { id: Math.random().toString(36).substr(2, 9), itemName: "", quantity: 0, unitPrice: 0, totalPrice: 0 }])
  }

  const removeCollateral = (cid: string) => {
    if (collaterals.length > 1) setCollaterals(collaterals.filter((c) => c.id !== cid))
  }

  const updateCollateral = (cid: string, field: keyof CollateralItem, value: string | number) => {
    setCollaterals(collaterals.map((c) => {
      if (c.id !== cid) return c
      const updated = { ...c, [field]: value }
      if (field === "itemName") {
        const item = rateCards.find((i) => i.name === value)
        if (item) updated.unitPrice = getUnitPriceFromSlabs(item.volumeSlabs, updated.quantity || 1) ?? item.defaultPrice
      }
      if (field === "quantity") {
        const item = rateCards.find((i) => i.name === updated.itemName)
        if (item) updated.unitPrice = getUnitPriceFromSlabs(item.volumeSlabs, Number(value)) ?? item.defaultPrice
      }
      updated.totalPrice = updated.quantity * updated.unitPrice
      return updated
    }))
  }

  const selectedLocation = locations.find((l) => l.location === formData.location)
  const subtotal = collaterals.reduce((sum, c) => sum + c.totalPrice, 0)
  const gstAmount = getGSTAmount(subtotal)
  const totalCost = applyGST(subtotal)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) { toast.error("Please fix the errors before saving"); return }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          state: selectedLocation?.state || "",
          collaterals: collaterals.filter((c) => c.itemName && c.quantity > 0),
          totalCost: subtotal, // API applies GST
        }),
      })
      if (res.ok) {
        toast.success("Project updated successfully!")
        router.push(`/projects/${id}`)
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update project")
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#003c71] mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Loading project...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/projects/${id}`}>
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Project</h1>
          <p className="text-slate-500 text-sm mt-0.5">Update project details and collaterals</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card>
          <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label>Project Name <span className="text-red-500">*</span></Label>
              <Input value={formData.name} onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors({ ...errors, name: "" }) }}
                className={errors.name ? "border-red-400" : ""} />
              {errors.name && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>POC <span className="text-red-500">*</span></Label>
              <Select value={formData.pocId} onValueChange={(v) => { setFormData({ ...formData, pocId: v }); setErrors({ ...errors, pocId: "" }) }}>
                <SelectTrigger className={errors.pocId ? "border-red-400" : ""}><SelectValue placeholder="Select POC" /></SelectTrigger>
                <SelectContent>{pocs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              {errors.pocId && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.pocId}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Location <span className="text-red-500">*</span></Label>
              <Select value={formData.location} onValueChange={(v) => { setFormData({ ...formData, location: v }); setErrors({ ...errors, location: "" }) }}>
                <SelectTrigger className={errors.location ? "border-red-400" : ""}><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.location} value={l.location}>{l.location}, {l.state}</SelectItem>)}</SelectContent>
              </Select>
              {errors.location && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.location}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Delivery Date <span className="text-red-500">*</span></Label>
              <Input type="date" min={today} value={formData.deliveryDate}
                onChange={(e) => { setFormData({ ...formData, deliveryDate: e.target.value }); setErrors({ ...errors, deliveryDate: "" }) }}
                className={errors.deliveryDate ? "border-red-400" : ""} />
              {errors.deliveryDate && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.deliveryDate}</p>}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label>Special Instructions <span className="text-slate-400 font-normal">(optional)</span></Label>
              <Textarea value={formData.instructions} onChange={(e) => setFormData({ ...formData, instructions: e.target.value })} rows={3} maxLength={1000} />
              <p className="text-xs text-slate-400 text-right">{formData.instructions.length}/1000</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Collaterals</CardTitle>
            <Button type="button" onClick={addCollateral} variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {errors.collaterals && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />{errors.collaterals}
              </div>
            )}
            {collaterals.map((c) => (
              <div key={c.id} className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 border border-slate-200 rounded-xl bg-slate-50/50">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Item</Label>
                  <Select value={c.itemName} onValueChange={(v) => updateCollateral(c.id, "itemName", v)}>
                    <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{rateCards.map((i) => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Quantity</Label>
                  <Input type="number" min="1" value={c.quantity || ""} onChange={(e) => updateCollateral(c.id, "quantity", parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Unit Price (₹)</Label>
                  <Input type="number" step="0.01" min="0.01" value={c.unitPrice || ""} onChange={(e) => updateCollateral(c.id, "unitPrice", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs">Subtotal</Label>
                    <Input value={formatCurrency(c.totalPrice)} disabled className="bg-white font-mono text-sm" />
                  </div>
                  {collaterals.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:bg-red-50 shrink-0" onClick={() => removeCollateral(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50">
                <span className="text-sm text-slate-600">Subtotal</span>
                <span className="font-mono font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50">
                <span className="text-sm text-slate-600">GST @ 18%</span>
                <span className="font-mono font-semibold text-amber-600">+ {formatCurrency(gstAmount)}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-4 bg-[#003c71] text-white">
                <div>
                  <p className="font-bold text-base">Total Amount</p>
                  <p className="text-blue-200 text-xs">Inclusive of 18% GST</p>
                </div>
                <span className="text-2xl font-extrabold font-mono">{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pb-8">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>Cancel</Button>
          <Button type="submit" className="gap-2 bg-[#003c71] hover:bg-[#002a52] min-w-[140px]" disabled={isLoading}>
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving...</> : <><Save className="h-4 w-4" />Save Changes</>}
          </Button>
        </div>
      </form>
    </div>
  )
}
