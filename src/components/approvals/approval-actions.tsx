"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

// SVG Icons
const BellIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
)

const XIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
  </svg>
)

const LoaderIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="animate-spin">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

interface ApprovalActionsProps {
  approvalId: string
  reminderCount: number
  isAdmin: boolean
}

export function ApprovalActions({ approvalId, reminderCount, isAdmin }: ApprovalActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const handleAction = async (action: "approve" | "reject" | "reminder", notes?: string) => {
    setLoading(action)
    try {
      const res = await fetch(`/api/approvals/${approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      })

      // Log the raw response for debugging
      const responseText = await res.text()

      let data
      try {
        data = responseText ? JSON.parse(responseText) : {}
      } catch {
        data = { error: "Invalid JSON response", rawResponse: responseText.substring(0, 500) }
      }

      if (res.ok) {
        const messages = { approve: "Project approved!", reject: "Project rejected", reminder: "Reminder sent" }
        toast.success(messages[action])
        setRejectOpen(false)
        setRejectReason("")
        router.refresh()
      } else {
        toast.error(data.details || data.error || `Action failed (${res.status})`)
      }
    } catch (err) {
      toast.error("Network error. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  // Close modal
  const closeRejectModal = () => {
    setRejectOpen(false)
    setRejectReason("")
  }

  if (!isAdmin) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', flexShrink: 0 }}>
      {/* Reminder Button */}
      <button
        className="btn btn-secondary"
        onClick={() => handleAction("reminder")}
        disabled={loading !== null}
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        {loading === "reminder" ? <LoaderIcon /> : <BellIcon />}
        Reminder {reminderCount > 0 && `(${reminderCount})`}
      </button>

      {/* Reject Button */}
      <button
        className="btn btn-secondary"
        onClick={() => setRejectOpen(true)}
        disabled={loading !== null}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-error)' }}
      >
        {loading === "reject" ? <LoaderIcon /> : <XIcon />}
        Reject
      </button>

      {/* Approve Button */}
      <button
        className="btn btn-primary"
        onClick={() => handleAction("approve")}
        disabled={loading !== null}
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        {loading === "approve" ? <LoaderIcon /> : <CheckIcon />}
        Approve
      </button>

      {/* Reject Modal */}
      {rejectOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) closeRejectModal() }}
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
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid var(--gray-200)"
              }}
            >
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--gray-900)" }}>
                Reject Project
              </h2>
              <p style={{ fontSize: "14px", color: "var(--gray-500)", marginTop: "4px" }}>
                Add a clear reason so the POC can raise a revised request.
              </p>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px 32px" }}>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter a clear rejection reason so the POC can raise a revised request..."
                rows={6}
                className="form-textarea"
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '14px 16px',
                  fontSize: '15px',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  border: '1px solid var(--gray-300)',
                  borderRadius: '10px',
                  outline: 'none',
                  transition: 'border-color 150ms ease, box-shadow 150ms ease'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--axis-accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 168, 204, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--gray-300)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 32px 24px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px"
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={closeRejectModal}
                disabled={loading !== null}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={() => {
                  if (!rejectReason.trim()) {
                    toast.error("Please add a rejection reason")
                    return
                  }
                  handleAction("reject", rejectReason.trim())
                }}
                disabled={loading !== null}
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
                {loading === "reject" ? <LoaderIcon /> : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
