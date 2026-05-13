"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Pencil, Save, X, Loader2, TrendingUp } from "lucide-react"
import { formatCurrency } from "@/utils/formatters"
import { toast } from "sonner"

interface LeadTrackingFormProps {
  projectId: string
  totalCost: number
  leadsGenerated: number | null
  leadsConverted: number | null
  canEdit: boolean
  onSuccess?: () => void
}

export function LeadTrackingForm({
  projectId, totalCost, leadsGenerated, leadsConverted, canEdit, onSuccess
}: LeadTrackingFormProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [gen, setGen] = useState(leadsGenerated?.toString() || "")
  const [conv, setConv] = useState(leadsConverted?.toString() || "")

  const leadsGen = parseInt(gen) || 0
  const leadsConv = parseInt(conv) || 0
  const convRate = leadsGen > 0 ? ((leadsConv / leadsGen) * 100).toFixed(1) : null
  const cpl = leadsGen > 0 ? totalCost / leadsGen : null
  const cpa = leadsConv > 0 ? totalCost / leadsConv : null

  const handleSave = async () => {
    if (leadsConv > leadsGen && leadsGen > 0) {
      toast.error("Converted leads cannot exceed generated leads")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/leads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadsGenerated: leadsGen || null,
          leadsConverted: leadsConv || null,
        }),
      })
      if (res.ok) {
        toast.success("Lead data saved!")
        setEditing(false)
        onSuccess?.()
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to save")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setGen(leadsGenerated?.toString() || "")
    setConv(leadsConverted?.toString() || "")
    setEditing(false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Lead Tracking & ROI
          </CardTitle>
          <p className="text-sm text-slate-500 mt-0.5">
            Enter campaign results after the event runs
          </p>
        </div>
        {canEdit && !editing && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            {leadsGenerated ? "Update" : "Add Data"}
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" className="bg-[#003c71] hover:bg-[#002a52] gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Leads Generated</Label>
                <Input
                  type="number" min="0"
                  value={gen}
                  onChange={(e) => setGen(e.target.value)}
                  placeholder="e.g. 150"
                />
                <p className="text-xs text-slate-400">Total enquiries/footfall from this campaign</p>
              </div>
              <div className="space-y-1.5">
                <Label>Leads Converted</Label>
                <Input
                  type="number" min="0"
                  value={conv}
                  onChange={(e) => setConv(e.target.value)}
                  placeholder="e.g. 12"
                />
                <p className="text-xs text-slate-400">Leads that became actual customers</p>
              </div>
            </div>
            {leadsGen > 0 && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-blue-50 rounded-xl text-center">
                  <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Conversion Rate</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">{convRate ?? "—"}%</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl text-center">
                  <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Cost Per Lead</p>
                  <p className="text-xl font-bold text-amber-700 mt-1">{cpl ? formatCurrency(cpl) : "—"}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl text-center">
                  <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Cost Per Acquisition</p>
                  <p className="text-xl font-bold text-green-700 mt-1">{cpa ? formatCurrency(cpa) : "—"}</p>
                </div>
              </div>
            )}
          </div>
        ) : leadsGenerated ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl text-center">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Leads Generated</p>
                <p className="text-2xl font-extrabold text-blue-900">{leadsGenerated.toLocaleString("en-IN")}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl text-center">
                <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-1">Leads Converted</p>
                <p className="text-2xl font-extrabold text-green-900">{leadsConverted?.toLocaleString("en-IN") ?? "—"}</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl text-center">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-1">Cost Per Lead</p>
                <p className="text-2xl font-extrabold text-amber-900">{formatCurrency(totalCost / leadsGenerated)}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl text-center">
                <p className="text-xs font-bold text-purple-600 uppercase tracking-wide mb-1">Cost Per Acquisition</p>
                <p className="text-2xl font-extrabold text-purple-900">
                  {leadsConverted ? formatCurrency(totalCost / leadsConverted) : "—"}
                </p>
              </div>
            </div>
            {leadsConverted && (
              <div className="p-3 bg-slate-50 rounded-lg text-center">
                <span className="text-sm text-slate-600">Conversion Rate: </span>
                <span className="font-bold text-slate-900">
                  {((leadsConverted / leadsGenerated) * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400">
            <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No lead data yet</p>
            <p className="text-xs mt-1">Add campaign results after the event runs to track ROI</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
