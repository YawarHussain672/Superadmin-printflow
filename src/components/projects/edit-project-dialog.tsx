"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { BRANCH_LOCATIONS, CITIES } from "@/lib/branch-locations"

// Match HTML reference exactly - simplified fields
interface Project {
  id: string
  name: string
  pocId: string | null
  clientId: string | null
  location: string
  branch?: string | null
  state: string
  deliveryDate: string | null
  status: string
  piNumber?: string | null
  piStatus?: string | null
  material?: string
  quantity?: number
  packingCharges?: number | null
  packingChargesGstRate?: number | null
  deliveryCharges?: number | null
  deliveryChargesGstRate?: number | null
  collaterals?: { id: string; itemName: string; quantity: number; unitPrice: number; totalPrice: number; gstRate?: number | null; gstAmount?: number | null; specification?: string | null }[]
  dispatch?: {
    courier: string
    trackingId: string
  } | null
  recipientName?: string | null
  recipientContact?: string | null
  recipientBranch?: string | null
}

interface POC {
  id: string
  name: string
  role?: string
  email?: string | null
  phone?: string | null
  location?: string | null
  branch?: string | null
}

interface RateCardItem {
  id: string
  name: string
  volumeSlabs: { slab: string; minQty: number; maxQty: number | null; price: number }[]
  defaultPrice: number
  gstRate?: number
}

interface CollateralWithPrice {
  id?: string
  itemName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  gstRate?: number
  gstAmount?: number
  specification?: string | null
}

interface EditProjectDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (regeneratePI?: boolean) => void
  isAdmin?: boolean
}

// Match HTML reference status values exactly
const PROJECT_STATUSES = [
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "printing", label: "Printing" },
  { value: "dispatched", label: "Dispatched" },
  { value: "delivered", label: "Delivered" },
]

// Use CITIES from branch-locations for consistency with new project form

// Match HTML reference couriers
const COURIERS = [
  { value: "-", label: "Not assigned" },
  { value: "Delhivery", label: "Delhivery" },
  { value: "BlueDart", label: "BlueDart" },
  { value: "DTDC", label: "DTDC" },
  { value: "FedEx", label: "FedEx" },
]

