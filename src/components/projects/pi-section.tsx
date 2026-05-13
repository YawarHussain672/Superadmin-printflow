"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, FileText, Download, CheckCircle, XCircle, RefreshCw, Eye, FileSearch } from "lucide-react"

interface PISectionProps {
  projectId: string
  piNumber?: string | null
  piStatus?: string | null
  piPdfUrl?: string | null
  piGeneratedAt?: Date | string | null
  piVerifiedAt?: Date | string | null
  userRole: string
  userId: string
  pocId?: string | null
  clientId?: string | null
}

export function PISection({
  projectId,
  piNumber: initialPiNumber,
  piStatus: initialPiStatus,
  piPdfUrl: initialPiPdfUrl,
  piGeneratedAt: initialPiGeneratedAt,
  piVerifiedAt: initialPiVerifiedAt,
  userRole,
  userId,
  pocId,
  clientId,
}: PISectionProps) {
  const router = useRouter()
  // Local state for real-time updates
  const [piNumber, setPiNumber] = useState(initialPiNumber)
  const [piStatus, setPiStatus] = useState(initialPiStatus)
  const [piPdfUrl, setPiPdfUrl] = useState(initialPiPdfUrl)
  const [piGeneratedAt, setPiGeneratedAt] = useState(initialPiGeneratedAt)
  const [piVerifiedAt, setPiVerifiedAt] = useState(initialPiVerifiedAt)

  // Sync state with props when they change (e.g. after router.refresh())
  useEffect(() => {
    setPiNumber(initialPiNumber)
    setPiStatus(initialPiStatus)
    setPiPdfUrl(initialPiPdfUrl)
    setPiGeneratedAt(initialPiGeneratedAt)
    setPiVerifiedAt(initialPiVerifiedAt)
  }, [initialPiNumber, initialPiStatus, initialPiPdfUrl, initialPiGeneratedAt, initialPiVerifiedAt])

  const [isGenerating, setIsGenerating] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")

  const isAuthorized =
    userRole === "ADMIN" || userId === pocId || userId === clientId

  const isAdmin = userRole === "ADMIN"

  // Generate PI
  const handleGeneratePI = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-pi`, {
        method: "POST",
      })
      const data = await res.json()

      if (res.ok) {
        // Update local state immediately for real-time UI update
        setPiNumber(data.project.piNumber)
        setPiStatus(data.project.piStatus)
        setPiPdfUrl(data.project.piPdfUrl)
        setPiGeneratedAt(data.project.piGeneratedAt)
        toast.success(data.message)
      } else {
        toast.error(data.error || "Failed to generate PI")
      }
    } catch (error) {
      toast.error("Network error. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  // Verify PI (Admin only)
  const handleVerifyPI = async () => {
    setIsVerifying(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/verify-pi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      })
      const data = await res.json()

      if (res.ok) {
        // Update local state immediately
        setPiStatus(data.project.piStatus)
        setPiVerifiedAt(data.project.piVerifiedAt)
        toast.success(data.message)
      } else {
        toast.error(data.error || "Failed to verify PI")
      }
    } catch (error) {
      toast.error("Network error. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  // Reject PI (Admin only)
  const handleRejectPI = async () => {
    setIsVerifying(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/verify-pi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", notes: rejectNotes }),
      })
      const data = await res.json()

      if (res.ok) {
        // Update local state immediately
        setPiStatus(data.project.piStatus)
        setPiPdfUrl(null)
        setPiNumber(null)
        setPiGeneratedAt(null)
        setShowRejectDialog(false)
        setRejectNotes("")
        toast.success(data.message)
      } else {
        toast.error(data.error || "Failed to reject PI")
      }
    } catch (error) {
      toast.error("Network error. Please try again.")
    } finally {
      setIsVerifying(false)
    }
  }

  // View PI (open in new tab)
  const handleViewPI = () => {
    if (piPdfUrl) {
      window.open(piPdfUrl, "_blank")
    }
  }

  // Download PI (actual file download)
  const handleDownloadPI = async () => {
    if (!piPdfUrl) return

    try {
      const response = await fetch(piPdfUrl)
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${piNumber || "PI"}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success("PI downloaded successfully")
    } catch (error) {
      toast.error("Failed to download PI")
      // Fallback: open in new tab
      window.open(piPdfUrl, "_blank")
    }
  }

  // Get status badge color
  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case "VERIFIED":
        return { bg: "#dcfce7", color: "#166534", label: "✓ Verified" }
      case "REJECTED":
        return { bg: "#fee2e2", color: "#991b1b", label: "✗ Rejected" }
      case "PENDING":
      default:
        return { bg: "#fef9c3", color: "#854d0e", label: "⏳ Pending" }
    }
  }

  const statusBadge = getStatusBadge(piStatus)

  return (
    <div style={{ marginTop: "24px" }}>
      {/* PI Section Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          background: "var(--gray-50)",
          borderRadius: "8px",
          border: "1px solid var(--gray-200)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <FileText size={24} color="var(--axis-primary)" />
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--gray-900)",
              }}
            >
              Proforma Invoice (PI)
            </h3>
            {piNumber && (
              <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "var(--gray-600)" }}>
                {piNumber}
                {piGeneratedAt && (
                  <span style={{ marginLeft: "8px" }}>
                    • Generated {typeof piGeneratedAt === 'string'
                      ? new Date(piGeneratedAt).toLocaleDateString("en-GB")
                      : piGeneratedAt.toLocaleDateString("en-GB")}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        {piStatus && (
          <span
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
              background: statusBadge.bg,
              color: statusBadge.color,
            }}
          >
            {statusBadge.label}
          </span>
        )}
      </div>

      {/* Action Buttons - Compact Layout */}
      <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Row 1: Generate / View / Download Buttons */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Generate PI Button - Compact */}
          {(!piNumber || !piPdfUrl || piStatus === "REJECTED") && isAuthorized && (
            <button
              onClick={handleGeneratePI}
              disabled={isGenerating}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                color: "white",
                background: isGenerating
                  ? "#94a3b8"
                  : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                border: "none",
                borderRadius: "6px",
                cursor: isGenerating ? "not-allowed" : "pointer",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 2px 4px rgba(37, 99, 235, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
              }}
              onMouseEnter={(e) => {
                if (!isGenerating) {
                  e.currentTarget.style.transform = "translateY(-1px)"
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(37, 99, 235, 0.15), 0 2px 4px rgba(0, 0, 0, 0.08)"
                  e.currentTarget.style.filter = "brightness(1.1)"
                }
              }}
              onMouseLeave={(e) => {
                if (!isGenerating) {
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(37, 99, 235, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)"
                  e.currentTarget.style.filter = "none"
                }
              }}
            >
              {isGenerating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : piStatus === "REJECTED" ? (
                <RefreshCw size={14} />
              ) : (
                <FileText size={14} />
              )}
              {isGenerating ? "Generating..." : (piNumber && !piPdfUrl) ? "Regenerate" : piStatus === "REJECTED" ? "Regenerate" : "Generate PI"}
            </button>
          )}

          {/* View & Download Buttons Group */}
          {piPdfUrl && piStatus !== "REJECTED" && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleViewPI}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#374151",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f8fafc"
                  e.currentTarget.style.borderColor = "#cbd5e1"
                  e.currentTarget.style.transform = "translateY(-1px)"
                  e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#ffffff"
                  e.currentTarget.style.borderColor = "#e2e8f0"
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)"
                }}
              >
                <Eye size={14} />
                View
              </button>

              <button
                onClick={handleDownloadPI}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#ffffff",
                  background: "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: "0 2px 4px rgba(79, 70, 229, 0.15), 0 1px 2px rgba(0, 0, 0, 0.06)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)"
                  e.currentTarget.style.boxShadow = "0 4px 6px rgba(79, 70, 229, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1)"
                  e.currentTarget.style.filter = "brightness(1.05)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(79, 70, 229, 0.15), 0 1px 2px rgba(0, 0, 0, 0.06)"
                  e.currentTarget.style.filter = "none"
                }}
              >
                <Download size={14} />
                Download
              </button>
            </div>
          )}
        </div>

        {/* Row 2: Admin Verification Buttons */}
        {isAdmin && piStatus === "PENDING" && piPdfUrl && (
          <div 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between",
              gap: "12px", 
              padding: "12px", 
              marginTop: "12px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px" 
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "3px", height: "16px", background: "#6366f1", borderRadius: "2px" }} />
              <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: "#64748b" }}>
                Admin Review
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              {/* Verify PI */}
              <button
                onClick={handleVerifyPI}
                disabled={isVerifying}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#059669",
                  background: "#ffffff",
                  border: "1px solid #10b981",
                  borderRadius: "6px",
                  cursor: isVerifying ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 1px 2px rgba(16, 185, 129, 0.05)",
                }}
                onMouseEnter={(e) => {
                  if (!isVerifying) {
                    e.currentTarget.style.background = "#ecfdf5"
                    e.currentTarget.style.transform = "translateY(-1px)"
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isVerifying) {
                    e.currentTarget.style.background = "#ffffff"
                    e.currentTarget.style.transform = "translateY(0)"
                  }
                }}
              >
                {isVerifying ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCircle size={14} />
                )}
                Verify PI
              </button>

              {/* Reject PI */}
              <button
                onClick={() => setShowRejectDialog(true)}
                disabled={isVerifying}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#dc2626",
                  background: "#ffffff",
                  border: "1px solid #ef4444",
                  borderRadius: "6px",
                  cursor: isVerifying ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 1px 2px rgba(239, 68, 68, 0.05)",
                }}
                onMouseEnter={(e) => {
                  if (!isVerifying) {
                    e.currentTarget.style.background = "#fef2f2"
                    e.currentTarget.style.transform = "translateY(-1px)"
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isVerifying) {
                    e.currentTarget.style.background = "#ffffff"
                    e.currentTarget.style.transform = "translateY(0)"
                  }
                }}
              >
                <XCircle size={14} />
                Reject
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Reject Dialog */}
      {
        showRejectDialog && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowRejectDialog(false)}
          >
            <div
              style={{
                background: "white",
                padding: "24px",
                borderRadius: "12px",
                width: "100%",
                maxWidth: "500px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600 }}>
                Reject Proforma Invoice
              </h3>
              <p style={{ margin: "0 0 16px 0", color: "var(--gray-600)", fontSize: "14px" }}>
                Please provide a reason for rejection. The POC will be notified to regenerate the PI with corrections.
              </p>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Enter reason for rejection..."
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid var(--gray-300)",
                  borderRadius: "8px",
                  minHeight: "100px",
                  fontSize: "14px",
                  marginBottom: "16px",
                }}
              />
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowRejectDialog(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectPI}
                  disabled={isVerifying}
                  className="btn btn-primary"
                  style={{ background: "#dc2626" }}
                >
                  {isVerifying ? "Rejecting..." : "Reject PI"}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  )
}
