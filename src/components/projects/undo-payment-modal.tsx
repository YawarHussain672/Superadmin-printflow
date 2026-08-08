"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { RotateCcw, Loader2, AlertTriangle, X, CheckCircle2 } from "lucide-react"

interface UndoPaymentModalProps {
  projectId: string
  projectIdentifier: string
  projectName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  autoCloseSeconds?: number
}

export function UndoPaymentModal({
  projectId,
  projectIdentifier,
  projectName,
  open,
  onOpenChange,
  onSuccess,
  autoCloseSeconds,
}: UndoPaymentModalProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(autoCloseSeconds ?? null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || autoCloseSeconds == null) {
      setTimeLeft(autoCloseSeconds ?? null)
      return
    }

    setTimeLeft(autoCloseSeconds)
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev == null || prev <= 1) {
          clearInterval(timer)
          onOpenChange(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [open, autoCloseSeconds, onOpenChange])

  if (!open || !mounted) return null

  const handleUndo = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/undo-payment`, {
        method: "POST",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to undo payment capture")
      }

      toast.success(data.message || "Payment capture undone successfully!")
      onOpenChange(false)
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  const modalContent = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        padding: "16px",
      }}
      onClick={() => !isSubmitting && onOpenChange(false)}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--gray-200, #e2e8f0)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: timeLeft !== null 
              ? "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)" 
              : "linear-gradient(135deg, #fff5f5 0%, #ffffff 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: timeLeft !== null ? "#dcfce7" : "#fee2e2",
                color: timeLeft !== null ? "#16a34a" : "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {timeLeft !== null ? <CheckCircle2 size={22} /> : <RotateCcw size={20} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>
                {timeLeft !== null ? "Payment Captured Successfully!" : "Undo Payment Capture"}
              </h3>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                {projectIdentifier} {projectName ? `• ${projectName}` : ""}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {timeLeft !== null && (
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "9999px",
                  backgroundColor: "#ecfdf5",
                  color: "#047857",
                  border: "1px solid #a7f3d0",
                  fontSize: "11px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                Closing in {timeLeft}s...
              </span>
            )}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
              style={{
                border: "none",
                background: "transparent",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px" }}>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "10px",
              backgroundColor: timeLeft !== null ? "#eff6ff" : "#fffbeb",
              border: timeLeft !== null ? "1px solid #bfdbfe" : "1px solid #fde68a",
              display: "flex",
              gap: "12px",
              marginBottom: "20px",
            }}
          >
            <AlertTriangle size={20} style={{ color: timeLeft !== null ? "#2563eb" : "#d97706", flexShrink: 0, marginTop: "2px" }} />
            <div style={{ fontSize: "13px", color: timeLeft !== null ? "#1e40af" : "#92400e", lineHeight: 1.5 }}>
              {timeLeft !== null ? (
                <>
                  <strong>Payment recorded!</strong> If you made a mistake or want to revert, click <strong>Undo Payment</strong> below within <strong>{timeLeft} seconds</strong>.
                </>
              ) : (
                <>
                  <strong>Important:</strong> Undoing payment capture will move this project back to <strong>Pending Payment</strong> status and clear reference details.
                </>
              )}
            </div>
          </div>

          <p style={{ margin: 0, fontSize: "14px", color: "#475569", lineHeight: 1.5 }}>
            {timeLeft !== null
              ? `Payment captured for project ${projectIdentifier}. Would you like to keep it or undo?`
              : `Are you sure you want to proceed with undoing the payment capture for ${projectIdentifier}?`}
          </p>
        </div>

        {/* Modal Footer / Actions */}
        <div
          style={{
            padding: "16px 24px",
            backgroundColor: "#f8fafc",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
            style={{
              padding: "9px 20px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "var(--axis-primary, #003c71)",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "13px",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              boxShadow: "0 2px 4px rgba(0, 60, 113, 0.2)",
            }}
          >
            {timeLeft !== null ? "Okay" : "Cancel"}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleUndo}
            style={{
              padding: "9px 18px",
              borderRadius: "10px",
              border: "1px solid #fca5a5",
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              fontWeight: 600,
              fontSize: "13px",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Undoing...
              </>
            ) : (
              <>
                <RotateCcw size={16} />
                {timeLeft !== null ? `Undo Payment (${timeLeft}s)` : "Confirm Undo Payment"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return typeof window !== "undefined" ? createPortal(modalContent, document.body) : null
}
