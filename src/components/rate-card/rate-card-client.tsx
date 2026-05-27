"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type VolumeSlab = { slab: string; price: number }
interface RateCardItem { id: string; itemName: string; subcategory: string | null; specification: string; volumeSlabs: unknown; gstRate: number; active: boolean }

interface RateCardClientProps { initialItems: RateCardItem[] }

// SVG Icons
const CheckIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
  </svg>
)

const PlusIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const LoaderIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="animate-spin">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const ReceiptIcon = () => (
  <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
)

const EditIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

// Modal component defined outside to prevent re-creation on state changes
interface ModalProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  onClose: () => void
}

const Modal = ({ title, subtitle, children, onClose }: ModalProps) => (
  <div
    className="modal-overlay"
    onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.6)",
      backdropFilter: "blur(4px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px"
    }}
  >
    <div
      className="modal"
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "white",
        borderRadius: "20px",
        width: "100%",
        maxWidth: "500px",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
      }}
    >
      {/* Modal Header */}
      <div
        style={{
          padding: "24px 32px",
          borderBottom: "1px solid var(--gray-200)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start"
        }}
      >
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)" }}>{title}</h2>
          {subtitle && <p style={{ fontSize: "14px", color: "var(--gray-500)", marginTop: "4px" }}>{subtitle}</p>}
        </div>
        <button
          onClick={onClose}
          style={{
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--gray-400)",
            background: "transparent",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontSize: "24px"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--gray-100)"; e.currentTarget.style.color = "var(--gray-600)" }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--gray-400)" }}
        >
          ×
        </button>
      </div>

      {/* Modal Body */}
      <div style={{ padding: "24px 32px", overflowY: "auto", flex: 1 }}>
        {children}
      </div>
    </div>
  </div>
)

