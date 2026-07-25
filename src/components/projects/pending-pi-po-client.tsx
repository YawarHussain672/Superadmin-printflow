"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Download, CheckCircle, XCircle, Eye, FileText, Search, RefreshCw, FileSpreadsheet } from "lucide-react"
import { formatDate, formatCurrency } from "@/utils/formatters"
import { FileUploadButton } from "@/components/projects/file-upload-button"
import { StatusBadge } from "@/components/ui/status-badge"
import { exportToExcel } from "@/utils/excel-export"

interface Collateral {
  id: string
  itemName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  gstRate?: number | null
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
  piNumber: string | null
  piStatus: string | null
  piPdfUrl: string | null
  piGeneratedAt: string | null
  piRejectionNote?: string | null
  poc?: { id: string; name: string; email: string; phone: string } | null
  client?: { id: string; name: string; email: string; phone: string } | null
  pocName?: string | null
  clientName?: string | null
  collaterals: Collateral[]
  files: { id: string; type: string; filename: string; url: string }[]
}

interface ReminderSettings {
  enabled: boolean
  intervalDays: number
  lastRun: string | null
}

interface PendingPiPoClientProps {
  initialPendingPi: Project[]
  initialPendingPo: Project[]
  userRole?: string
  initialSettings?: ReminderSettings | null
}

