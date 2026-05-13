"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"

// SVG Icons
const PlusIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
)

const EditIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const LoaderIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="animate-spin">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const CloseIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

interface Member { id: string; name: string; email?: string; phone: string; role: string; active: boolean; location?: string; branch?: string; createdAt?: Date }

interface TeamActionsProps {
  mode: "add" | "edit"
  member?: Member
  onSuccess?: (member: Member) => void
  onDelete?: (memberId: string) => void
}

interface ModalProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  onClose: () => void
}

// Modal component - defined outside to prevent recreation on renders
const Modal = ({ title, subtitle, children, onClose }: ModalProps) => {
  // Lock body scroll when modal opens
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
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
          maxWidth: "600px",
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
}

export function TeamActions({ mode, member, onSuccess, onDelete }: TeamActionsProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: member?.name || "",
    email: "",
    phone: member?.phone || "",
    role: member?.role || "POC",
    password: "",
    location: member?.location || "",
    branch: member?.branch || "",
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      const url = mode === "add" ? "/api/team" : `/api/team/${member!.id}`
      const method = mode === "add" ? "POST" : "PUT"
      const body = mode === "add" ? form : { name: form.name, phone: form.phone, role: form.role, location: form.location, branch: form.branch }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const result = await res.json()
        toast.success(mode === "add" ? "Team member added!" : "Member updated!")
        setOpen(false)
        onSuccess?.(result)
      } else {
        const text = await res.text()
        let data
        try {
          data = JSON.parse(text)
        } catch {
          data = { error: text || `HTTP ${res.status}` }
        }
        toast.error(data.error || `Failed (${res.status})`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async () => {
    if (!member) return
    setLoading(true)
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !member.active }),
      })
      if (res.ok) {
        const result = await res.json()
        toast.success(member.active ? "Member deactivated" : "Member activated")
        onSuccess?.({ ...member, active: !member.active, createdAt: member.createdAt ? new Date(member.createdAt) : undefined })
      }
    } catch {
      toast.error("Failed")
    } finally {
      setLoading(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (!member) return
    setLoading(true)
    try {
      const res = await fetch(`/api/team/${member.id}?permanent=true`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success("Member permanently deleted")
        setShowDeleteConfirm(false)
        onDelete?.(member.id)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (mode === "add") {
    return (
      <>
        <button className="btn btn-primary" onClick={() => setOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PlusIcon /> Add Team Member
        </button>

        {open && (
          <Modal title="Add Team Member" subtitle="Add a new POC or admin to the system" onClose={() => setOpen(false)}>
            <form className="form-grid" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="john@axismaxlife.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="POC">POC (Point of Contact)</option>
                  <option value="CLIENT">Client (View Only)</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 8 characters"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g., Mumbai, Delhi"
                />
              </div>
              <div className="form-group full-width">
                <label className="form-label">Branch</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  placeholder="e.g., Connaught Place Branch, Andheri Branch"
                />
              </div>
              <div className="form-group full-width" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <><LoaderIcon /> Adding...</> : "Add Member"}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {/* Edit Button */}
      <button
        className="btn btn-secondary"
        onClick={() => setOpen(true)}
        disabled={loading}
        style={{ padding: '6px 10px', fontSize: '12px' }}
      >
        <EditIcon />
      </button>

      {/* Toggle Active Button */}
      <button
        className="btn btn-secondary"
        onClick={handleToggleActive}
        disabled={loading}
        style={{ padding: '6px 10px', fontSize: '12px' }}
      >
        {loading ? <LoaderIcon /> : (member?.active ? 'Deactivate' : 'Activate')}
      </button>

      {/* Delete Button - Only show for inactive members */}
      {!member?.active && (
        <button
          className="btn btn-secondary"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={loading}
          style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--color-error)' }}
        >
          <TrashIcon />
        </button>
      )}

      {/* Edit Modal */}
      {open && (
        <Modal title="Edit Team Member" subtitle={member?.name} onClose={() => setOpen(false)}>
          <form className="form-grid" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                className="form-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                className="form-select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="POC">POC (Point of Contact)</option>
                <option value="CLIENT">Client (View Only)</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input
                type="text"
                className="form-input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g., Mumbai, Delhi"
              />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Branch</label>
              <input
                type="text"
                className="form-input"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
                placeholder="e.g., Connaught Place Branch"
              />
            </div>
            <div className="form-group full-width" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <><LoaderIcon /> Saving...</> : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false) }}
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
              maxWidth: "400px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
            }}
          >
            <div style={{ padding: "24px 32px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--color-error)", marginBottom: "8px" }}>
                Permanently Delete Account?
              </h2>
              <p style={{ fontSize: "14px", color: "var(--gray-600)" }}>
                This action cannot be undone. {member?.name}&apos;s account will be permanently removed.
              </p>
            </div>
            <div style={{ padding: "16px 32px 24px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button
                className="btn"
                onClick={handlePermanentDelete}
                disabled={loading}
                style={{
                  padding: "10px 18px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 700,
                  background: "var(--color-error)",
                  color: "white",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                {loading ? <LoaderIcon /> : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
