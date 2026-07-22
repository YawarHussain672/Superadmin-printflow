"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Search, CreditCard, Mail, Loader2, Eye, FileText, DollarSign, Calendar, UserCheck } from "lucide-react"
import { formatDate, formatCurrency } from "@/utils/formatters"
import { StatusBadge } from "@/components/ui/status-badge"
import { CapturePaymentModal } from "@/components/projects/capture-payment-modal"

interface Collateral {
  id: string
  itemName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface FileItem {
  id: string
  type: string
  filename: string
  url: string
  uploadedAt: string
}

interface Project {
  id: string
  projectId: string
  name: string
  location: string
  state: string | null
  branch: string | null
  deliveryDate: string
  totalCost: number
  grandTotal: number
  status: string
  paymentCaptured: boolean
  paymentCapturedAt: string | null
  paymentTxnId: string | null
  poc?: { id: string; name: string; email: string; phone: string } | null
  client?: { id: string; name: string; email: string; phone: string } | null
  pocName?: string | null
  clientName?: string | null
  collaterals: Collateral[]
  files: FileItem[]
  updatedAt: string
  createdAt: string
}

interface OutstandingPaymentsClientProps {
  initialProjects: Project[]
  userRole?: string
}

export function OutstandingPaymentsClient({ initialProjects, userRole }: OutstandingPaymentsClientProps) {
  const router = useRouter()
  const isAdmin = userRole === "ADMIN"
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [searchQuery, setSearchQuery] = useState("")
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null)