export function PendingPiPoClient({ initialPendingPi, initialPendingPo, userRole, initialSettings }: PendingPiPoClientProps) {
  const router = useRouter()
  const isAdmin = userRole === "ADMIN"
  const [activeTab, setActiveTab] = useState<"po" | "settings">("po")
  const [searchQuery, setSearchQuery] = useState("")
  const [pendingPi, setPendingPi] = useState<Project[]>(initialPendingPi)
  const [pendingPo, setPendingPo] = useState<Project[]>(initialPendingPo)
  const [settings, setSettings] = useState<ReminderSettings | null>(initialSettings || null)
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null)
  const [sendingAllPiReminders, setSendingAllPiReminders] = useState(false)
  const [sendingAllPoReminders, setSendingAllPoReminders] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [selectedUserEmail, setSelectedUserEmail] = useState("")
  const [usersList, setUsersList] = useState<{ id: string; name: string; email: string; role: string; active: boolean }[]>([])
  const [sendingDirectReminder, setSendingDirectReminder] = useState(false)
  const [selectedReminderType, setSelectedReminderType] = useState<"BOTH" | "PI" | "PO">("PO")

  // Fetch active POCs for direct reminder selector
  useEffect(() => {
    if (activeTab === "settings" && usersList.length === 0) {
      fetch("/api/team")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setUsersList(data.filter((u) => u.active && u.role === "POC"))
          }
        })
        .catch(console.error)
    }
  }, [activeTab, usersList])

  // Sync state with server-side prop updates (e.g. triggered by global real-time page refreshes)
  useEffect(() => {
    setPendingPi(initialPendingPi)
  }, [initialPendingPi])

  useEffect(() => {
    setPendingPo(initialPendingPo)
  }, [initialPendingPo])

  // Rejection modal state
  const [rejectingProjectId, setRejectingProjectId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState("")

  // Loading states
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  // Filtering function
  const filterProjects = (projects: Project[]) => {
    if (!searchQuery.trim()) return projects
    const q = searchQuery.toLowerCase()
    return projects.filter(
      (p) =>
        p.projectId.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.poc?.name || p.pocName || "").toLowerCase().includes(q) ||
        (p.client?.name || p.clientName || "").toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
    )
  }

  const filteredPi = filterProjects(pendingPi)
  const filteredPo = filterProjects(pendingPo)

  // Export to Excel handler (respects applied search / POC filters)
  const handleExportExcel = async () => {
    const currentList = filteredPo
    if (currentList.length === 0) {
      toast.error("No pending PO records to export")
      return
    }

    const columns = [
      { header: "Project ID", key: "projectId", width: 18 },
      { header: "Project Name", key: "projectName", width: 26 },
      { header: "Assigned POC", key: "pocName", width: 22 },
      { header: "Client", key: "clientName", width: 22 },
      { header: "Location", key: "location", width: 18 },
      { header: "Branch", key: "branch", width: 18 },
      { header: "Delivery Date", key: "deliveryDate", width: 16 },
      { header: "PI Number", key: "piNumber", width: 18 },
      { header: "Base Cost (₹)", key: "baseCost", width: 16 },
      { header: "GST Amount (₹)", key: "gstAmount", width: 16 },
      { header: "Grand Total (₹)", key: "grandTotal", width: 18 },
      { header: "PO File Status", key: "poStatus", width: 24 },
    ]

    const data = currentList.map((p) => {
      const collateralGst = p.collaterals.reduce(
        (s, c) => s + c.totalPrice * ((c.gstRate ?? 18) / 100),
        0
      )
      const grandTotal = p.grandTotal > 0 ? p.grandTotal : p.totalCost + collateralGst
      const poFiles = p.files.filter((f) => f.type === "PO")

      return {
        projectId: p.projectId,
        projectName: p.name,
        pocName: p.poc?.name || p.pocName || "Not Assigned",
        clientName: p.client?.name || p.clientName || "Not Assigned",
        location: p.location || "—",
        branch: p.branch || "—",
        deliveryDate: p.deliveryDate ? formatDate(p.deliveryDate) : "—",
        piNumber: p.piNumber || "—",
        baseCost: p.totalCost,
        gstAmount: grandTotal - p.totalCost,
        grandTotal: grandTotal,
        poStatus: poFiles.length > 0 ? `Uploaded (${poFiles[0].filename})` : "Pending PO",
      }
    })

    await exportToExcel({
      filename: searchQuery.trim() ? `Pending_PO_Report_${searchQuery.trim().replace(/\s+/g, "_")}` : "Pending_PO_Report",
      sheetName: "Pending PO",
      columns,
      data,
    })
    toast.success(`Exported ${currentList.length} filtered Pending PO records to Excel!`)
  }

  // Send individual reminder
  const handleSendIndividualReminder = async (projectId: string) => {
    setSendingReminderId(projectId)
    try {
      const res = await fetch("/api/cron/send-pi-po-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, force: true }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Reminder sent successfully.")
      } else {
        toast.error(data.error || "Failed to send reminder.")
      }
    } catch (err) {
      console.error(err)
      toast.error("Network error. Please try again.")
    } finally {
      setSendingReminderId(null)
    }
  }

  // Send all reminders
  const handleSendAllReminders = async (type: "PI" | "PO") => {
    if (type === "PI") setSendingAllPiReminders(true)
    else setSendingAllPoReminders(true)
    try {
      const res = await fetch("/api/cron/send-pi-po-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, reminderType: type }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || `All ${type} reminders processed successfully.`)
        if (settings) {
          setSettings((prev) => prev ? { ...prev, lastRun: new Date().toISOString() } : null)
        }
      } else {
        toast.error(data.error || `Failed to send ${type} reminders.`)
      }
    } catch (err) {
      console.error(err)
      toast.error("Network error. Please try again.")
    } finally {
      if (type === "PI") setSendingAllPiReminders(false)
      else setSendingAllPoReminders(false)
    }
  }

  // Save reminder settings
  const handleSaveSettings = async (enabled: boolean, intervalDays: number) => {
    setSavingSettings(true)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, intervalDays }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Settings updated successfully.")
        setSettings((prev) => prev ? { ...prev, enabled, intervalDays } : { enabled, intervalDays, lastRun: null })
      } else {
        toast.error(data.error || "Failed to save settings.")
      }
    } catch (err) {
      console.error(err)
      toast.error("Network error. Please try again.")
    } finally {
      setSavingSettings(false)
    }
  }

  // Send direct reminder to specific email
  const handleSendDirectReminder = async (email: string) => {
    if (!email) return
    setSendingDirectReminder(true)
    try {
      const res = await fetch("/api/cron/send-pi-po-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pocEmail: email, force: true, reminderType: selectedReminderType }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || `Reminder email sent successfully to ${email}.`)
        setSelectedUserEmail("")
      } else {
        toast.error(data.error || `No pending items found for ${email}.`)
      }
    } catch (err) {
      console.error(err)
      toast.error("Network error. Please try again.")
    } finally {
      setSendingDirectReminder(false)
    }
  }

  // Verify PI Handler
  const handleVerifyPI = async (projectId: string) => {
    setSubmittingId(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}/verify-pi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify" }),
      })

      let errorMessage = "Failed to verify PI"
      let data: any = null

      const contentType = res.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        data = await res.json()
        errorMessage = data?.error || errorMessage
      } else {
        const text = await res.text()
        errorMessage = text || errorMessage
      }

      if (res.ok) {
        toast.success(data?.message || "PI verified successfully.")
        // Remove from list
        setPendingPi((prev) => prev.filter((p) => p.id !== projectId))
        // Trigger server refresh for layout/sidebar updates
        router.refresh()
      } else {
        toast.error(errorMessage)
      }
    } catch (err) {
      console.error("Verification error:", err)
      toast.error(err instanceof Error ? `Client/Network Error: ${err.message}` : "Network error. Please try again.")
    } finally {
      setSubmittingId(null)
    }
  }

  // Reject PI Handler
  const handleRejectPI = async () => {
    if (!rejectingProjectId) return
    if (!rejectNotes.trim()) {
      toast.error("Please provide a reason for rejecting the PI.")
      return
    }
    setSubmittingId(rejectingProjectId)
    try {
      const res = await fetch(`/api/projects/${rejectingProjectId}/verify-pi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", notes: rejectNotes }),
      })

      let errorMessage = "Failed to reject PI"
      let data: any = null

      const contentType = res.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        data = await res.json()
        errorMessage = data?.error || errorMessage
      } else {
        const text = await res.text()
        errorMessage = text || errorMessage
      }

      if (res.ok) {
        toast.success(data?.message || "PI rejected successfully.")
        // Keep in list and update status/note locally
        setPendingPi((prev) =>
          prev.map((p) =>
            p.id === rejectingProjectId
              ? {
                ...p,
                piStatus: "REJECTED",
                piNumber: null,
                piPdfUrl: null,
                piGeneratedAt: null,
                piRejectionNote: rejectNotes,
              }
              : p
          )
        )
        setRejectingProjectId(null)
        setRejectNotes("")
        // Trigger server refresh
        router.refresh()
      } else {
        toast.error(errorMessage)
      }
    } catch (err) {
      console.error("Rejection error:", err)
      toast.error(err instanceof Error ? `Client/Network Error: ${err.message}` : "Network error. Please try again.")
    } finally {
      setSubmittingId(null)
    }
  }

  // Generate / Regenerate PI Handler
  const handleGeneratePI = async (projectId: string) => {
    setSubmittingId(projectId)
    try {
      const res = await fetch(`/api/projects/${projectId}/generate-pi`, {
        method: "POST",
      })

      let errorMessage = "Failed to generate PI"
      let data: any = null

      const contentType = res.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        data = await res.json()
        errorMessage = data?.error || errorMessage
      } else {
        const text = await res.text()
        errorMessage = text || errorMessage
      }

      if (res.ok) {
        toast.success(data?.message || "PI generated successfully. Pending admin verification.")
        setPendingPi((prev) =>
          prev.map((p) =>
            p.id === projectId
              ? {
                ...p,
                piStatus: "PENDING",
                piNumber: data.project?.piNumber || p.piNumber,
                piPdfUrl: data.project?.piPdfUrl || p.piPdfUrl,
                piGeneratedAt: data.project?.piGeneratedAt || new Date().toISOString(),
              }
              : p
          )
        )
        router.refresh()
      } else {
        toast.error(errorMessage)
      }
    } catch (err) {
      console.error("PI Generation error:", err)
      toast.error(err instanceof Error ? `Client/Network Error: ${err.message}` : "Network error. Please try again.")
    } finally {
      setSubmittingId(null)
    }
  }

  // View PI in new tab
  const handleViewPI = (project: Project) => {
    if (project.piPdfUrl) {
      window.open(`/api/projects/${project.id}/download-pi?inline=true`, "_blank")
    }
  }

  // Download PI PDF
  const handleDownloadPI = (project: Project) => {
    const link = document.createElement("a")
    link.href = `/api/projects/${project.id}/download-pi`
    link.download = `${project.piNumber || "PI"}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("PI download started")
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 className="page-title">Pending PO</h1>
          <p className="page-subtitle">View and upload Purchase Orders (PO) for verified projects</p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={() => handleSendAllReminders("PO")}
              disabled={sendingAllPiReminders || sendingAllPoReminders}
              className="btn btn-primary"
              style={{
                background: "linear-gradient(135deg, var(--axis-primary) 0%, #002547 100%)",
                boxShadow: "0 4px 12px rgba(0, 60, 113, 0.2)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                whiteSpace: "nowrap"
              }}
            >
              {sendingAllPoReminders ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
              Send All PO Reminders
            </button>
          </div>
        )}
      </div>

      {/* Control Card with Tabs and Search */}
      <div className="card" style={{ marginBottom: "24px" }}>
        <div
          style={{
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            borderBottom: "1px solid var(--gray-200)",
          }}
        >
          {/* Tabs */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setActiveTab("po")}
              style={{
                padding: "10px 16px",
                background: "none",
                border: "none",
                borderBottom: activeTab === "po" ? "3px solid var(--axis-primary)" : "3px solid transparent",
                color: activeTab === "po" ? "var(--axis-primary)" : "var(--gray-500)",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                transition: "all 0.2s",
              }}
            >
              Pending PO
              <span
                style={{
                  fontSize: "11px",
                  background: activeTab === "po" ? "var(--axis-primary)" : "var(--gray-200)",
                  color: activeTab === "po" ? "white" : "var(--gray-600)",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontWeight: 600,
                }}
              >
                {pendingPo.length}
              </span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab("settings")}
                style={{
                  padding: "10px 16px",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === "settings" ? "3px solid var(--axis-primary)" : "3px solid transparent",
                  color: activeTab === "settings" ? "var(--axis-primary)" : "var(--gray-500)",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                Reminder Settings
              </button>
            )}
          </div>

          {/* Search Box & Export to Excel */}
          {activeTab !== "settings" && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ position: "relative", width: "240px" }}>
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
                  placeholder="Search ID, project, POC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{
                    paddingLeft: "36px",
                    marginBottom: 0,
                    fontSize: "13px",
                    height: "36px",
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleExportExcel}
                className="btn btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0 14px",
                  height: "36px",
                  fontSize: "13px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  backgroundColor: "var(--axis-primary, #003c71)",
                  color: "white",
                  border: "none",
                  boxShadow: "0 2px 6px rgba(0, 60, 113, 0.25)",
                }}
              >
                <FileSpreadsheet size={15} />
                Export to Excel
              </button>
            </div>
          )}
        </div>

        {/* Content Table */}
        <div style={{ overflowX: "auto" }}>
          {activeTab === "settings" ? (
            <div style={{ padding: "32px", maxWidth: "600px" }}>
              <h3 style={{ marginBottom: "12px", color: "var(--gray-900)", fontWeight: 700, fontSize: "16px" }}>
                Automated Email Reminder Settings
              </h3>
              <p style={{ color: "var(--gray-600)", fontSize: "14px", marginBottom: "24px", lineHeight: "1.5" }}>
                Configure Axis Print Management to automatically send reminder emails to POCs and Clients who have outstanding pending PI or PO tasks.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Enabled Toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", maxWidth: "400px" }}>
                  <div>
                    <label style={{ fontWeight: 700, display: "block", color: "var(--gray-900)", fontSize: "14px" }}>
                      Enable Recurring Reminders
                    </label>
                    <span style={{ fontSize: "12px", color: "var(--gray-500)" }}>
                      Automatically send periodic digests of outstanding items.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings?.enabled || false}
                    onChange={(e) => handleSaveSettings(e.target.checked, settings?.intervalDays || 7)}
                    disabled={savingSettings}
                    style={{
                      width: "20px",
                      height: "20px",
                      cursor: "pointer"
                    }}
                  />
                </div>

                {/* Interval Selection */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: "14px" }}>
                    Reminder Frequency
                  </label>
                  <span style={{ fontSize: "12px", color: "var(--gray-500)", marginBottom: "4px" }}>
                    Choose how often users should receive reminders for their pending tasks.
                  </span>
                  <select
                    className="form-select"
                    value={settings?.intervalDays || 7}
                    onChange={(e) => handleSaveSettings(settings?.enabled || false, parseInt(e.target.value))}
                    disabled={savingSettings}
                    style={{ maxWidth: "240px", padding: "8px 12px" }}
                  >
                    <option value={1}>Every 1 Day</option>
                    <option value={3}>Every 3 Days</option>
                    <option value={7}>Every 7 Days (Default)</option>
                    <option value={14}>Every 14 Days</option>
                  </select>
                </div>

                {/* Status Card */}
                <div
                  style={{
                    background: "var(--gray-50)",
                    border: "1px solid var(--gray-200)",
                    borderRadius: "8px",
                    padding: "16px",
                    maxWidth: "400px"
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-700)", marginBottom: "4px" }}>
                    Last Checked / Sent Status:
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--gray-600)" }}>
                    {settings?.lastRun
                      ? `Last executed on ${new Date(settings.lastRun).toLocaleString("en-IN")}`
                      : "Never executed yet."}
                  </div>
                </div>

                {/* Send Direct Reminder to specific POC */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid var(--gray-200)", paddingTop: "20px", maxWidth: "400px" }}>
                  <div>
                    <label style={{ fontWeight: 700, fontSize: "14px", color: "var(--gray-900)", display: "block", marginBottom: "4px" }}>
                      Choose POC and Send Reminder
                    </label>
                    <span style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: "1.4" }}>
                      Select a Point of Contact (POC) to immediately send them a consolidated reminder.
                    </span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-700)" }}>
                      Reminder Category:
                    </label>
                    <select
                      className="form-select"
                      value={selectedReminderType}
                      onChange={(e) => setSelectedReminderType(e.target.value as "BOTH" | "PI" | "PO")}
                      disabled={sendingDirectReminder}
                      style={{ padding: "8px 12px" }}
                    >
                      <option value="BOTH">Both PI & PO</option>
                      <option value="PI">PI Reminders Only</option>
                      <option value="PO">PO Reminders Only</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-700)" }}>
                      Select POC:
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <select
                        className="form-select"
                        value={selectedUserEmail}
                        onChange={(e) => setSelectedUserEmail(e.target.value)}
                        disabled={sendingDirectReminder}
                        style={{ flex: 1, padding: "8px 12px" }}
                      >
                        <option value="">-- Select POC --</option>
                        {usersList.map((u) => (
                          <option key={u.id} value={u.email}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSendDirectReminder(selectedUserEmail)}
                        disabled={sendingDirectReminder || !selectedUserEmail}
                        className="btn btn-primary"
                        style={{
                          background: "var(--axis-primary)",
                          color: "white",
                          height: "38px",
                          padding: "0 16px",
                          whiteSpace: "nowrap",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        {sendingDirectReminder ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                        Send Reminder
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : filteredPo.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px", color: "var(--gray-500)" }}>
              <CheckCircle size={36} color="#10b981" style={{ margin: "0 auto 12px" }} />
              <h3>No pending Purchase Orders</h3>
              <p style={{ fontSize: "14px", marginTop: "4px" }}>All verified projects have POs uploaded.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Project Name</th>
                  <th>Assigned To</th>
                  <th>Location</th>
                  <th>Delivery Date</th>
                  <th>PI Number</th>
                  <th>Total Amount</th>
                  <th style={{ width: "320px", minWidth: "280px" }}>Actions / PO Upload</th>
                </tr>
              </thead>
              <tbody>
                {filteredPo.map((project) => {
                  const collateralGst = project.collaterals.reduce(
                    (s, c) => s + c.totalPrice * ((c.gstRate ?? 18) / 100),
                    0
                  )
                  const computedGrandTotal = project.totalCost + collateralGst
                  const displayTotal = project.grandTotal > 0 ? project.grandTotal : computedGrandTotal

                  return (
                    <tr key={project.id} onClick={() => router.push(`/projects/${project.id}`)} style={{ cursor: "pointer", transition: "background-color 0.2s" }} className="hover:bg-gray-50">
                      <td className="project-id">
                        <Link href={`/projects/${project.id}`}>{project.projectId}</Link>
                      </td>
                      <td>
                        <Link href={`/projects/${project.id}`} style={{ fontWeight: 700, color: "var(--gray-900)" }}>
                          {project.name}
                        </Link>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontWeight: 600 }}>{project.poc?.name || project.pocName || "—"}</span>
                          {project.client?.name && (
                            <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                              Client: {project.client.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {project.location}
                        {project.branch ? ` (${project.branch})` : ""}
                      </td>
                      <td>{formatDate(project.deliveryDate)}</td>
                      <td className="font-mono">{project.piNumber || "—"}</td>
                      <td className="font-mono">
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ fontWeight: 700 }}>{formatCurrency(displayTotal)}</span>
                          <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                            GST: {formatCurrency(displayTotal - project.totalCost)}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                            Base: {formatCurrency(project.totalCost)}
                          </span>
                        </div>
                      </td>
                      <td onClick={(e) => e.stopPropagation()} style={{ cursor: "default", minWidth: "280px" }}>
                        {/* Inline upload component for PO */}
                        <div style={{ padding: "4px 0" }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <div style={{ flex: 1 }}>
                              <FileUploadButton
                                projectId={project.id}
                                fileType="PO"
                                label="PO File Upload"
                                existingFiles={project.files.filter((f) => f.type === "PO")}
                                isAdmin={isAdmin}
                                canUpload={true}
                                canDelete={isAdmin}
                              />
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => handleSendIndividualReminder(project.id)}
                                disabled={sendingReminderId === project.id}
                                className="btn btn-secondary"
                                style={{ padding: "8px 12px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center" }}
                                title="Send PO Reminder Email"
                              >
                                {sendingReminderId === project.id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Reject Reason Modal */}
      {rejectingProjectId && (
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
          onClick={() => {
            setRejectingProjectId(null)
            setRejectNotes("")
          }}
        >
          <div
            style={{
              background: "white",
              padding: "24px",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: 700, color: "var(--gray-900)" }}>
              Reject Proforma Invoice
            </h3>
            <p style={{ margin: "0 0 16px 0", color: "var(--gray-600)", fontSize: "14px", lineHeight: "1.5" }}>
              Please provide a reason for rejecting this PI. The POC will be notified automatically to regenerate it.
            </p>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="e.g. Total quantity mismatch, unit price update required..."
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid var(--gray-300)",
                borderRadius: "8px",
                minHeight: "120px",
                fontSize: "14px",
                marginBottom: "16px",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setRejectingProjectId(null)
                  setRejectNotes("")
                }}
                className="btn btn-secondary"
                disabled={submittingId !== null}
              >
                Cancel
              </button>
              <button
                onClick={handleRejectPI}
                disabled={submittingId !== null}
                className="btn btn-primary"
                style={{
                  background: submittingId !== null ? "var(--gray-300)" : "#dc2626",
                  borderColor: submittingId !== null ? "var(--gray-300)" : "#dc2626",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: submittingId !== null ? "not-allowed" : "pointer",
                }}
              >
                {submittingId !== null ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <XCircle size={14} />
                )}
                Reject PI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