export function RateCardClient({ initialItems }: RateCardClientProps) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [saving, setSaving] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [newItem, setNewItem] = useState({ itemName: "", subcategory: "", specification: "", gstRate: 18, slabs: [{ slab: "", price: 0 }] })

  // Edit existing item modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<RateCardItem | null>(null)
  const [editSlabs, setEditSlabs] = useState<VolumeSlab[]>([])

  const getSlabs = (item: RateCardItem) => item.volumeSlabs as VolumeSlab[]

  // Open edit modal for existing item
  const openEditModal = (item: RateCardItem) => {
    setEditItem(item)
    setEditSlabs([...getSlabs(item)])
    setEditModalOpen(true)
  }

  // Save edited item (name, spec, slabs)
  const saveEditedItem = async () => {
    if (!editItem) return

    // Validation: All slabs must have a valid price (not empty, not 0)
    const emptyPriceSlab = editSlabs.find(s => s.price === 0 || s.price === null || s.price === undefined)
    if (emptyPriceSlab) {
      toast.error("All slabs must have a price value (cannot be empty or 0)")
      return
    }

    // Validation: First slab price must be positive
    if (editSlabs.length > 0 && editSlabs[0].price <= 0) {
      toast.error("First slab price must be positive (greater than 0)")
      return
    }

    // Validation: All slabs must have a range
    const invalidSlab = editSlabs.find(s => !s.slab.trim())
    if (invalidSlab) {
      toast.error("All slabs must have a volume range")
      return
    }

    setSaving(editItem.id)
    try {
      const res = await fetch(`/api/rate-card/${editItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: editItem.itemName,
          subcategory: editItem.subcategory,
          specification: editItem.specification,
          volumeSlabs: editSlabs,
          gstRate: editItem.gstRate
        }),
      })
      if (res.ok) {
        toast.success(`${editItem.itemName} updated successfully!`)
        setItems(items.map(item => item.id === editItem.id ? { ...item, itemName: editItem.itemName, subcategory: editItem.subcategory, specification: editItem.specification, volumeSlabs: editSlabs, gstRate: editItem.gstRate } : item))
        setEditModalOpen(false)
        setEditItem(null)
        router.refresh()
      } else {
        toast.error("Failed to save")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setSaving(null)
    }
  }

  const deleteItem = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from rate card?`)) return
    setSaving(id)
    try {
      const res = await fetch(`/api/rate-card/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success(`${name} removed`)
        setItems(items.filter((i) => i.id !== id))
      } else {
        toast.error("Failed to remove")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setSaving(null)
    }
  }

  const addNewItem = async () => {
    // Validation: Item name and specification required
    if (!newItem.itemName.trim() || !newItem.specification.trim()) {
      toast.error("Item name and specification are required")
      return
    }

    // Validation: At least one slab required
    if (newItem.slabs.length === 0) {
      toast.error("At least one volume slab is required")
      return
    }

    // Validation: First slab price must be positive
    if (newItem.slabs[0].price < 0) {
      toast.error("First slab price must be positive (not negative)")
      return
    }

    // Validation: All slabs must have a range
    const invalidSlab = newItem.slabs.find(s => !s.slab.trim())
    if (invalidSlab) {
      toast.error("All slabs must have a volume range")
      return
    }

    setAddLoading(true)
    try {
      const res = await fetch("/api/rate-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: newItem.itemName, subcategory: newItem.subcategory, specification: newItem.specification, volumeSlabs: newItem.slabs, gstRate: newItem.gstRate }),
      })
      if (res.ok) {
        const result = await res.json()
        if (result.reactivated) {
          // Item was reactivated (was previously soft-deleted)
          setItems([...items.filter(i => i.id !== result.id), result])
          toast.success(`Item "${result.itemName}" reactivated and updated!`)
        } else {
          // New item created
          setItems([...items, result])
          toast.success("Item added!")
        }
        setAddOpen(false)
        setNewItem({ itemName: "", subcategory: "", specification: "", gstRate: 18, slabs: [{ slab: "", price: 0 }] })
        router.refresh()
      } else {
        const d = await res.json()
        const errorMsg = d.details ? `${d.error}: ${d.details}` : d.error
        toast.error(errorMsg || "Failed")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Rate Card Management</h1>
          <p className="page-subtitle">View and edit pricing for all collaterals</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" onClick={() => setAddOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusIcon /> Add Item
          </button>
        </div>
      </div>

      {/* Rate Card Table */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" id="rateCardTable">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>#</th>
                <th>Item</th>
                <th>Subcategory</th>
                <th>Specification</th>
                <th>GST %</th>
                <th>Volume Slabs & Pricing</th>
                <th style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td className="font-mono">{index + 1}</td>
                  <td><strong>{item.itemName}</strong></td>
                  <td style={{ fontSize: '13px', color: 'var(--gray-600)' }}>{item.subcategory || '-'}</td>
                  <td style={{ fontSize: '13px', color: 'var(--gray-600)' }}>{item.specification}</td>
                  <td style={{ fontSize: '13px', color: 'var(--gray-600)' }}>{item.gstRate ?? 18}%</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {getSlabs(item).slice(0, 4).map((slab, idx) => (
                        <div key={idx} style={{ background: 'var(--gray-50)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}>
                          <span style={{ color: 'var(--gray-600)' }}>{slab.slab}:</span>
                          <span
                            style={{
                              marginLeft: '4px',
                              fontWeight: 600,
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
                              color: 'var(--gray-900)'
                            }}
                          >
                            <span style={{ fontSize: '10px', fontWeight: 400 }}>₹</span>
                            {slab.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                      {getSlabs(item).length > 4 && (
                        <span style={{ color: 'var(--gray-500)', fontSize: '12px' }}>+{getSlabs(item).length - 4} more</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => openEditModal(item)}
                        disabled={saving === item.id}
                        style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--axis-accent)' }}
                      >
                        <EditIcon />
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => deleteItem(item.id, item.itemName)}
                        disabled={saving === item.id}
                        style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--color-error)' }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-400)' }}>
                    <div style={{ color: 'var(--gray-300)', marginBottom: '12px' }}>
                      <ReceiptIcon />
                    </div>
                    <p style={{ fontWeight: 500 }}>No rate card items</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {addOpen && (
        <Modal title="Add Rate Card Item" subtitle="Add a new item to the rate card" onClose={() => setAddOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!addLoading) addNewItem()
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div className="form-group">
              <label className="form-label">Item Name</label>
              <input
                type="text"
                className="form-input"
                value={newItem.itemName}
                onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                placeholder="e.g. Flier"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Subcategory</label>
              <input
                type="text"
                className="form-input"
                value={newItem.subcategory}
                onChange={(e) => setNewItem({ ...newItem, subcategory: e.target.value })}
                placeholder="e.g. Marketing Materials"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Specification</label>
              <input
                type="text"
                className="form-input"
                value={newItem.specification}
                onChange={(e) => setNewItem({ ...newItem, specification: e.target.value })}
                placeholder="e.g. A4, 90 GSM, 4+4 color"
              />
            </div>
            <div className="form-group">
              <label className="form-label">GST Rate (%)</label>
              <input
                type="number"
                className="form-input"
                value={newItem.gstRate}
                onChange={(e) => setNewItem({ ...newItem, gstRate: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 18"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label">Volume Slabs</label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setNewItem({ ...newItem, slabs: [...newItem.slabs, { slab: "", price: 0 }] })}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <PlusIcon /> Add Slab
                </button>
              </div>
              {newItem.slabs.map((slab, idx) => (
                <div key={idx} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Volume (e.g. 1000, 1000-5000)"
                      value={slab.slab}
                      onChange={(e) => {
                        // Only allow numbers and hyphen
                        const value = e.target.value.replace(/[^0-9\-]/g, '')
                        const s = [...newItem.slabs]
                        s[idx].slab = value
                        setNewItem({ ...newItem, slabs: s })
                      }}
                      style={{ width: '50%' }}
                    />
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Price ₹ (any amount)"
                      value={slab.price || ""}
                      step="0.01"
                      min="-999999999999"
                      max="999999999999"
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => {
                        const s = [...newItem.slabs]
                        s[idx].price = parseFloat(e.target.value) || 0
                        setNewItem({ ...newItem, slabs: s })
                      }}
                      onKeyPress={(e) => {
                        // Only allow numbers, decimal point, and minus sign
                        if (!/[0-9.\-]/.test(e.key)) {
                          e.preventDefault()
                        }
                      }}
                      style={{ width: '50%' }}
                    />
                    {newItem.slabs.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setNewItem({ ...newItem, slabs: newItem.slabs.filter((_, i) => i !== idx) })}
                        style={{ padding: '6px 10px', color: 'var(--color-error)' }}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    {idx === 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>✓ First slab only (positive)</span>
                    )}
                    {idx > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Can be negative</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="form-group" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={addLoading}>
                {addLoading ? <><LoaderIcon /> Adding...</> : "Add Item"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Item Modal */}
      {editModalOpen && editItem && (
        <Modal title="Edit Rate Card Item" subtitle={`Editing: ${editItem.itemName}`} onClose={() => setEditModalOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              saveEditedItem()
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div className="form-group">
              <label className="form-label">Item Name</label>
              <input
                type="text"
                className="form-input"
                value={editItem.itemName}
                onChange={(e) => setEditItem({ ...editItem, itemName: e.target.value })}
                placeholder="e.g. Flier"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Subcategory</label>
              <input
                type="text"
                className="form-input"
                value={editItem.subcategory || ''}
                onChange={(e) => setEditItem({ ...editItem, subcategory: e.target.value })}
                placeholder="e.g. Marketing Materials"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Specification</label>
              <input
                type="text"
                className="form-input"
                value={editItem.specification}
                onChange={(e) => setEditItem({ ...editItem, specification: e.target.value })}
                placeholder="e.g. A4, 90 GSM, 4+4 color"
              />
            </div>
            <div className="form-group">
              <label className="form-label">GST Rate (%)</label>
              <input
                type="number"
                className="form-input"
                value={editItem.gstRate ?? 18}
                onChange={(e) => setEditItem({ ...editItem, gstRate: parseFloat(e.target.value) || 0 })}
                placeholder="e.g. 18"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label">Volume Slabs</label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditSlabs([...editSlabs, { slab: "", price: 0 }])}
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <PlusIcon /> Add Slab
                </button>
              </div>
              {editSlabs.map((slab, idx) => (
                <div key={idx} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Volume (e.g. 1000, 1000-5000)"
                      value={slab.slab}
                      onChange={(e) => {
                        // Only allow numbers and hyphen
                        const value = e.target.value.replace(/[^0-9\-]/g, '')
                        const s = [...editSlabs]
                        s[idx].slab = value
                        setEditSlabs(s)
                      }}
                      style={{ width: '50%' }}
                    />
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Price ₹ (any amount)"
                      value={slab.price || ""}
                      step="0.01"
                      min="-999999999999"
                      max="999999999999"
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={(e) => {
                        const s = [...editSlabs]
                        s[idx].price = parseFloat(e.target.value) || 0
                        setEditSlabs(s)
                      }}
                      onKeyPress={(e) => {
                        if (!/[0-9.\-]/.test(e.key)) {
                          e.preventDefault()
                        }
                      }}
                      style={{ width: '50%' }}
                    />
                    {editSlabs.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setEditSlabs(editSlabs.filter((_, i) => i !== idx))}
                        style={{ padding: '6px 10px', color: 'var(--color-error)' }}
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    {idx === 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>✓ First slab only (positive)</span>
                    )}
                    {idx > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>Can be negative</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="form-group" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving === editItem.id}>
                {saving === editItem.id ? <><LoaderIcon /> Saving...</> : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