export function EditProjectDialog({ project, open, onOpenChange, onSuccess, isAdmin = false }: EditProjectDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [pocs, setPocs] = useState<POC[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null)
  const [sameAsPoc, setSameAsPoc] = useState(false)

  const [cities, setCities] = useState<string[]>(CITIES)
  const [branchLocations, setBranchLocations] = useState<Record<string, { state: string; branches: string[] }>>(BRANCH_LOCATIONS)

  // Match HTML reference form fields exactly
  const [formData, setFormData] = useState({
    name: "",
    pocId: "",
    clientId: "",
    location: "",
    branch: "",
    status: "",
    material: "",
    quantity: "",
    courier: "",
    deliveryDate: "",
    recipientName: "",
    recipientContact: "",
    recipientBranch: "",
  })

  // State for collaterals (items) with prices
  const [collaterals, setCollaterals] = useState<CollateralWithPrice[]>([])
  const [rateCardItems, setRateCardItems] = useState<RateCardItem[]>([])
  const [showAddItemForm, setShowAddItemForm] = useState(false)
  const [selectedRateCardItem, setSelectedRateCardItem] = useState("")
  const [newItemQuantity, setNewItemQuantity] = useState("")
  const [newItemSpecification, setNewItemSpecification] = useState("")
  const [totalCost, setTotalCost] = useState(0)
  const [packingCharges, setPackingCharges] = useState(0)
  const [packingChargesGstRate, setPackingChargesGstRate] = useState<number | "">(18)
  const [showPackingForm, setShowPackingForm] = useState(false)
  const [deliveryCharges, setDeliveryCharges] = useState(0)
  const [deliveryChargesGstRate, setDeliveryChargesGstRate] = useState<number | "">(18)
  const [showDeliveryForm, setShowDeliveryForm] = useState(false)

  const today = new Date().toISOString().split("T")[0]

  // Load form data when dialog opens
  useEffect(() => {
    if (!open) {
      setLoadedProjectId(null)
      setErrors({})
      return
    }
    setErrors({})
    if (!project) return
    if (project.id === loadedProjectId) return

    async function loadData() {
      if (!project) return
      setIsFetching(true)
      try {
        // Fetch team list and rate cards in parallel
        const [teamRes, rateCardRes] = await Promise.all([
          fetch("/api/team-list"),
          fetch("/api/rate-card-list")
        ])

        let fetchedRateCards: RateCardItem[] = []
        let teamData: POC[] = []
        if (teamRes.ok) {
          const team = await teamRes.json()
          teamData = team.map((u: any) => ({
            id: u.id,
            name: u.name,
            role: u.role,
            email: u.email,
            phone: u.phone,
            location: u.location,
            branch: u.branch,
          }))
          setPocs(teamData)
        } else {
          const errorData = await teamRes.json().catch(() => ({ error: "Unknown error" }))
          console.error("Team API error:", errorData)
          toast.error(`Failed to load team: ${errorData.error || teamRes.statusText}`)
        }

        if (rateCardRes.ok) {
          fetchedRateCards = await rateCardRes.json()
          setRateCardItems(fetchedRateCards)
        }

        // Merge custom locations/branches from teamData and from the current project itself
        const mergedLocations = {} as Record<string, { state: string; branches: string[] }>
        Object.keys(BRANCH_LOCATIONS).forEach((key) => {
          mergedLocations[key] = {
            state: BRANCH_LOCATIONS[key].state,
            branches: [...BRANCH_LOCATIONS[key].branches]
          }
        })

        const mergeItem = (locStr?: string | null, branchStr?: string | null) => {
          if (locStr) {
            const city = locStr.trim()
            if (city) {
              const existingCity = Object.keys(mergedLocations).find(
                (c) => c.toLowerCase() === city.toLowerCase()
              )
              const targetCity = existingCity || city
              if (!mergedLocations[targetCity]) {
                mergedLocations[targetCity] = { state: "", branches: [] }
              }
              if (branchStr) {
                const branchName = branchStr.trim()
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
        }

        if (project) {
          mergeItem(project.location, project.branch)
        }
        teamData.forEach((p) => {
          if (p.role === "POC") {
            mergeItem(p.location, p.branch)
          }
        })

        setBranchLocations(mergedLocations)
        setCities(Object.keys(mergedLocations).sort())

        // Set form data from project - match HTML reference exactly
        setFormData({
          name: project.name || "",
          pocId: project.pocId || "",
          clientId: project.clientId || "",
          location: project.location || "",
          branch: project.branch || "",
          status: project.status?.toLowerCase() || "requested",
          material: project.material || project.collaterals?.[0]?.itemName || "",
          quantity: project.quantity?.toString() || project.collaterals?.[0]?.quantity?.toString() || "",
          courier: project.dispatch?.courier || "-",
          deliveryDate: project.deliveryDate ? project.deliveryDate.split("T")[0] : "",
          recipientName: project.recipientName || "",
          recipientContact: project.recipientContact || "",
          recipientBranch: project.recipientBranch || "",
        })

        const selectedPoc = teamData.find(p => p.id === project.pocId)
        const isSame = Boolean(
          project.recipientName &&
          selectedPoc &&
          project.recipientName === selectedPoc.name &&
          (project.recipientContact === selectedPoc.email || project.recipientContact === selectedPoc.phone) &&
          (project.recipientBranch === selectedPoc.branch || project.recipientBranch === selectedPoc.location)
        )
        setSameAsPoc(isSame)

        // Load all collaterals using saved prices (source of truth)
        // Only recalculate from rate card when quantity changes
        // Filter out any "Packaging Charges" items - they should be handled by packingCharges field
        const loadedCollaterals: CollateralWithPrice[] = project.collaterals
          ?.filter(c => c.itemName !== 'Packaging Charges' && c.itemName !== 'Packing Charges')
          ?.map(c => {
            const totalPrice = c.totalPrice || (c.unitPrice * c.quantity) || 0
            const gstRate = c.gstRate ?? 18
            return {
              id: c.id,
              itemName: c.itemName,
              quantity: c.quantity,
              unitPrice: c.unitPrice || 0,
              totalPrice,
              gstRate,
              gstAmount: c.gstAmount || totalPrice * (gstRate / 100),
              specification: c.specification || "",
            }
          }) || []
        setCollaterals(loadedCollaterals)

        // Load packing and delivery charges from project
        const loadedPackingCharges = project.packingCharges || 0
        const loadedPackingGstRate = project.packingChargesGstRate ?? 18
        setPackingCharges(loadedPackingCharges)
        setPackingChargesGstRate(loadedPackingGstRate)

        const loadedDeliveryCharges = project.deliveryCharges || 0
        const loadedDeliveryGstRate = project.deliveryChargesGstRate ?? 18
        setDeliveryCharges(loadedDeliveryCharges)
        setDeliveryChargesGstRate(loadedDeliveryGstRate)

        updateTotalCost(loadedCollaterals, loadedPackingCharges, loadedDeliveryCharges)
        setLoadedProjectId(project.id)
      } catch {
        toast.error("Failed to load form data")
      } finally {
        setIsFetching(false)
      }
    }

    loadData()
  }, [open, project, loadedProjectId])

  // Parse slab string like "1-99", "100+", "1000", "Upto 100", "Less than 50"
  function parseSlabRange(slabLabel: string): { minQty: number; maxQty: number | null } {
    const lower = slabLabel.toLowerCase()
    const numbers = slabLabel.match(/\d+/g)?.map(Number) ?? []

    if ((lower.includes("less") || lower.includes("under") || lower.includes("below")) && numbers.length >= 1) {
      return { minQty: 1, maxQty: numbers[0] - 1 }
    }

    if (lower.includes("upto") && numbers.length >= 1) {
      return { minQty: 1, maxQty: numbers[0] }
    }

    if (numbers.length >= 2) {
      return { minQty: numbers[0], maxQty: numbers[1] }
    }

    if (numbers.length === 1) {
      // Check for "100+" or "above 100" pattern
      if (lower.includes("+") || lower.includes("plus") || lower.includes("above") || lower.includes("over")) {
        return { minQty: numbers[0], maxQty: null }
      }
      // Single number without + might be a threshold
      return { minQty: numbers[0], maxQty: null }
    }

    return { minQty: 1, maxQty: null }
  }

  // Calculate unit price from rate card based on quantity (with explicit rateCards data)
  function getUnitPriceFromRateCardWithData(itemName: string, quantity: number, rateCards: RateCardItem[]): number {
    const rateCard = rateCards.find(r => r.name === itemName)
    if (!rateCard) return 0

    if (!rateCard.volumeSlabs || rateCard.volumeSlabs.length === 0) {
      return rateCard.defaultPrice
    }

    // Parse the slabs to get minQty/maxQty
    const parsedSlabs = rateCard.volumeSlabs.map(slab => ({
      ...slab,
      ...parseSlabRange(slab.slab)
    })).sort((a, b) => a.minQty - b.minQty)

    if (parsedSlabs.length === 0) return rateCard.defaultPrice

    // Check if this is tiered discount pricing (negative prices = discounts)
    const hasNegativePrices = parsedSlabs.some(s => s.price < 0)

    if (hasNegativePrices) {
      // Tiered discount pricing
      let matchedSlabIndex = -1

      for (let i = 0; i < parsedSlabs.length; i++) {
        const slab = parsedSlabs[i]
        if (slab.maxQty !== null) {
          // Range slab: check if quantity is within range
          if (quantity >= slab.minQty && quantity <= slab.maxQty) {
            matchedSlabIndex = i
            break
          }
        } else {
          // Threshold slab: check if quantity meets minimum
          if (quantity >= slab.minQty) {
            matchedSlabIndex = i
          }
        }
      }

      if (matchedSlabIndex === -1) {
        return parsedSlabs[0].price // Fallback to first slab
      }

      // Calculate price: base price + matched slab's discount
      const basePrice = parsedSlabs[0].price
      const discount = matchedSlabIndex > 0 ? parsedSlabs[matchedSlabIndex].price : 0
      return Math.max(0, basePrice + discount)
    }

    // Standard pricing (all positive prices)
    // First, try to find an exact range match (e.g., "1-100" for quantity 50)
    const exactRangeMatch = parsedSlabs.find(
      slab => slab.maxQty !== null && quantity >= slab.minQty && quantity <= slab.maxQty
    )
    if (exactRangeMatch) return exactRangeMatch.price

    // For threshold-style slabs (e.g., "100+", "500+", "1000"), find the highest minQty that matches
    const sortedByMinDesc = [...parsedSlabs].sort((a, b) => b.minQty - a.minQty)
    const thresholdMatch = sortedByMinDesc.find(slab => quantity >= slab.minQty)

    if (thresholdMatch) return thresholdMatch.price

    // Fallback to first slab if nothing matches
    return parsedSlabs[0].price
  }

  // Calculate unit price from rate card based on quantity (uses state)
  function getUnitPriceFromRateCard(itemName: string, quantity: number): number {
    return getUnitPriceFromRateCardWithData(itemName, quantity, rateCardItems)
  }

  // Update total cost based on all collaterals, packing charges, and delivery charges
  function updateTotalCost(items: CollateralWithPrice[], packing?: number, delivery?: number) {
    const itemsTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    const packingTotal = packing !== undefined ? packing : packingCharges
    const deliveryTotal = delivery !== undefined ? delivery : deliveryCharges
    setTotalCost(itemsTotal + packingTotal + deliveryTotal)
  }

  // Update collateral quantity and recalculate price
  function updateCollateralQuantity(index: number, newQuantity: number) {
    const updated = [...collaterals]
    const item = updated[index]
    item.quantity = newQuantity
    const newUnitPrice = getUnitPriceFromRateCard(item.itemName, newQuantity)
    // Only update price if rate card lookup succeeds, otherwise keep original
    if (newUnitPrice > 0) {
      item.unitPrice = newUnitPrice
    }
    item.totalPrice = item.unitPrice * newQuantity
    if (item.gstRate !== undefined) {
      item.gstAmount = item.totalPrice * (item.gstRate / 100)
    }
    setCollaterals(updated)
    updateTotalCost(updated)
  }
  // Add new collateral from rate card
  function addCollateral() {
    if (!selectedRateCardItem || !parseInt(newItemQuantity)) return

    const quantity = parseInt(newItemQuantity)
    const rateCard = rateCardItems.find(r => r.id === selectedRateCardItem)
    if (!rateCard) return

    const unitPrice = getUnitPriceFromRateCard(rateCard.name, quantity)
    const gstRate = rateCard.gstRate ?? 18
    const totalPrice = unitPrice * quantity
    const newCollateral: CollateralWithPrice = {
      itemName: rateCard.name,
      quantity: quantity,
      unitPrice: unitPrice,
      totalPrice,
      gstRate,
      gstAmount: totalPrice * (gstRate / 100),
      specification: newItemSpecification.trim() || "",
    }
    const updated = [...collaterals, newCollateral]
    setCollaterals(updated)
    updateTotalCost(updated)

    // Reset form
    setSelectedRateCardItem("")
    setNewItemQuantity("")
    setNewItemSpecification("")
    setShowAddItemForm(false)
  }

  // Remove collateral
  function removeCollateral(index: number) {
    const updated = collaterals.filter((_, i) => i !== index)
    setCollaterals(updated)
    updateTotalCost(updated)
  }

  const itemsSubtotal = collaterals.reduce((sum, c) => sum + c.totalPrice, 0)
  const itemGstAmount = collaterals.reduce(
    (sum, c) => sum + (c.gstAmount || (c.totalPrice * ((c.gstRate ?? 18) / 100))),
    0
  )
  const packingGstAmount = packingCharges * ((packingChargesGstRate === "" ? 18 : packingChargesGstRate) / 100)
  const deliveryGstAmount = deliveryCharges * ((deliveryChargesGstRate === "" ? 18 : deliveryChargesGstRate) / 100)
  const totalGstAmount = itemGstAmount + packingGstAmount + deliveryGstAmount
  const grandTotalAmount = totalCost + totalGstAmount
  const uniqueItemGstRates = [...new Set(collaterals.filter(c => c.itemName).map(c => `${c.gstRate ?? 18}%`))]

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!formData.name.trim() || formData.name.trim().length < 3) errs.name = "Project name must be at least 3 characters"
    if (!formData.pocId) errs.pocId = "Please select a POC"
    if (!formData.location) errs.location = "Please select a location"
    if (!formData.branch) errs.branch = "Please select a branch location"
    if (!formData.status) errs.status = "Please select a status"
    if (!formData.deliveryDate) errs.deliveryDate = "Delivery date is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) { toast.error("Please fix the errors before saving"); return }
    if (!project) return

    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          pocId: formData.pocId,
          clientId: formData.clientId,
          location: formData.location,
          branch: formData.branch,
          deliveryDate: formData.deliveryDate,
          // Status is visible to all (matching HTML reference)
          status: formData.status.toUpperCase(),
          recipientName: formData.recipientName || null,
          recipientContact: formData.recipientContact || null,
          recipientBranch: formData.recipientBranch || null,
          // Send all collaterals
          collaterals: collaterals.map(c => ({
            id: c.id,
            itemName: c.itemName,
            quantity: c.quantity,
            specification: c.specification || "",
          })),
          // Packing charges
          packingCharges,
          packingChargesGstRate: packingChargesGstRate === "" ? 18 : packingChargesGstRate,
          // Delivery charges
          deliveryCharges,
          deliveryChargesGstRate: deliveryChargesGstRate === "" ? 18 : deliveryChargesGstRate,
          // Courier with "Not assigned" option (matching HTML reference)
          ...(formData.courier && formData.courier !== "-" ? {
            dispatch: {
              courier: formData.courier,
              trackingId: "",
            }
          } : {}),
        }),
      })

      if (res.ok) {
        const originalCollaterals = project.collaterals
          ?.filter(c => c.itemName !== 'Packaging Charges' && c.itemName !== 'Packing Charges')
          .map(c => ({ itemName: c.itemName, quantity: c.quantity, specification: c.specification || "" })) || []
        const updatedCollaterals = collaterals.map(c => ({ itemName: c.itemName, quantity: c.quantity, specification: c.specification || "" }))

        const sortCollateral = (a: { itemName: string; quantity: number }, b: { itemName: string; quantity: number }) =>
          a.itemName.localeCompare(b.itemName) || a.quantity - b.quantity

        originalCollaterals.sort(sortCollateral)
        updatedCollaterals.sort(sortCollateral)

        const collateralsChanged = originalCollaterals.length !== updatedCollaterals.length ||
          originalCollaterals.some((item, index) =>
            item.itemName !== updatedCollaterals[index]?.itemName ||
            item.quantity !== updatedCollaterals[index]?.quantity ||
            item.specification !== updatedCollaterals[index]?.specification
          )

        const resolvedPackingGstRate = packingChargesGstRate === "" ? 18 : packingChargesGstRate
        const packingChanged = packingCharges !== (project.packingCharges || 0) ||
          resolvedPackingGstRate !== (project.packingChargesGstRate ?? 18)
        const resolvedDeliveryGstRate = deliveryChargesGstRate === "" ? 18 : deliveryChargesGstRate
        const deliveryChanged = deliveryCharges !== (project.deliveryCharges || 0) ||
          resolvedDeliveryGstRate !== (project.deliveryChargesGstRate ?? 18)

        const recipientNameChanged = (formData.recipientName || "") !== (project.recipientName || "")
        const recipientContactChanged = (formData.recipientContact || "") !== (project.recipientContact || "")
        const recipientBranchChanged = (formData.recipientBranch || "") !== (project.recipientBranch || "")
        const recipientChanged = recipientNameChanged || recipientContactChanged || recipientBranchChanged

        const nameChanged = formData.name.trim() !== (project.name || "").trim()
        const pocIdChanged = formData.pocId !== (project.pocId || "")
        const clientIdChanged = formData.clientId !== (project.clientId || "")
        const locationChanged = formData.location !== (project.location || "")
        const branchChanged = formData.branch !== (project.branch || "")
        const statusChanged = formData.status.toUpperCase() !== (project.status || "").toUpperCase()
        const deliveryDateChanged = (formData.deliveryDate || "") !== (project.deliveryDate ? project.deliveryDate.split("T")[0] : "")

        const anyFormChanged = nameChanged ||
          pocIdChanged ||
          clientIdChanged ||
          locationChanged ||
          branchChanged ||
          statusChanged ||
          deliveryDateChanged ||
          collateralsChanged ||
          packingChanged ||
          deliveryChanged ||
          recipientChanged

        const shouldRegeneratePI = Boolean(project.piNumber && anyFormChanged)

        toast.success("Project updated successfully!")
        onOpenChange(false)
        // Small delay to ensure dialog closes before refresh
        setTimeout(() => {
          onSuccess?.(shouldRegeneratePI)
        }, 100)
      } else {
        const text = await res.text()
        let errorMsg = "Failed to update project"
        try {
          const data = JSON.parse(text)
          errorMsg = data.error || errorMsg
        } catch { }
        toast.error(errorMsg)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!project || !open) return null

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) onOpenChange(false)
    }}>
      <div className="modal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header - Matching HTML exactly */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Edit Project</h2>
            <p className="modal-subtitle">{project.id} • {project.name}</p>
          </div>
          <button className="modal-close" onClick={() => onOpenChange(false)}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {isFetching ? (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: '#003c71' }} />
              <p style={{ color: '#64748b', fontSize: '14px' }}>Loading project data...</p>
            </div>
          ) : (
            <form id="editProjectForm" onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Form Grid - Matching HTML form-grid class */}
              <div className="form-grid" style={{ width: '100%' }}>
                {/* Project Name */}
                <div className="form-group">
                  <label className="form-label">Project Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setErrors({ ...errors, name: "" }) }}
                    style={errors.name ? { borderColor: '#ef4444' } : {}}
                  />
                  {errors.name && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.name}</p>}
                </div>

                {/* POC Name */}
                <div className="form-group">
                  <label className="form-label">POC Name *</label>
                  <select
                    className="form-select"
                    value={formData.pocId}
                    onChange={(e) => {
                      const newPocId = e.target.value
                      const selectedPoc = pocs.find(p => p.id === newPocId)
                      setFormData(prev => {
                        let matchedCity = prev.location
                        let matchedBranch = prev.branch

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

                        const updated = {
                          ...prev,
                          pocId: newPocId,
                          location: matchedCity,
                          branch: matchedBranch,
                        }
                        if (sameAsPoc && selectedPoc) {
                          updated.recipientName = selectedPoc.name
                          updated.recipientContact = selectedPoc.email || selectedPoc.phone || ""
                          updated.recipientBranch = matchedBranch || matchedCity || ""
                        }
                        return updated
                      })
                      setErrors(prev => ({ ...prev, pocId: "", location: "", branch: "" }))
                    }}
                    style={errors.pocId ? { borderColor: '#ef4444' } : {}}
                  >
                    <option value="">Select POC</option>
                    {pocs.filter(p => p.role === 'POC').map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.branch ? ` (${p.branch})` : ''}</option>
                    ))}
                  </select>
                  {errors.pocId && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.pocId}</p>}
                </div>

                {/* Client Name - Optional */}
                <div className="form-group">
                  <label className="form-label">Client Name</label>
                  <select
                    className="form-select"
                    value={formData.clientId}
                    onChange={(e) => { setFormData({ ...formData, clientId: e.target.value }) }}
                  >
                    <option value="">Select Client (Optional)</option>
                    {pocs.filter(p => p.role === 'CLIENT').map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Location */}
                <div className="form-group">
                  <label className="form-label">Location *</label>
                  <select
                    className="form-select"
                    value={formData.location}
                    onChange={(e) => {
                      setFormData({ ...formData, location: e.target.value, branch: "" });
                      setErrors({ ...errors, location: "", branch: "" })
                    }}
                    style={errors.location ? { borderColor: '#ef4444' } : {}}
                  >
                    <option value="">Select Location</option>
                    {cities.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                  {errors.location && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.location}</p>}
                </div>

                {/* Branch Location */}
                <div className="form-group">
                  <label className="form-label">Branch Location *</label>
                  <select
                    className="form-select"
                    value={formData.branch}
                    onChange={(e) => { setFormData({ ...formData, branch: e.target.value }); setErrors({ ...errors, branch: "" }) }}
                    disabled={!formData.location}
                    style={errors.branch ? { borderColor: '#ef4444' } : {}}
                  >
                    <option value="">{formData.location ? "Select Branch" : "Select location first"}</option>
                    {formData.location && branchLocations[formData.location]?.branches.map((branch: string) => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                  {errors.branch && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.branch}</p>}
                </div>

                {/* Status - Visible to ALL like HTML reference */}
                <div className="form-group">
                  <label className="form-label">Status *</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => { setFormData({ ...formData, status: e.target.value }); setErrors({ ...errors, status: "" }) }}
                    style={errors.status ? { borderColor: '#ef4444' } : {}}
                  >
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  {errors.status && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.status}</p>}
                </div>

                {/* Recipient Details - Full width, visible before items */}
                <div className="form-group" style={{ gridColumn: '1 / -1', background: 'rgba(0, 60, 113, 0.03)', border: '1px solid rgba(0, 60, 113, 0.1)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gray-700)', margin: 0 }}>Recipient Details <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--gray-500)' }}>(Optional — used for PI delivery address)</span></label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sameAsPoc}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setSameAsPoc(checked)
                          if (checked) {
                            const selectedPoc = pocs.find(p => p.id === formData.pocId)
                            if (selectedPoc) {
                              setFormData(prev => ({
                                ...prev,
                                recipientName: selectedPoc.name,
                                recipientContact: selectedPoc.email || selectedPoc.phone || "",
                                recipientBranch: selectedPoc.branch || selectedPoc.location || "",
                              }))
                            }
                          } else {
                            setFormData(prev => ({
                              ...prev,
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
                  <div className="form-grid" style={{ width: '100%', border: 'none', padding: 0, margin: 0, gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Recipient Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.recipientName}
                        onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
                        placeholder="Enter recipient name"
                        disabled={sameAsPoc}
                        style={{ marginBottom: 0 }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Recipient Contact</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.recipientContact}
                        onChange={(e) => setFormData(prev => ({ ...prev, recipientContact: e.target.value }))}
                        placeholder="Enter contact number/email"
                        disabled={sameAsPoc}
                        style={{ marginBottom: 0 }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Recipient Branch/Address</label>
                      <input
                        type="text"
                        className="form-input"
                        value={formData.recipientBranch}
                        onChange={(e) => setFormData(prev => ({ ...prev, recipientBranch: e.target.value }))}
                        placeholder="Enter branch/address"
                        disabled={sameAsPoc}
                        style={{ marginBottom: 0 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Collaterals / Items Section - Full width */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Items & Collaterals</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!showAddItemForm && (
                        <button
                          type="button"
                          onClick={() => setShowAddItemForm(true)}
                          style={{
                            padding: '6px 12px',
                            background: 'var(--axis-accent)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                          Add Item
                        </button>
                      )}
                      {!showPackingForm && (
                        <button
                          type="button"
                          onClick={() => setShowPackingForm(true)}
                          style={{
                            padding: '6px 12px',
                            background: '#3b82f6',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          {packingCharges > 0 ? `Packing ₹${packingCharges}` : 'Add Packing'}
                        </button>
                      )}
                      {!showDeliveryForm && (
                        <button
                          type="button"
                          onClick={() => setShowDeliveryForm(true)}
                          style={{
                            padding: '6px 12px',
                            background: '#0ea5e9',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 001-1v-4h3m4 4h.01M21 16v-2a2 2 0 00-2-2h-3V7a1 1 0 00-1-1H13" />
                          </svg>
                          {deliveryCharges > 0 ? `Delivery ₹${deliveryCharges}` : 'Add Delivery'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Add new item form - hidden by default */}
                  {showAddItemForm && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        padding: '16px',
                        background: 'rgba(0, 168, 204, 0.05)',
                        borderRadius: '8px',
                        border: '1px dashed var(--axis-accent)',
                        marginTop: '8px',
                        marginBottom: '16px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                        <select
                          className="form-select"
                          value={selectedRateCardItem}
                          onChange={(e) => setSelectedRateCardItem(e.target.value)}
                          style={{ flex: 2, marginBottom: 0, height: '38.5px', boxSizing: 'border-box', paddingTop: 0, paddingBottom: 0 }}
                        >
                          <option value="">Select item...</option>
                          {rateCardItems.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          className="form-input"
                          value={newItemSpecification}
                          onChange={(e) => setNewItemSpecification(e.target.value)}
                          placeholder="Item Description"
                          style={{ flex: 1.2, fontSize: '13px', padding: '8px 12px', marginBottom: 0, height: '38.5px', boxSizing: 'border-box' }}
                        />
                        <input
                          type="number"
                          className="form-input"
                          value={newItemQuantity}
                          onChange={(e) => setNewItemQuantity(e.target.value)}
                          placeholder="Qty"
                          min="1"
                          style={{ flex: 1.5, marginBottom: 0, height: '38.5px', maxWidth: '140px', boxSizing: 'border-box' }}
                        />
                        <button
                          type="button"
                          onClick={addCollateral}
                          disabled={!selectedRateCardItem || !parseInt(newItemQuantity)}
                          style={{
                            padding: '6px 16px',
                            background: (!selectedRateCardItem || !parseInt(newItemQuantity)) ? '#e5e7eb' : 'var(--axis-accent)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: (!selectedRateCardItem || !parseInt(newItemQuantity)) ? 'not-allowed' : 'pointer',
                            color: (!selectedRateCardItem || !parseInt(newItemQuantity)) ? '#9ca3af' : 'white',
                            fontWeight: 600,
                            fontSize: '13px',
                            height: '38.5px',
                            boxSizing: 'border-box'
                          }}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddItemForm(false)
                            setSelectedRateCardItem('')
                            setNewItemQuantity('')
                            setNewItemSpecification('')
                          }}
                          style={{
                            padding: '6px',
                            background: 'transparent',
                            border: '1px solid var(--gray-300)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: 'var(--gray-600)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '38.5px',
                            width: '38px',
                            boxSizing: 'border-box'
                          }}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* List of existing items - Simple clean view */}
                  {collaterals.length === 0 ? (
                    <p style={{ color: 'var(--gray-500)', fontSize: '14px', fontStyle: 'italic', padding: '12px 0' }}>No items added yet</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                      {collaterals.map((item, index) => (
                        <div
                          key={item.id || index}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            padding: '12px 16px',
                            background: 'var(--gray-50)',
                            borderRadius: '8px',
                            border: '1px solid var(--gray-200)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                            <div style={{ flex: 1.5 }}>
                              <div style={{ fontWeight: 600, color: 'var(--gray-900)' }}>{item.itemName}</div>
                              <div style={{ fontSize: '13px', color: 'var(--gray-500)', marginTop: '2px' }}>
                                {item.quantity > 0 ? (
                                  <>₹{item.unitPrice.toLocaleString('en-IN')} × {item.quantity.toLocaleString('en-IN')} = ₹{item.totalPrice.toLocaleString('en-IN')}</>
                                ) : (
                                  <span style={{ color: 'var(--gray-400)', fontStyle: 'italic' }}>Enter quantity to calculate price</span>
                                )}
                              </div>
                            </div>
                            <input
                              type="text"
                              className="form-input"
                              value={item.specification || ""}
                              onChange={(e) => {
                                const updated = [...collaterals]
                                updated[index] = { ...item, specification: e.target.value }
                                setCollaterals(updated)
                              }}
                              placeholder="Item Description"
                              style={{ flex: 1.2, fontSize: '13px', padding: '8px 12px', marginBottom: 0, height: '38.5px', boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="number"
                                className="form-input"
                                value={item.quantity || ''}
                                onChange={(e) => {
                                  const val = e.target.value
                                  if (val === '') {
                                    // Allow empty input temporarily
                                    const updated = [...collaterals]
                                    updated[index] = { ...item, quantity: 0, totalPrice: 0 }
                                    setCollaterals(updated)
                                    updateTotalCost(updated)
                                  } else {
                                    const num = parseInt(val)
                                    if (!isNaN(num) && num >= 0) {
                                      updateCollateralQuantity(index, num)
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = parseInt(e.target.value)
                                  if (isNaN(val) || val < 1) {
                                    updateCollateralQuantity(index, 1)
                                  }
                                }}
                                min="1"
                                style={{ width: '120px', marginBottom: 0, textAlign: 'center', height: '38.5px', boxSizing: 'border-box' }}
                              />
                              <button
                                type="button"
                                onClick={() => removeCollateral(index)}
                                style={{
                                  padding: '8px',
                                  background: '#fee2e2',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  color: '#dc2626',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  height: '38.5px',
                                  width: '38px',
                                  boxSizing: 'border-box'
                                }}
                                title="Remove item"
                              >
                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Packing Charges Form */}
                  {showPackingForm && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        background: 'rgba(59, 130, 246, 0.05)',
                        borderRadius: '8px',
                        border: '1px dashed #3b82f6',
                        marginTop: '8px',
                        marginBottom: '16px'
                      }}
                    >
                      <input
                        type="number"
                        className="form-input"
                        value={packingCharges || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setPackingCharges(val)
                          updateTotalCost(collaterals, val, deliveryCharges)
                        }}
                        placeholder="Packing amount"
                        min="0"
                        style={{ flex: 1, marginBottom: 0, height: '38px' }}
                      />
                      <input
                        type="number"
                        className="form-input"
                        value={packingChargesGstRate}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === "") {
                            setPackingChargesGstRate("")
                          } else {
                            const parsed = parseFloat(val)
                            setPackingChargesGstRate(isNaN(parsed) ? "" : parsed)
                          }
                        }}
                        placeholder="18"
                        min="0"
                        max="100"
                        style={{ width: '80px', marginBottom: 0, height: '38px', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>% GST</span>
                      <button
                        type="button"
                        onClick={() => {
                          // "Remove" clears packing charges; "Done" just closes the form
                          if (packingCharges > 0) {
                            setShowPackingForm(false)
                          } else {
                            setPackingCharges(0)
                            setPackingChargesGstRate(18)
                            updateTotalCost(collaterals, 0, deliveryCharges)
                            setShowPackingForm(false)
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          background: packingCharges > 0 ? '#3b82f6' : '#e5e7eb',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: packingCharges > 0 ? 'white' : '#9ca3af',
                          fontWeight: 600,
                          fontSize: '13px'
                        }}
                      >
                        {packingCharges > 0 ? 'Done' : 'Cancel'}
                      </button>
                      {packingCharges > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPackingCharges(0)
                            setPackingChargesGstRate(18)
                            updateTotalCost(collaterals, 0, deliveryCharges)
                            setShowPackingForm(false)
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#fee2e2',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#dc2626',
                            fontWeight: 600,
                            fontSize: '13px'
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}

                  {/* Delivery Charges Form */}
                  {showDeliveryForm && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        background: 'rgba(14, 165, 233, 0.05)',
                        borderRadius: '8px',
                        border: '1px dashed #0ea5e9',
                        marginTop: '8px',
                        marginBottom: '16px'
                      }}
                    >
                      <input
                        type="number"
                        className="form-input"
                        value={deliveryCharges || ''}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          setDeliveryCharges(val)
                          updateTotalCost(collaterals, packingCharges, val)
                        }}
                        placeholder="Delivery amount"
                        min="0"
                        style={{ flex: 1, marginBottom: 0, height: '38px' }}
                      />
                      <input
                        type="number"
                        className="form-input"
                        value={deliveryChargesGstRate}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val === "") {
                            setDeliveryChargesGstRate("")
                          } else {
                            const parsed = parseFloat(val)
                            setDeliveryChargesGstRate(isNaN(parsed) ? "" : parsed)
                          }
                        }}
                        placeholder="18"
                        min="0"
                        max="100"
                        style={{ width: '80px', marginBottom: 0, height: '38px', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>% GST</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (deliveryCharges > 0) {
                            setShowDeliveryForm(false)
                          } else {
                            setDeliveryCharges(0)
                            setDeliveryChargesGstRate(18)
                            updateTotalCost(collaterals, packingCharges, 0)
                            setShowDeliveryForm(false)
                          }
                        }}
                        style={{
                          padding: '6px 12px',
                          background: deliveryCharges > 0 ? '#0ea5e9' : '#e5e7eb',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: deliveryCharges > 0 ? 'white' : '#9ca3af',
                          fontWeight: 600,
                          fontSize: '13px'
                        }}
                      >
                        {deliveryCharges > 0 ? 'Done' : 'Cancel'}
                      </button>
                      {deliveryCharges > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDeliveryCharges(0)
                            setDeliveryChargesGstRate(18)
                            updateTotalCost(collaterals, packingCharges, 0)
                            setShowDeliveryForm(false)
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#fee2e2',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#dc2626',
                            fontWeight: 600,
                            fontSize: '13px'
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}

                  {/* Total Cost Display with GST */}
                  {(collaterals.length > 0 || packingCharges > 0 || deliveryCharges > 0) && (
                    <div style={{
                      padding: '16px',
                      background: 'var(--gray-100)',
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      {/* Items Cost */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: 'var(--gray-600)' }}>Items Cost (excl. GST):</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>₹{itemsSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      {/* Packing Charges */}
                      {packingCharges > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ color: 'var(--gray-600)' }}>Packing Charges:</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>₹{packingCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {/* Delivery Charges */}
                      {deliveryCharges > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ color: 'var(--gray-600)' }}>Delivery Charges:</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>₹{deliveryCharges.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {/* Total Base Cost */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', background: 'rgba(0,0,0,0.02)', padding: '4px 0', margin: '4px 0' }}>
                        <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Total Base Cost:</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      {/* GST on Items */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                        <span style={{ color: 'var(--gray-600)' }}>GST on Items{uniqueItemGstRates.length > 0 ? ` (${uniqueItemGstRates.join(', ')})` : ''}:</span>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>₹{itemGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      {/* GST on Packing */}
                      {packingCharges > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ color: 'var(--gray-600)' }}>GST on Packing ({packingChargesGstRate === "" ? 18 : packingChargesGstRate}%):</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>₹{packingGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {/* GST on Delivery */}
                      {deliveryCharges > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ color: 'var(--gray-600)' }}>GST on Delivery ({deliveryChargesGstRate === "" ? 18 : deliveryChargesGstRate}%):</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>₹{deliveryGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {/* Total GST */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', background: 'rgba(0,0,0,0.02)', padding: '4px 0', margin: '4px 0' }}>
                        <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Total GST:</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          ₹{totalGstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {/* Grand Total */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 700,
                        fontSize: '16px',
                        paddingTop: '8px',
                        borderTop: '2px solid var(--gray-300)',
                        marginTop: '4px'
                      }}>
                        <span>Total Amount (incl. GST):</span>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--axis-primary)' }}>
                          ₹{grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Delivery Date */}
                <div className="form-group">
                  <label className="form-label">Delivery Date</label>
                  <input
                    type="date"
                    className="form-input"
                    min={today}
                    value={formData.deliveryDate}
                    onChange={(e) => { setFormData({ ...formData, deliveryDate: e.target.value }); setErrors({ ...errors, deliveryDate: "" }) }}
                    style={errors.deliveryDate ? { borderColor: '#ef4444' } : {}}
                  />
                  {errors.deliveryDate && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.deliveryDate}</p>}
                </div>


              </div>

              {/* Form Buttons - Outside form-grid for proper alignment */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--gray-200)', width: '100%' }}>
                <button type="button" className="btn btn-secondary" onClick={() => onOpenChange(false)} disabled={isLoading}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
                  ) : (
                    <>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
