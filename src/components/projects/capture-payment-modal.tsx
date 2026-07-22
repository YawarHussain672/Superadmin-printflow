"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, CheckCircle2, CreditCard, Upload, FileText, X } from "lucide-react"

interface CapturePaymentModalProps {
  projectId: string
  projectIdentifier?: string
  projectName?: string
  grandTotal?: number
  isOpen?: boolean
  onClose?: () => void
  onSuccess?: () => void
  buttonStyle?: React.CSSProperties
  buttonClassName?: string
  showButton?: boolean
}

export function CapturePaymentModal({
  projectId,
  projectIdentifier,
  projectName,
  grandTotal,
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  onSuccess,
  buttonStyle,
  buttonClassName = "btn btn-primary",
  showButton = true,
}: CapturePaymentModalProps) {
  const router = useRouter()
  const [internalIsOpen, setInternalIsOpen] = useState(false)
  const [transactionId, setTransactionId] = useState("")
  const [notes, setNotes] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen

  const handleOpen = () => {
    if (externalIsOpen === undefined) setInternalIsOpen(true)
  }

  const handleClose = () => {
    if (externalOnClose) externalOnClose()
    else setInternalIsOpen(false)
    setTransactionId("")
    setNotes("")
    setSelectedFile(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const formData = new FormData()
      if (transactionId.trim()) formData.append("transactionId", transactionId.trim())
      if (notes.trim()) formData.append("notes", notes.trim())
      if (selectedFile) formData.append("file", selectedFile)

      const res = await fetch(`/api/projects/${projectId}/capture-payment`, {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to capture payment")
      }

      toast.success(data.message || "Payment captured successfully!")
      handleClose()
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {showButton && (
        <button
          type="button"
          className={buttonClassName}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-md, 8px)",
            padding: "8px 16px",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
            ...buttonStyle,
          }}
          onClick={handleOpen}
        >
          <CreditCard size={16} />
          Capture Payment
        </button>
      )}

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 16px",
            overflowY: "auto",
          }}
          onClick={handleClose}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "520px",
              maxHeight: "calc(100vh - 40px)",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: "1px solid var(--gray-200, #e2e8f0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    backgroundColor: "#ecfdf5",
                    color: "#059669",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--gray-900, #0f172a)" }}>
                    Capture Payment
                  </h3>
                  {projectIdentifier && (
                    <p style={{ margin: 0, fontSize: "13px", color: "var(--gray-500, #64748b)" }}>
                      {projectIdentifier} {projectName ? `• ${projectName}` : ""}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  color: "var(--gray-400, #94a3b8)",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              {grandTotal !== undefined && grandTotal > 0 && (
                <div
                  style={{
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#166534" }}>Amount Due / Paid:</span>
                  <span style={{ fontSize: "18px", fontWeight: 800, color: "#15803d" }}>
                    ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div style={{ marginBottom: "18px" }}>
                <label
                  htmlFor="transactionId"
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--gray-700, #334155)",
                    marginBottom: "6px",
                  }}
                >
                  Transaction ID / Reference No. <span style={{ fontWeight: 400, color: "#64748b" }}>(Optional)</span>
                </label>
                <input
                  id="transactionId"
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. TXN987654321 / UPI Ref / Cheque No."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--gray-300, #cbd5e1)",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Payment Receipt Upload Field */}
              <div style={{ marginBottom: "18px" }}>
                <label
                  htmlFor="receiptFile"
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--gray-700, #334155)",
                    marginBottom: "6px",
                  }}
                >
                  Upload Payment Receipt / Proof <span style={{ fontWeight: 400, color: "#64748b" }}>(Optional)</span>
                </label>
                <div
                  style={{
                    border: selectedFile ? "1px solid #10b981" : "2px dashed var(--gray-300, #cbd5e1)",
                    borderRadius: "8px",
                    padding: "14px",
                    textAlign: "center",
                    backgroundColor: selectedFile ? "#f0fdf4" : "#f8fafc",
                    position: "relative",
                    transition: "all 0.2s",
                  }}
                >
                  <input
                    id="receiptFile"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0])
                      }
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0,
                      cursor: "pointer",
                      width: "100%",
                      height: "100%",
                      zIndex: selectedFile ? 1 : 2,
                    }}
                  />
                  {selectedFile ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                        <FileText size={18} color="#059669" />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#065f46", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setSelectedFile(null)
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          padding: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          zIndex: 10,
                        }}
                        title="Remove file"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ color: "var(--gray-500, #64748b)", fontSize: "13px", pointerEvents: "none" }}>
                      <Upload size={20} style={{ margin: "0 auto 4px", display: "block", color: "var(--axis-primary, #003c71)" }} />
                      <span style={{ fontWeight: 600, color: "var(--axis-primary, #003c71)" }}>Click to select</span> or drag & drop receipt file
                      <span style={{ display: "block", fontSize: "11px", color: "var(--gray-400, #94a3b8)", marginTop: "2px" }}>
                        Supports PDF, PNG, JPG, JPEG
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label
                  htmlFor="notes"
                  style={{
                    display: "block",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--gray-700, #334155)",
                    marginBottom: "6px",
                  }}
                >
                  Payment Notes <span style={{ fontWeight: 400, color: "#64748b" }}>(Optional)</span>
                </label>
                <textarea
                  id="notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any extra details (bank name, payment mode, etc.)"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--gray-300, #cbd5e1)",
                    fontSize: "14px",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "1px solid var(--gray-300, #cbd5e1)",
                    backgroundColor: "white",
                    color: "var(--gray-700, #334155)",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Capturing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Confirm Payment Captured
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