  useEffect(() => {
    setProjects(initialProjects)
  }, [initialProjects])

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      p.projectId.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.poc?.name || p.pocName || "").toLowerCase().includes(q) ||
      (p.client?.name || p.clientName || "").toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q)
    )
  })

  const totalOutstandingAmount = filteredProjects.reduce(
    (sum, p) => sum + (p.grandTotal || p.totalCost * 1.18),
    0
  )

  const handleSendReminder = async (projectId: string) => {
    setSendingReminderId(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}/payment-reminder`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send payment reminder")
      toast.success(data.message || "Payment reminder sent successfully!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminder")
    } finally {
      setSendingReminderId(null)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "28px", fontWeight: 800, color: "var(--gray-900)" }}>
            Outstanding Payments
          </h1>
          <p className="page-subtitle" style={{ color: "var(--gray-600)", margin: "4px 0 0" }}>
            View and manage projects with generated Tax Invoices waiting for payment capture
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
        <div
          className="card"
          style={{
            padding: "20px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            border: "1px solid var(--gray-200)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#fef3c7",
              color: "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CreditCard size={24} />
          </div>
          <div>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-500)", textTransform: "uppercase" }}>
              Pending Payment Projects
            </span>
            <h3 style={{ margin: "2px 0 0", fontSize: "24px", fontWeight: 800, color: "var(--gray-900)" }}>
              {filteredProjects.length}
            </h3>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: "20px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)",
            border: "1px solid #a7f3d0",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#d1fae5",
              color: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <DollarSign size={24} />
          </div>
          <div>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#047857", textTransform: "uppercase" }}>
              Total Outstanding Balance
            </span>
            <h3 style={{ margin: "2px 0 0", fontSize: "24px", fontWeight: 800, color: "#065f46" }}>
              {formatCurrency(totalOutstandingAmount)}
            </h3>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: "16px 20px", borderRadius: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ position: "relative", width: "320px", maxWidth: "100%" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--gray-400)",
              }}
            />
            <input
              type="text"
              placeholder="Search project, POC, or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                paddingLeft: "36px",
                paddingRight: "12px",
                paddingTop: "8px",
                paddingBottom: "8px",
                borderRadius: "8px",
                border: "1px solid var(--gray-300)",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>

      {/* Projects List */}
      {filteredProjects.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "48px 24px",
            textAlign: "center",
            borderRadius: "14px",
            color: "var(--gray-500)",
          }}
        >
          <CreditCard size={48} style={{ margin: "0 auto 16px", color: "var(--gray-400)" }} />
          <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px", color: "var(--gray-800)" }}>
            No Outstanding Payments Found
          </h3>
          <p style={{ fontSize: "14px", margin: 0 }}>
            {searchQuery ? "No projects match your search query." : "All project payments have been successfully captured!"}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredProjects.map((project) => {
            const invoiceFile = project.files.find((f) => f.type === "INVOICE")
            const grandTotal = project.grandTotal || project.totalCost * 1.18

            return (
              <div
                key={project.id}
                className="card"
                style={{
                  padding: "20px 24px",
                  borderRadius: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  borderLeft: "4px solid #f59e0b",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                      <span className="project-id" style={{ fontSize: "14px", fontWeight: 700, color: "var(--axis-primary)" }}>
                        {project.projectId}
                      </span>
                      <StatusBadge status={project.status} />
                    </div>
                    <Link
                      href={`/projects/${project.id}`}
                      style={{ textDecoration: "none", color: "var(--gray-900)" }}
                    >
                      <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--gray-900)" }}>
                        {project.name}
                      </h3>
                    </Link>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", textTransform: "uppercase" }}>
                      Outstanding Amount
                    </span>
                    <div style={{ fontSize: "22px", fontWeight: 800, color: "#15803d", marginTop: "2px" }}>
                      {formatCurrency(grandTotal)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "12px",
                    padding: "12px 16px",
                    backgroundColor: "var(--gray-50)",
                    borderRadius: "10px",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--gray-500)", display: "block", fontSize: "11px", fontWeight: 600 }}>CLIENT</span>
                    <strong style={{ color: "var(--gray-800)" }}>{project.client?.name || project.clientName || "—"}</strong>
                    {project.branch && <span style={{ color: "var(--gray-500)" }}> ({project.branch})</span>}
                  </div>
                  <div>
                    <span style={{ color: "var(--gray-500)", display: "block", fontSize: "11px", fontWeight: 600 }}>ASSIGNED POC</span>
                    <strong style={{ color: "var(--gray-800)" }}>{project.poc?.name || project.pocName || "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "var(--gray-500)", display: "block", fontSize: "11px", fontWeight: 600 }}>TAX INVOICE</span>
                    {invoiceFile ? (
                      <a
                        href={`/api/files/${invoiceFile.id}/view`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--axis-primary)", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <FileText size={14} />
                        {invoiceFile.filename}
                      </a>
                    ) : (
                      <span style={{ color: "var(--gray-600)" }}>Generated</span>
                    )}
                  </div>
                  <div>
                    <span style={{ color: "var(--gray-500)", display: "block", fontSize: "11px", fontWeight: 600 }}>LOCATION</span>
                    <strong style={{ color: "var(--gray-800)" }}>{project.location}</strong>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", flexWrap: "wrap", paddingTop: "8px", borderTop: "1px dashed var(--gray-200)" }}>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleSendReminder(project.id)}
                      disabled={sendingReminderId === project.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        border: "1px solid var(--gray-300)",
                        backgroundColor: "white",
                        color: "var(--gray-700)",
                        fontWeight: 600,
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      {sendingReminderId === project.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Mail size={14} />
                      )}
                      Send Payment Reminder
                    </button>
                  )}

                  <CapturePaymentModal
                    projectId={project.id}
                    projectIdentifier={project.projectId}
                    projectName={project.name}
                    grandTotal={grandTotal}
                    onSuccess={() => {
                      setProjects((prev) => prev.filter((p) => p.id !== project.id))
                    }}
                  />

                  <Link
                    href={`/projects/${project.id}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1px solid var(--gray-300)",
                      backgroundColor: "var(--gray-100)",
                      color: "var(--gray-800)",
                      fontWeight: 600,
                      fontSize: "13px",
                      textDecoration: "none",
                    }}
                  >
                    <Eye size={14} />
                    View Details
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
