"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { formatCurrency, applyGST, getGSTAmount } from "@/utils/formatters"
import { toast } from "sonner"
import { BRANCH_LOCATIONS, CITIES } from "@/lib/branch-locations"
import { getUnitPriceFromSlabs, type VolumeSlab } from "@/lib/rate-card-pricing"

// SVG Icons
const PlusIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
)

const TrashIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const AlertIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const LoaderIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="animate-spin">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

// Currency display with same size symbol and amount
const Currency = ({ amount, size = 'inherit', color }: { amount: number, size?: string, color?: string }) => (
  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: size, color: color || 'inherit' }}>
    ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  </span>
)

interface CollateralItem {
  id: string
  itemName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  gstRate?: number
  specification?: string
}
interface POC { id: string; name: string; email: string; role?: string; phone?: string; location?: string; branch?: string }
interface RateCardItem { id: string; name: string; defaultPrice: number; volumeSlabs: VolumeSlab[]; gstRate?: number }

interface NewProjectFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function NewProjectForm({ onSuccess, onCancel }: NewProjectFormProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pocs, setPocs] = useState<POC[]>([])
  const [rateCards, setRateCards] = useState<RateCardItem[]>([])
  const [formData, setFormData] = useState({
    name: "", pocId: "", clientId: "", city: "", branch: "", deliveryDate: "", instructions: "", packingCharges: "", packingChargesGstRate: "18",
    deliveryCharges: "", deliveryChargesGstRate: "18",
    recipientName: "", recipientContact: "", recipientBranch: "", sameAsPoc: false,
  })
  const [showPackingForm, setShowPackingForm] = useState(false)
  const [showDeliveryForm, setShowDeliveryForm] = useState(false)

  const [cities, setCities] = useState<string[]>(CITIES)
  const [branchLocations, setBranchLocations] = useState<Record<string, { state: string; branches: string[] }>>(BRANCH_LOCATIONS)

  // Dynamically merge custom locations and branches from the POCs list
  useEffect(() => {
    if (pocs.length > 0) {
      const mergedLocations = {} as Record<string, { state: string; branches: string[] }>
      Object.keys(BRANCH_LOCATIONS).forEach((key) => {
        mergedLocations[key] = {
          state: BRANCH_LOCATIONS[key].state,
          branches: [...BRANCH_LOCATIONS[key].branches]
        }
      })
      pocs.forEach((p) => {
        if (p.role === "POC" && p.location) {
          const city = p.location.trim()
          if (city) {
            const existingCity = Object.keys(mergedLocations).find(
              (c) => c.toLowerCase() === city.toLowerCase()
            )
            const targetCity = existingCity || city
            if (!mergedLocations[targetCity]) {
              mergedLocations[targetCity] = { state: "", branches: [] }
            }
            if (p.branch) {
              const branchName = p.branch.trim()
              if (branchName) {
                const existingBranch = mergedLocations[targetCity].branches.find(
                  (b) => b.toLowerCase() === branchName.toLowerCase()
                )
                if (!existingBranch) {
                  mergedLocations[targetCity].branches.push(branchName)
                }
              }
            }
          }
        }
      })
      setBranchLocations(mergedLocations)
      setCities(Object.keys(mergedLocations).sort())
    }
  }, [pocs])

  const [collaterals, setCollaterals] = useState<CollateralItem[]>([
    { id: "1", itemName: "", quantity: 0, unitPrice: 0, totalPrice: 0, gstRate: 18, specification: "" },
  ])

  // Auto-set POC and their location/branch if user is a POC
  const isPoc = session?.user?.role === "POC"
  useEffect(() => {
    if (isPoc && session?.user?.id) {
      setFormData((prev) => {
        const updated = { ...prev, pocId: session.user.id }
        if (pocs.length > 0 && !prev.city) {
          const selectedPoc = pocs.find(p => p.id === session.user.id)
          if (selectedPoc) {
            let matchedCity = prev.city
            let matchedBranch = prev.branch

            if (selectedPoc.location) {
              const cleanedLoc = selectedPoc.location.trim()
              const foundCity = Object.keys(branchLocations).find(
                c => c.toLowerCase() === cleanedLoc.toLowerCase()
              )
              matchedCity = foundCity || cleanedLoc
            }
            if (selectedPoc.branch) {
              const cleanedBranch = selectedPoc.branch.trim()
              const branches = branchLocations[matchedCity]?.branches || []
              const foundBranch = branches.find(
                b => b.toLowerCase() === cleanedBranch.toLowerCase()
              )
              matchedBranch = foundBranch || cleanedBranch
            }
            updated.city = matchedCity
            updated.branch = matchedBranch
          }
        }
        return updated
      })
    }
  }, [isPoc, session?.user?.id, pocs, branchLocations])

  const today = new Date().toISOString().split("T")[0]

  // Fetch form data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/projects/form-data")
        if (res.ok) {
          const data = await res.json()
          setPocs(data.pocs)
          setRateCards(data.rateCards)
        }
      } catch {
        toast.error("Failed to load form data")
      } finally {
        setIsFetching(false)
      }
    }
    fetchData()
  }, [])

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!formData.name.trim() || formData.name.trim().length < 3) errs.name = "Project name must be at least 3 characters"
    if (!formData.pocId) errs.pocId = "POC is required"
    if (!formData.city) errs.city = "Please select a city"
    if (!formData.branch) errs.branch = "Please select a branch"
    if (!formData.deliveryDate) errs.deliveryDate = "Delivery date is required"
    else if (new Date(formData.deliveryDate) <= new Date()) errs.deliveryDate = "Delivery date must be in the future"
    const validCollaterals = collaterals.filter((c) => c.itemName && c.quantity > 0)
    if (validCollaterals.length === 0) errs.collaterals = "Add at least one collateral with quantity"
    collaterals.forEach((c, i) => {
      if (c.itemName && c.quantity <= 0) errs[`qty_${i}`] = "Quantity must be greater than 0"
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const addCollateral = () => {
    setCollaterals([...collaterals, { id: Math.random().toString(36).substr(2, 9), itemName: "", quantity: 0, unitPrice: 0, totalPrice: 0, gstRate: 18, specification: "" }])
  }

  const removeCollateral = (id: string) => {
    if (collaterals.length > 1) setCollaterals(collaterals.filter((c) => c.id !== id))
  }

  const isAdmin = session?.user?.role === "ADMIN"

  const updateCollateral = (id: string, field: keyof CollateralItem, value: string | number) => {
    setCollaterals(collaterals.map((c) => {
      if (c.id !== id) return c
      const updated = { ...c, [field]: value }
      if (field === "itemName") {
        const item = rateCards.find((i) => i.name === value)
        console.log("[DEBUG] Selected item:", item?.name, "Slabs:", item?.volumeSlabs, "GST:", item?.gstRate)
        if (item) {
          const price = getUnitPriceFromSlabs(item.volumeSlabs, updated.quantity || 1)
          console.log("[DEBUG] Calculated price:", price, "for qty:", updated.quantity || 1)
          updated.unitPrice = price ?? item.defaultPrice
          // Store the GST rate from the rate card item (default to 18 if not set)
          updated.gstRate = item.gstRate ?? 18
        }
      }
      if (field === "quantity") {
        const item = rateCards.find((i) => i.name === updated.itemName)
        console.log("[DEBUG] Quantity changed to:", value, "Item:", item?.name, "Slabs:", item?.volumeSlabs)
        if (item) {
          const price = getUnitPriceFromSlabs(item.volumeSlabs, Number(value))
          console.log("[DEBUG] Calculated price:", price, "for qty:", value)
          // If unit price was not manually overridden (or when changing quantity), update from slabs
          updated.unitPrice = price ?? item.defaultPrice
        }
      }
      if (field === "unitPrice") {
        updated.unitPrice = typeof value === "number" ? value : (parseFloat(value) || 0)
      }
      updated.totalPrice = updated.quantity * updated.unitPrice
      return updated
    }))
  }

  const cityData = formData.city ? branchLocations[formData.city] : null

  // Calculate totals using individual GST rates per collateral item
  const subtotal = collaterals.reduce((sum, c) => sum + c.totalPrice, 0)
  const collateralsGst = collaterals.reduce((sum, c) => sum + (c.totalPrice * (c.gstRate ?? 18) / 100), 0)

  // Packing charges with custom GST rate
  const packingCharges = parseFloat(formData.packingCharges) || 0
  const parsedPackingChargesGstRate = parseFloat(formData.packingChargesGstRate)
  const packingChargesGstRate = isNaN(parsedPackingChargesGstRate) ? 18 : parsedPackingChargesGstRate
  const packingChargesGst = packingCharges * (packingChargesGstRate / 100)

  // Delivery charges with custom GST rate
  const deliveryCharges = parseFloat(formData.deliveryCharges) || 0
  const parsedDeliveryChargesGstRate = parseFloat(formData.deliveryChargesGstRate)
  const deliveryChargesGstRate = isNaN(parsedDeliveryChargesGstRate) ? 18 : parsedDeliveryChargesGstRate
  const deliveryChargesGst = deliveryCharges * (deliveryChargesGstRate / 100)

  // Total GST and final cost
  const gstAmount = collateralsGst + packingChargesGst + deliveryChargesGst
  const totalCost = subtotal + packingCharges + deliveryCharges + gstAmount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      // Scroll to first error
      const firstError = document.querySelector('[class*="border-red-400"]')
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          pocId: formData.pocId || undefined,
          clientId: formData.clientId || undefined,
          location: formData.city,
          branch: formData.branch,
          state: cityData?.state || "",
          deliveryDate: formData.deliveryDate,
          instructions: formData.instructions,
          packingCharges: packingCharges,
          packingChargesGstRate: packingChargesGstRate,
          deliveryCharges: deliveryCharges,
          deliveryChargesGstRate: deliveryChargesGstRate,
          recipientName: formData.recipientName || undefined,
          recipientContact: formData.recipientContact || undefined,
          recipientBranch: formData.recipientBranch || undefined,
          collaterals: collaterals.filter((c) => c.itemName && c.quantity > 0).map(c => ({
            itemName: c.itemName,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
            totalPrice: c.totalPrice,
            specification: c.specification || "",
          })),
          totalCost: totalCost,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Project created successfully!")
        if (onSuccess) {
          onSuccess()
        } else {
          router.push(`/projects/${data.id}`)
          router.refresh()
        }
      } else {
        toast.error(data.error || "Failed to create project")
        if (data.details?.fieldErrors) {
          const fieldErrs: Record<string, string> = {}
          Object.entries(data.details.fieldErrors).forEach(([k, v]) => { fieldErrs[k] = (v as string[])[0] })
          setErrors(fieldErrs)
        }
      }
    } catch {
      toast.error("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate>
        {/* Project Details Card */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ padding: '24px' }}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Project Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input
                  type="text"
                  className={`form-input ${errors.name ? 'border-red-400' : ''}`}
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, name: e.target.value }); setErrors({ ...errors, name: "" }) }}
                  placeholder="Enter project name"
                />
                {errors.name && <p style={{ fontSize: '13px', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><AlertIcon /> {errors.name}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">POC <span style={{ color: 'var(--color-error)' }}>*</span></label>
                {isPoc ? (
                  <>
                    <div className="form-input" style={{ background: 'var(--gray-100)', display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500 }}>{session?.user?.name || 'You'}</span>
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--gray-500)', background: 'var(--gray-200)', padding: '2px 8px', borderRadius: '4px' }}>POC</span>
                    </div>
                    {errors.pocId && <p style={{ fontSize: '13px', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><AlertIcon /> {errors.pocId}</p>}
                  </>
                ) : (
                  <>
                    <select
                      className={`form-select ${errors.pocId ? 'border-red-400' : ''}`}
                      value={formData.pocId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        const newPocId = e.target.value
                        const selectedPoc = pocs.find(p => p.id === newPocId)
                        let matchedCity = formData.city
                        let matchedBranch = formData.branch

                        if (selectedPoc) {
                          if (selectedPoc.location) {
                            const cleanedLoc = selectedPoc.location.trim()
                            const foundCity = Object.keys(branchLocations).find(
                              c => c.toLowerCase() === cleanedLoc.toLowerCase()
                            )
                            matchedCity = foundCity || cleanedLoc
                          }
                          if (selectedPoc.branch) {
                            const cleanedBranch = selectedPoc.branch.trim()
                            const branches = branchLocations[matchedCity]?.branches || []
                            const foundBranch = branches.find(
                              b => b.toLowerCase() === cleanedBranch.toLowerCase()
                            )
                            matchedBranch = foundBranch || cleanedBranch
                          }
                        }

                        setFormData(prev => {
                          const updated = {
                            ...prev,
                            pocId: newPocId,
                            city: matchedCity,
                            branch: matchedBranch,
                          }
                          if (prev.sameAsPoc && selectedPoc) {
                            const bText = selectedPoc.branch || matchedBranch || ""
                            const lText = selectedPoc.location || matchedCity || ""
                            updated.recipientName = selectedPoc.name
                            updated.recipientContact = selectedPoc.email || selectedPoc.phone || ""
                            updated.recipientBranch = bText && lText ? `${bText}, ${lText}` : (bText || lText || "")
                          }
                          return updated
                        });
                        setErrors({ ...errors, pocId: "" })
                      }}
                      disabled={isFetching}
                    >
                      <option value="">{isFetching ? "Loading..." : "Select POC"}</option>
                      {pocs.filter(p => p.role === 'POC').map((poc) => (
                        <option key={poc.id} value={poc.id}>{poc.name}{poc.branch ? ` (${poc.branch})` : ''}</option>
                      ))}
                    </select>
                    {errors.pocId && <p style={{ fontSize: '13px', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><AlertIcon /> {errors.pocId}</p>}
                  </>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Select Client</label>
                <select
                  className="form-select"
                  value={formData.clientId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setFormData({ ...formData, clientId: e.target.value });
                  }}
                  disabled={isFetching}
                >
                  <option value="">{isFetching ? "Loading..." : "Select Client (Optional)"}</option>
                  {pocs.filter(p => p.role === 'CLIENT').map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Location (City) <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select
                  className={`form-select ${errors.city ? 'border-red-400' : ''}`}
                  value={formData.city}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFormData({ ...formData, city: e.target.value, branch: "" }); setErrors({ ...errors, city: "", branch: "" }) }}
                >
                  <option value="">Select City</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
                {errors.city && <p style={{ fontSize: '13px', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><AlertIcon /> {errors.city}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Branch Location <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <select
                  className={`form-select ${errors.branch ? 'border-red-400' : ''}`}
                  value={formData.branch}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFormData({ ...formData, branch: e.target.value }); setErrors({ ...errors, branch: "" }) }}
                  disabled={!formData.city}
                >
                  <option value="">{formData.city ? "Select Branch" : "Select city first"}</option>
                  {cityData?.branches.map((branch: string) => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
                {errors.branch && <p style={{ fontSize: '13px', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><AlertIcon /> {errors.branch}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Delivery Date <span style={{ color: 'var(--color-error)' }}>*</span></label>
                <input
                  type="date"
                  min={today}
                  className={`form-input ${errors.deliveryDate ? 'border-red-400' : ''}`}
                  style={{ width: '200px' }}
                  value={formData.deliveryDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, deliveryDate: e.target.value }); setErrors({ ...errors, deliveryDate: "" }) }}
                />
                {errors.deliveryDate && <p style={{ fontSize: '13px', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}><AlertIcon /> {errors.deliveryDate}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">State</label>
                <input
                  type="text"
                  readOnly
                  className="form-input"
                  style={{ background: 'var(--gray-100)' }}
                  value={cityData?.state || ''}
                  placeholder="State"
                />
              </div>


            </div>
          </div>
        </div>

        {/* Collaterals Label Outside Card */}
        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-700)' }}>Collaterals (Add Multiple Items) <span style={{ color: 'var(--color-error)' }}>*</span></label>
        </div>

        {/* Collaterals Card */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ padding: '24px' }}>
            {errors.collaterals && (
              <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--color-error)', borderRadius: '10px', color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <AlertIcon /> {errors.collaterals}
              </div>
            )}

            {/* Table Header */}
            <div style={{ padding: '0 8px 8px', borderBottom: '1px solid var(--gray-200)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.8fr) minmax(0, 1.1fr) minmax(0, 1.3fr) minmax(0, 1.5fr) 36px', gap: '12px', fontSize: '12px', fontWeight: 800, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <div style={{ textAlign: 'left', display: 'block', width: '100%' }}>Item</div>
                <div style={{ textAlign: 'left', display: 'block', width: '100%' }}>Description</div>
                <div style={{ textAlign: 'left', display: 'block', width: '100%' }}>Quantity</div>
                <div style={{ textAlign: 'left', display: 'block', width: '100%' }}>Rate / Unit</div>
                <div style={{ textAlign: 'left', display: 'block', width: '100%' }}>Total</div>
                <div style={{ width: '36px' }}></div>
              </div>
            </div>

            {/* Collateral Rows */}
            {collaterals.map((collateral, index) => (
              <div key={collateral.id} style={{ padding: '12px 8px', borderBottom: '1px solid var(--gray-100)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.8fr) minmax(0, 1.1fr) minmax(0, 1.3fr) minmax(0, 1.5fr) 36px', gap: '12px', alignItems: 'center' }}>
                  <select
                    className="form-select"
                    value={collateral.itemName}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCollateral(collateral.id, "itemName", e.target.value)}
                    disabled={isFetching}
                    style={{ height: '38.5px', boxSizing: 'border-box', marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
                  >
                    <option value="">{isFetching ? "Loading..." : "Select Item"}</option>
                    {rateCards.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                  </select>
                  <input
                    type="text"
                    className="form-input"
                    value={collateral.specification || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCollateral(collateral.id, "specification", e.target.value)}
                    placeholder="Item Description"
                    style={{ fontSize: '13px', height: '38.5px', boxSizing: 'border-box', marginBottom: 0 }}
                  />
                  <input
                    type="number"
                    min="1"
                    className={`form-input ${errors[`qty_${index}`] ? 'border-red-400' : ''}`}
                    value={collateral.quantity || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCollateral(collateral.id, "quantity", parseInt(e.target.value) || 0)}
                    placeholder="0"
                    style={{ height: '38.5px', boxSizing: 'border-box', marginBottom: 0 }}
                  />
                  {isAdmin ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={collateral.unitPrice || ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCollateral(collateral.id, "unitPrice", parseFloat(e.target.value) || 0)}
                      placeholder="Rate / Unit"
                      style={{ height: '38.5px', boxSizing: 'border-box', marginBottom: 0, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px' }}
                      title="Edit Rate / Unit (Admin Only)"
                    />
                  ) : (
                    <div
                      title="Auto-set from rate card"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        height: '38.5px',
                        padding: '0 12px',
                        background: 'var(--gray-50)',
                        border: '1px solid var(--gray-200)',
                        borderRadius: '10px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color: collateral.unitPrice > 0 ? 'var(--gray-700)' : 'var(--gray-400)',
                        fontSize: '13px',
                        cursor: 'default',
                        userSelect: 'none' as const,
                        boxSizing: 'border-box',
                      }}
                    >
                      {collateral.unitPrice > 0 ? `₹${collateral.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', height: '38.5px', padding: '0 8px', background: 'var(--gray-100)', borderRadius: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--gray-800)', fontSize: '13px', boxSizing: 'border-box', overflow: 'hidden' }}>
                    {formatCurrency(collateral.totalPrice)}
                  </div>
                  {collaterals.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeCollateral(collateral.id)}
                      style={{ width: '36px', height: '38.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', borderRadius: '10px', border: 'none', background: 'transparent', cursor: 'pointer', boxSizing: 'border-box' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--gray-400)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <TrashIcon />
                    </button>
                  ) : (
                    <div style={{ width: '36px' }}></div>
                  )}
                </div>
              </div>
            ))}

            {/* Add Button */}
            <button
              type="button"
              onClick={addCollateral}
              disabled={isFetching}
              style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', background: 'var(--axis-accent)', color: 'white', fontWeight: 700, fontSize: '14px', border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
            >
              {isFetching ? <><LoaderIcon /> Loading...</> : <><PlusIcon /> Add Another Collateral</>}
            </button>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
              {/* Packing Charges Section */}
              <div style={{ flex: 1, minWidth: '280px' }}>
                {!showPackingForm ? (
                  <button
                    type="button"
                    onClick={() => setShowPackingForm(true)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', background: 'var(--gray-100)', color: 'var(--gray-700)', fontWeight: 600, fontSize: '14px', border: '1px dashed var(--gray-400)', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Add Packing Charges {formData.packingCharges ? `(₹${formData.packingCharges})` : ''}
                  </button>
                ) : (
                  <div style={{ padding: '16px', background: 'var(--gray-50)', borderRadius: '10px', border: '1px solid var(--gray-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-700)' }}>Packing Charges</label>
                      <button
                        type="button"
                        onClick={() => setShowPackingForm(false)}
                        style={{ color: 'var(--gray-500)', cursor: 'pointer', background: 'none', border: 'none' }}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '4px', display: 'block' }}>Amount (₹)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={formData.packingCharges}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, packingCharges: e.target.value }) }}
                          placeholder="Enter amount"
                          step="0.01"
                          min="0"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '4px', display: 'block' }}>GST %</label>
                        <input
                          type="number"
                          className="form-input"
                          value={formData.packingChargesGstRate}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, packingChargesGstRate: e.target.value }) }}
                          placeholder="18"
                          step="0.01"
                          min="0"
                          max="100"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                     <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>GST @ {formData.packingChargesGstRate !== "" ? formData.packingChargesGstRate : 18}% will be applied on packing charges</p>
                  </div>
                )}
              </div>

              {/* Delivery Charges Section */}
              <div style={{ flex: 1, minWidth: '280px' }}>
                {!showDeliveryForm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeliveryForm(true)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 18px', borderRadius: '10px', background: 'var(--gray-100)', color: 'var(--gray-700)', fontWeight: 600, fontSize: '14px', border: '1px dashed var(--gray-400)', cursor: 'pointer', boxSizing: 'border-box' }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 001-1v-4h3m4 4h.01M21 16v-2a2 2 0 00-2-2h-3V7a1 1 0 00-1-1H13" />
                    </svg>
                    Add Delivery Charges {formData.deliveryCharges ? `(₹${formData.deliveryCharges})` : ''}
                  </button>
                ) : (
                  <div style={{ padding: '16px', background: 'var(--gray-50)', borderRadius: '10px', border: '1px solid var(--gray-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-700)' }}>Delivery Charges</label>
                      <button
                        type="button"
                        onClick={() => setShowDeliveryForm(false)}
                        style={{ color: 'var(--gray-500)', cursor: 'pointer', background: 'none', border: 'none' }}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '4px', display: 'block' }}>Amount (₹)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={formData.deliveryCharges}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, deliveryCharges: e.target.value }) }}
                          placeholder="Enter amount"
                          step="0.01"
                          min="0"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gray-600)', marginBottom: '4px', display: 'block' }}>GST %</label>
                        <input
                          type="number"
                          className="form-input"
                          value={formData.deliveryChargesGstRate}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setFormData({ ...formData, deliveryChargesGstRate: e.target.value }) }}
                          placeholder="18"
                          step="0.01"
                          min="0"
                          max="100"
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                     <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>GST @ {formData.deliveryChargesGstRate !== "" ? formData.deliveryChargesGstRate : 18}% will be applied on delivery charges</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Special Instructions - Matching HTML exactly */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gray-700)' }}>Special Instructions</label>
          <textarea
            rows={3}
            value={formData.instructions}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, instructions: e.target.value })}
            placeholder="E.g., Delivery between 9 AM - 5 PM only, Handle with care, Contact POC before dispatch..."
            style={{
              padding: '11px 14px',
              border: '1px solid var(--gray-300)',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              width: '100%',
              minHeight: '80px',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Recipient Details */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <label style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-700)' }}>Recipient Details (Optional)</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.sameAsPoc}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const checked = e.target.checked
                    if (checked) {
                      const selectedPoc = pocs.find(p => p.id === formData.pocId)
                      const bText = selectedPoc?.branch || formData.branch || ""
                      const lText = selectedPoc?.location || formData.city || ""
                      setFormData(prev => ({
                        ...prev,
                        sameAsPoc: true,
                        recipientName: selectedPoc?.name || "",
                        recipientContact: selectedPoc?.email || selectedPoc?.phone || "",
                        recipientBranch: bText && lText ? `${bText}, ${lText}` : (bText || lText || ""),
                      }))
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        sameAsPoc: false,
                        recipientName: "",
                        recipientContact: "",
                        recipientBranch: "",
                      }))
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
                Same as POC
              </label>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Recipient Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.recipientName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, recipientName: e.target.value })}
                  placeholder="Enter recipient name"
                  disabled={formData.sameAsPoc}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Recipient Contact</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.recipientContact}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, recipientContact: e.target.value })}
                  placeholder="Enter contact number/email"
                  disabled={formData.sameAsPoc}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Recipient Branch/Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.recipientBranch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, recipientBranch: e.target.value })}
                  placeholder="Enter branch/address"
                  disabled={formData.sameAsPoc}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Cost Summary with GST Breakdown */}
        <div className="card" style={{ marginBottom: '24px', background: 'rgba(224, 242, 254, 0.3)', border: '1px solid rgba(186, 230, 253, 0.5)' }}>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--gray-700)' }}>Subtotal (Items):</span>
              <Currency amount={subtotal} size="15px" color="var(--gray-800)" />
            </div>
            {/* Items GST */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-600)' }}>
                GST on Items ({[...new Set(collaterals.filter(c => c.itemName).map(c => `${c.gstRate ?? 18}%`))].join(', ')}):
              </span>
              <Currency amount={collateralsGst} size="14px" color="#0ea5e9" />
            </div>
            {/* Packing with GST (if applicable) */}
            {packingCharges > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-600)' }}>
                  Packing (₹{packingCharges} + {packingChargesGstRate}% GST):
                </span>
                <Currency amount={packingCharges + packingChargesGst} size="14px" color="#0ea5e9" />
              </div>
            )}
            {/* Delivery with GST (if applicable) */}
            {deliveryCharges > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-600)' }}>
                  Delivery (₹{deliveryCharges} + {deliveryChargesGstRate}% GST):
                </span>
                <Currency amount={deliveryCharges + deliveryChargesGst} size="14px" color="#0ea5e9" />
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '2px solid var(--gray-200)', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gray-900)' }}>Total Payable:</span>
              <span style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--axis-primary)' }}>{formatCurrency(totalCost)}</span>
            </div>
             <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#1e40af', fontWeight: 500, margin: 0 }}>
                💡 Product GST rates: {collaterals.filter(c => c.itemName).map(c => `${c.itemName} (${c.gstRate ?? 18}%)`).join(', ')}{packingCharges > 0 ? ` | Packing: ${packingChargesGstRate}%` : ''}{deliveryCharges > 0 ? ` | Delivery: ${deliveryChargesGstRate}%` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons at bottom of form */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel || (() => router.back())}
            disabled={isLoading}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isLoading ? <><LoaderIcon /> Creating...</> : <><PlusIcon /> Create Project</>}
          </button>
        </div>
      </form>
    </div>
  )
}
