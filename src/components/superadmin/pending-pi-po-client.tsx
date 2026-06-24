"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Download, CheckCircle, XCircle, Eye, FileText, Search, RefreshCw, Filter } from "lucide-react"
import { formatDate, formatCurrency } from "@/utils/formatters"
import { FileUploadButton } from "@/components/projects/file-upload-button"

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
  tenantClientId: string | null
  tenantClient?: { id: string; companyName: string } | null
  poc?: { id: string; name: string; email: string; phone: string } | null
  client?: { id: string; name: string; email: string; phone: string } | null
  pocName?: string | null
  clientName?: string | null
  collaterals: Collateral[]
  files: { id: string; type: string; filename: string; url: string }[]
}

interface ClientOrg {
  id: string
  companyName: string
}

interface PocUser {
  id: string
  name: string
  email: string
  clientId: string | null
}

interface ReminderSettings {
  enabled: boolean
  intervalDays: number
  lastRun: string | null
}

interface SuperAdminPendingPiPoClientProps {
  initialPendingPi: Project[]
  initialPendingPo: Project[]
  organizations: ClientOrg[]
  pocs: PocUser[]
}

export function SuperAdminPendingPiPoClient({
  initialPendingPi,
  initialPendingPo,
  organizations,
  pocs,
}: SuperAdminPendingPiPoClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"pi" | "po" | "settings">("pi")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClientId, setSelectedClientId] = useState("")
  const [selectedPocId, setSelectedPocId] = useState("")

  const [pendingPi, setPendingPi] = useState<Project[]>(initialPendingPi)
  const [pendingPo, setPendingPo] = useState<Project[]>(initialPendingPo)

  // Settings Tab state
  const [settingsOrgId, setSettingsOrgId] = useState("")
  const [settings, setSettings] = useState<ReminderSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // Direct reminder trigger state
  const [reminderPocEmail, setReminderPocEmail] = useState("")
  const [selectedReminderType, setSelectedReminderType] = useState<"BOTH" | "PI" | "PO">("BOTH")
  const [sendingDirectReminder, setSendingDirectReminder] = useState(false)
  const [sendingOrgAdminSummary, setSendingOrgAdminSummary] = useState(false)

  // Global reminder actions
  const [sendingAllPiReminders, setSendingAllPiReminders] = useState(false)
  const [sendingAllPoReminders, setSendingAllPoReminders] = useState(false)
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null)

  // Rejection modal state
  const [rejectingProjectId, setRejectingProjectId] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState("")
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  // Sync state with parent props
  useEffect(() => {
    setPendingPi(initialPendingPi)
  }, [initialPendingPi])

  useEffect(() => {
    setPendingPo(initialPendingPo)
  }, [initialPendingPo])

  // Dynamically filter POC list by selected organization in filters
  const filteredPocsForFilter = selectedClientId
    ? pocs.filter((p) => p.clientId === selectedClientId)
    : pocs

  // Dynamically filter POC list in settings tab by selected settings organization
  const filteredPocsForSettings = settingsOrgId
    ? pocs.filter((p) => p.clientId === settingsOrgId)
    : pocs

  // Load reminder settings when organization changes in settings tab
  useEffect(() => {
    if (!settingsOrgId) {
      setSettings(null)
      return
    }

    const fetchSettings = async () => {
      setLoadingSettings(true)
      try {
        const res = await fetch(`/api/settings?clientId=${settingsOrgId}`)
        if (res.ok) {
          const data = await res.json()
          setSettings(data)
        } else {
          setSettings({ enabled: false, intervalDays: 7, lastRun: null })
        }
      } catch (err) {
        console.error(err)
        toast.error("Failed to load settings")
      } finally {
        setLoadingSettings(false)
      }
    }

    fetchSettings()
  }, [settingsOrgId])

  // Filter projects by organization, POC, and text search query
  const getFilteredProjects = (projects: Project[]) => {
    let result = projects

    if (selectedClientId) {
      result = result.filter((p) => p.tenantClientId === selectedClientId)
    }

    if (selectedPocId) {
      result = result.filter((p) => p.poc?.id === selectedPocId)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.projectId.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.poc?.name || p.pocName || "").toLowerCase().includes(q) ||
          (p.tenantClient?.companyName || "").toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q)
      )
    }

    return result
  }

  const filteredPi = getFilteredProjects(pendingPi)
  const filteredPo = getFilteredProjects(pendingPo)

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

  // Send all reminders (optionally scoped to selected client filter)
  const handleSendAllReminders = async (type: "PI" | "PO") => {
    if (type === "PI") setSendingAllPiReminders(true)
    else setSendingAllPoReminders(true)
    try {
      const res = await fetch("/api/cron/send-pi-po-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          force: true,
          reminderType: type,
          clientId: selectedClientId || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || `All ${type} reminders processed successfully.`)
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
    if (!settingsOrgId) return
    setSavingSettings(true)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, intervalDays, clientId: settingsOrgId }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Settings updated successfully.")
        setSettings((prev) =>
          prev
            ? { ...prev, enabled, intervalDays }
            : { enabled, intervalDays, lastRun: null }
        )
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
        body: JSON.stringify({
          pocEmail: email,
          force: true,
          reminderType: selectedReminderType,
          clientId: settingsOrgId || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || `Reminder email sent successfully to ${email}.`)
        setReminderPocEmail("")
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

  // Send summary digest to organization administrators
  const handleSendOrgAdminSummary = async () => {
    if (!settingsOrgId) return
    setSendingOrgAdminSummary(true)
    try {
      const res = await fetch("/api/cron/send-pi-po-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: settingsOrgId,
          sendToAdminSummary: true,
          force: true
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || "Summary email sent to organization administrators.")
      } else {
        toast.error(data.error || "Failed to send summary email.")
      }
    } catch (err) {
      console.error(err)
      toast.error("Network error. Please try again.")
    } finally {
      setSendingOrgAdminSummary(false)
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

      if (res.ok) {
        data = await res.json()
        toast.success(data?.message || "PI verified successfully.")
        setPendingPi((prev) => prev.filter((p) => p.id !== projectId))
        router.refresh()
      } else {
        const text = await res.text()
        toast.error(text || errorMessage)
      }
    } catch (err) {
      console.error(err)
      toast.error("Network error. Please try again.")
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

      if (res.ok) {
        const data = await res.json()
        toast.success(data?.message || "PI rejected successfully.")
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
        router.refresh()
      } else {
        const text = await res.text()
        toast.error(text || "Failed to reject PI")
      }
    } catch (err) {
      console.error(err)
      toast.error("Network error. Please try again.")
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
    <div style={{ display: 'inline-block', minWidth: 'max-content', width: '100%', verticalAlign: 'top' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 className="page-title">SuperAdmin Pending PI/PO</h1>
          <p className="page-subtitle">Manage Proforma Invoices verification and Purchase Orders across all organization tenants</p>
        </div>
        {activeTab !== "settings" && (
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={() => handleSendAllReminders("PI")}
              disabled={sendingAllPiReminders || sendingAllPoReminders}
              className="btn btn-primary"
              style={{
                background: "linear-gradient(135deg, var(--axis-accent) 0%, #008ba3 100%)",
                boxShadow: "0 4px 12px rgba(0, 168, 204, 0.2)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                whiteSpace: "nowrap"
              }}
            >
              {sendingAllPiReminders ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
              {selectedClientId ? "Send Org PI Reminders" : "Send All PI Reminders"}
            </button>

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
              {selectedClientId ? "Send Org PO Reminders" : "Send All PO Reminders"}
            </button>
          </div>
        )}
      </div>

      {/* SuperAdmin Filtering Section */}
      {activeTab !== "settings" && (
        <div className="card" style={{ marginBottom: "24px", padding: "16px 20px" }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--gray-700)", fontWeight: 700, fontSize: "14px" }}>
              <Filter size={16} /> Filters:
            </div>
            
            {/* Organization Dropdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "220px" }}>
              <select
                className="form-select"
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value)
                  setSelectedPocId("") // Reset POC filter when organization changes
                }}
                style={{ height: "38px", margin: 0, padding: "0 12px" }}
              >
                <option value="">-- All Organizations --</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.companyName}</option>
                ))}
              </select>
            </div>

            {/* POC Dropdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "220px" }}>
              <select
                className="form-select"
                value={selectedPocId}
                onChange={(e) => setSelectedPocId(e.target.value)}
                style={{ height: "38px", margin: 0, padding: "0 12px" }}
              >
                <option value="">-- All POCs --</option>
                {filteredPocsForFilter.map((poc) => (
                  <option key={poc.id} value={poc.id}>{poc.name} ({poc.email})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Control Card with Tabs and Search */}
      <div className="card" style={{ width: "100%", marginBottom: "24px" }}>
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
              onClick={() => setActiveTab("pi")}
              style={{
                padding: "10px 16px",
                background: "none",
                border: "none",
                borderBottom: activeTab === "pi" ? "3px solid var(--axis-primary)" : "3px solid transparent",
                color: activeTab === "pi" ? "var(--axis-primary)" : "var(--gray-500)",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
                transition: "all 0.2s",
              }}
            >
              Pending PI
              <span
                style={{
                  fontSize: "11px",
                  background: activeTab === "pi" ? "var(--axis-primary)" : "var(--gray-200)",
                  color: activeTab === "pi" ? "white" : "var(--gray-600)",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontWeight: 600,
                }}
              >
                {filteredPi.length}
              </span>
            </button>
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
                {filteredPo.length}
              </span>
            </button>
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
              Reminder Control Center
            </button>
          </div>

          {/* Search Box */}
          {activeTab !== "settings" && (
            <div style={{ position: "relative", width: "260px" }}>
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
          )}
        </div>

        {/* Content Table */}
        <div style={{ overflowX: "auto" }}>
          {activeTab === "settings" ? (
            <div style={{ padding: "32px", maxWidth: "600px" }}>
              <h3 style={{ marginBottom: "12px", color: "var(--gray-900)", fontWeight: 700, fontSize: "16px" }}>
                Select Organization to Configure Settings
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Org Selector for Settings */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--gray-700)" }}>
                    Target Organization:
                  </label>
                  <select
                     className="form-select"
                     value={settingsOrgId}
                     onChange={(e) => {
                       setSettingsOrgId(e.target.value)
                       setReminderPocEmail("")
                     }}
                     style={{ padding: "8px 12px" }}
                   >
                     <option value="">-- Choose Organization --</option>
                     {organizations.map((org) => (
                       <option key={org.id} value={org.id}>{org.companyName}</option>
                     ))}
                   </select>
                </div>

                {settingsOrgId && (
                  <>
                    {loadingSettings ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--gray-500)", fontSize: "14px" }}>
                        <Loader2 size={16} className="animate-spin" /> Loading configurations...
                      </div>
                    ) : (
                      <>
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
                            Choose how often users of this tenant should receive reminders.
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
                            Last Checked / Sent Status for Org:
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--gray-600)" }}>
                            {settings?.lastRun
                              ? `Last executed on ${new Date(settings.lastRun).toLocaleString("en-IN")}`
                              : "Never executed yet."}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Send Direct Reminder to specific POC */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid var(--gray-200)", paddingTop: "20px", maxWidth: "400px" }}>
                      <div>
                        <label style={{ fontWeight: 700, fontSize: "14px", color: "var(--gray-900)", display: "block", marginBottom: "4px" }}>
                          Send On-Demand consolidated Email
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
                            value={reminderPocEmail}
                            onChange={(e) => setReminderPocEmail(e.target.value)}
                            disabled={sendingDirectReminder}
                            style={{ flex: 1, padding: "8px 12px" }}
                          >
                            <option value="">-- Select POC --</option>
                            {filteredPocsForSettings.map((u) => (
                              <option key={u.id} value={u.email}>
                                {u.name} ({u.email})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSendDirectReminder(reminderPocEmail)}
                            disabled={sendingDirectReminder || !reminderPocEmail}
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
                            Send Email
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Send Digest Summary to Org Admins (Hidden for now)
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid var(--gray-200)", paddingTop: "20px", maxWidth: "400px" }}>
                      <div>
                        <label style={{ fontWeight: 700, fontSize: "14px", color: "var(--gray-900)", display: "block", marginBottom: "4px" }}>
                          Send Organization Admin Summary
                        </label>
                        <span style={{ fontSize: "12px", color: "var(--gray-500)", lineHeight: "1.4" }}>
                          Send a consolidated summary of all pending PIs & POs (showing assigned POCs and Clients) directly to the administrators of this organization.
                        </span>
                      </div>
                      <button
                        onClick={handleSendOrgAdminSummary}
                        disabled={sendingOrgAdminSummary}
                        className="btn btn-primary"
                        style={{
                          background: "var(--axis-accent)",
                          color: "white",
                          height: "38px",
                          padding: "0 16px",
                          width: "fit-content",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        {sendingOrgAdminSummary ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                        Send Admin Summary Email
                      </button>
                    </div>
                    */}
                  </>
                )}
              </div>
            </div>
          ) : activeTab === "pi" ? (
            filteredPi.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px", color: "var(--gray-500)" }}>
                <CheckCircle size={36} color="#10b981" style={{ margin: "0 auto 12px" }} />
                <h3>No pending Proforma Invoices</h3>
                <p style={{ fontSize: "14px", marginTop: "4px" }}>All requested PIs are verified.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project Details</th>
                    <th>Assigned To</th>
                    <th>Location & Date</th>
                    <th>PI Details</th>
                    <th>Total Amount</th>
                    <th style={{ width: "260px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPi.map((project) => {
                    const collateralGst = project.collaterals.reduce(
                      (s, c) => s + c.totalPrice * ((c.gstRate ?? 18) / 100),
                      0
                    )
                    const computedGrandTotal = project.totalCost + collateralGst
                    const displayTotal = project.grandTotal > 0 ? project.grandTotal : computedGrandTotal

                    return (
                      <tr key={project.id} onClick={() => router.push(`/superadmin/projects/${project.id}`)} style={{ cursor: "pointer", transition: "background-color 0.2s" }} className="hover:bg-gray-50">
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--axis-accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                              {project.tenantClient?.companyName || "—"}
                            </span>
                            <span className="project-id" style={{ fontSize: "12px", fontFamily: "monospace" }}>
                              <Link href={`/superadmin/projects/${project.id}`} onClick={(e) => e.stopPropagation()}>{project.projectId}</Link>
                            </span>
                            <span style={{ fontWeight: 600, color: "var(--gray-900)" }}>
                              <Link href={`/superadmin/projects/${project.id}`} onClick={(e) => e.stopPropagation()}>{project.name}</Link>
                            </span>
                          </div>
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
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 500 }}>
                              {project.location}
                              {project.branch ? ` (${project.branch})` : ""}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                              Due: {formatDate(project.deliveryDate)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            {project.piNumber ? (
                              <span className="font-mono" style={{ fontWeight: 600 }}>{project.piNumber}</span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "11px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontWeight: 600,
                                  alignSelf: "flex-start",
                                  background: project.piStatus === "REJECTED" ? "#fee2e2" : "#f1f5f9",
                                  color: project.piStatus === "REJECTED" ? "#991b1b" : "#475569",
                                }}
                              >
                                {project.piStatus === "REJECTED" ? "Rejected" : "Not Generated"}
                              </span>
                            )}
                            {project.piStatus === "REJECTED" && project.piRejectionNote && (
                              <span
                                style={{
                                  fontSize: "11.5px",
                                  color: "#dc2626",
                                  marginTop: "4px",
                                  fontWeight: 600,
                                  maxWidth: "180px",
                                  wordBreak: "break-word",
                                }}
                              >
                                Reason: {project.piRejectionNote}
                              </span>
                            )}
                            {project.piGeneratedAt && (
                              <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                                Gen: {new Date(project.piGeneratedAt).toLocaleDateString("en-IN")}
                              </span>
                            )}
                          </div>
                        </td>
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
                        <td onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            {project.piPdfUrl && (
                              <>
                                <button
                                  onClick={() => handleViewPI(project)}
                                  className="btn btn-secondary"
                                  style={{ padding: "6px 10px", fontSize: "12px" }}
                                  title="View PI"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => handleDownloadPI(project)}
                                  className="btn btn-secondary"
                                  style={{ padding: "6px 10px", fontSize: "12px" }}
                                  title="Download PI"
                                >
                                  <Download size={14} />
                                </button>
                              </>
                            )}
                            {project.piStatus === "PENDING" && (
                              <>
                                <button
                                  onClick={() => handleVerifyPI(project.id)}
                                  disabled={submittingId !== null}
                                  className="btn btn-primary"
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: "12px",
                                    background: "#10b981",
                                    borderColor: "#10b981",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  title="Verify PI"
                                >
                                  {submittingId === project.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <CheckCircle size={12} />
                                  )}
                                  Verify
                                </button>
                                <button
                                  onClick={() => setRejectingProjectId(project.id)}
                                  disabled={submittingId !== null}
                                  className="btn btn-secondary"
                                  style={{
                                    padding: "6px 12px",
                                    fontSize: "12px",
                                    color: "#ef4444",
                                    borderColor: "#fee2e2",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  title="Reject PI"
                                >
                                  <XCircle size={12} />
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleSendIndividualReminder(project.id)}
                              disabled={sendingReminderId === project.id}
                              className="btn btn-secondary"
                              style={{ padding: "6px 10px", display: "flex", alignItems: "center", justifyContent: "center" }}
                              title="Send PI Reminder Email"
                            >
                              {sendingReminderId === project.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
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
                  <th>Project Details</th>
                  <th>Assigned To</th>
                  <th>Location & Date</th>
                  <th>PI Number</th>
                  <th>Total Amount</th>
                  <th style={{ width: "280px" }}>Actions / PO Upload</th>
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
                    <tr key={project.id} onClick={() => router.push(`/superadmin/projects/${project.id}`)} style={{ cursor: "pointer", transition: "background-color 0.2s" }} className="hover:bg-gray-50">
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--axis-accent)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            {project.tenantClient?.companyName || "—"}
                          </span>
                          <span className="project-id" style={{ fontSize: "12px", fontFamily: "monospace" }}>
                            <Link href={`/superadmin/projects/${project.id}`} onClick={(e) => e.stopPropagation()}>{project.projectId}</Link>
                          </span>
                          <span style={{ fontWeight: 600, color: "var(--gray-900)" }}>
                            <Link href={`/superadmin/projects/${project.id}`} onClick={(e) => e.stopPropagation()}>{project.name}</Link>
                          </span>
                        </div>
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
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>
                            {project.location}
                            {project.branch ? ` (${project.branch})` : ""}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>
                            Due: {formatDate(project.deliveryDate)}
                          </span>
                        </div>
                      </td>
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
                      <td onClick={(e) => e.stopPropagation()} style={{ cursor: "default" }}>
                        {/* Inline upload component for PO */}
                        <div style={{ padding: "4px 0" }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <div style={{ flex: 1 }}>
                              <FileUploadButton
                                projectId={project.id}
                                fileType="PO"
                                label="PO File Upload"
                                existingFiles={project.files.filter((f) => f.type === "PO")}
                                isAdmin={true}
                                canUpload={true}
                                canDelete={true}
                              />
                            </div>
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
