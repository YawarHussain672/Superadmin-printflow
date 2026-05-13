"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { ProjectStatus } from "@prisma/client"

interface UpdateStatusButtonProps {
  projectId: string
  currentStatus: ProjectStatus
}

const statusFlow: Record<ProjectStatus, ProjectStatus[]> = {
  REQUESTED: ["CANCELLED"],
  APPROVED: ["PRINTING", "CANCELLED"],
  PRINTING: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
}

const statusLabels: Record<ProjectStatus, string> = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  PRINTING: "Printing",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
}

export function UpdateStatusButton({ projectId, currentStatus }: UpdateStatusButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | "">("")
  const [note, setNote] = useState("")

  const availableStatuses = statusFlow[currentStatus] || []

  const handleUpdate = async () => {
    if (!selectedStatus) {
      toast.error("Please select a status")
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selectedStatus,
          note: note || `Status updated to ${statusLabels[selectedStatus]}`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        const message = errorData.details || errorData.error || `Failed to update status (${response.status})`
        toast.error(message)
        setIsLoading(false)
        return
      }

      toast.success(`Status updated to ${statusLabels[selectedStatus]}`)
      setOpen(false)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update status"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const closeModal = () => {
    if (!isLoading) {
      setOpen(false)
      setSelectedStatus("")
      setNote("")
    }
  }

  // Don't show button if no valid transitions
  if (availableStatuses.length === 0) {
    return null
  }

  return (
    <>
      {/* Update Status Button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 16px",
          background: "#003c71",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontWeight: 600,
          fontSize: "14px",
          cursor: "pointer",
        }}
      >
        <RefreshCw size={16} />
        Update Status
      </button>

      {/* Modal Overlay */}
      {open && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={closeModal}
        >
          {/* Modal */}
          <div
            style={{
              background: "white",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "480px",
              margin: "16px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "24px 24px 0",
              }}
            >
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>
                  Update Project Status
                </h2>
                <p style={{ fontSize: "14px", color: "#6b7280" }}>
                  Current status: <strong style={{ color: "#003c71" }}>{statusLabels[currentStatus]}</strong>
                </p>
              </div>
              <button
                onClick={closeModal}
                disabled={isLoading}
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  background: "transparent",
                  borderRadius: "8px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                <X size={20} color="#6b7280" />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "24px" }}>
              {/* Status Select */}
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  New Status <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as ProjectStatus)}
                  disabled={isLoading}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "1px solid #d1d5db",
                    borderRadius: "10px",
                    fontSize: "14px",
                    background: "white",
                    cursor: isLoading ? "not-allowed" : "pointer",
                  }}
                >
                  <option value="">Select new status</option>
                  {availableStatuses.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Note Input */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "6px",
                  }}
                >
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={isLoading}
                  placeholder="Add a note about this status change..."
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "1px solid #d1d5db",
                    borderRadius: "10px",
                    fontSize: "14px",
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
                padding: "0 24px 24px",
              }}
            >
              <button
                onClick={closeModal}
                disabled={isLoading}
                style={{
                  padding: "10px 20px",
                  border: "1px solid #d1d5db",
                  background: "white",
                  color: "#374151",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={isLoading || !selectedStatus}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  background: "#003c71",
                  color: "white",
                  borderRadius: "10px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: isLoading || !selectedStatus ? "not-allowed" : "pointer",
                  opacity: isLoading || !selectedStatus ? 0.6 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
