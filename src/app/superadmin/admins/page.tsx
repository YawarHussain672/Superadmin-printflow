"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Search, ToggleLeft, ToggleRight, Building, Plus, Eye, Copy, Check, Trash2 } from "lucide-react"
import { useDebounce } from "use-debounce"
import { toast } from "sonner"

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success("Copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy.")
    }
  }

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="copy-button-hover"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px",
        borderRadius: "4px",
        color: copied ? "#10b981" : "#9ca3af",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        verticalAlign: "middle",
        marginLeft: "6px"
      }}
      title="Copy to clipboard"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

interface Client {
  id: string
  companyName: string
  companyLogoUrl: string | null
  clientEmail: string
  passwordText: string | null
  location: string
  branchLocation: string | null
  state: string
  isActive: boolean
  createdAt: string
  users: { id: string }[]
  projects: { totalCost: number; status: string }[]
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", "Jammu and Kashmir", "Ladakh", "Puducherry"
]

function AdminsInner() {
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState("")
  const [selectedState, setSelectedState] = useState("")
  const [debouncedSearch] = useDebounce(search, 300)
  const [isLoading, setIsLoading] = useState(true)
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

  // If navigated here with ?create=1, fire the global modal event
  useEffect(() => {
    if (searchParams.get("create") === "1") {
      window.dispatchEvent(new CustomEvent("openCreateAdmin"))
      // Clean the URL param without navigating
      const url = new URL(window.location.href)
      url.searchParams.delete("create")
      window.history.replaceState({}, "", url.toString())
    }
  }, [searchParams])

  const fetchClients = async (showLoader = true) => {
    if (showLoader) setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.append("search", debouncedSearch)
      if (selectedState) params.append("state", selectedState)
      const res = await fetch(`/api/superadmin/clients?${params.toString()}`)
      if (res.ok) { const data = await res.json(); setClients(data.clients) }
      else if (showLoader) toast.error("Failed to load clients.")
    } catch { if (showLoader) toast.error("Failed to load clients.") }
    finally { if (showLoader) setIsLoading(false) }
  }

  useEffect(() => { 
    fetchClients(true) 
    const interval = setInterval(() => fetchClients(false), 10000)
    return () => clearInterval(interval)
  }, [debouncedSearch, selectedState])

  // Refresh list when a new admin is created via the global modal
  useEffect(() => {
    const handler = () => fetchClients(true)
    window.addEventListener("refreshAdminsList", handler)
    return () => window.removeEventListener("refreshAdminsList", handler)
  }, [])

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setTogglingIds(prev => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/superadmin/clients/${id}/toggle`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setClients(prev => prev.map(c => c.id === id ? { ...c, isActive: data.isActive } : c))
        toast.success(`Client ${data.isActive ? "activated" : "deactivated"} successfully.`)
      } else {
        const errData = await res.json()
        toast.error(errData.error || "Failed to update client.")
      }
    } catch { toast.error("Failed to update client.") }
    finally { setTogglingIds(prev => { const n = new Set(prev); n.delete(id); return n }) }
  }

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete the organization "${name}"? This will delete all users, projects, and files associated with it.`)) {
      return
    }

    setDeletingIds(prev => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/superadmin/clients/${id}`, { method: "DELETE" })
      if (res.ok) {
        setClients(prev => prev.filter(c => c.id !== id))
        toast.success(`Organization "${name}" deleted successfully.`)
      } else {
        const errData = await res.json()
        toast.error(errData.error || "Failed to delete organization.")
      }
    } catch {
      toast.error("Failed to delete organization.")
    } finally {
      setDeletingIds(prev => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    }
  }

  return (
    <div style={{ display: 'inline-block', minWidth: 'max-content', width: '100%', verticalAlign: 'top' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title">Manage Admins</h1>
          <p className="page-subtitle">Configure tenant client organizations, status toggles, and view-only profiles.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => window.dispatchEvent(new CustomEvent("openCreateAdmin"))}
          style={{ display: "flex", alignItems: "center", gap: "8px" }}
        >
          <Plus size={16} /> Create Admin
        </button>
      </div>

      <div style={{ minWidth: '1200px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Filters */}
        <div className="card" style={{ padding: "16px", margin: 0 }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ width: "320px", position: "relative" }}>
            <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)" }} />
            <input
              type="text" placeholder="Search by company name, email, city..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "10px 12px 10px 40px", border: "1px solid var(--gray-200)", borderRadius: "8px", fontSize: "14px", outline: "none", fontFamily: "var(--font-sans)" }}
            />
          </div>
          <div style={{ minWidth: "200px" }}>
            <select
              value={selectedState} onChange={e => setSelectedState(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--gray-200)", borderRadius: "8px", fontSize: "14px", outline: "none", fontFamily: "var(--font-sans)", backgroundColor: "white" }}
            >
              <option value="">Filter by State (All)</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

        {/* Table */}
        <div className="card" style={{ margin: 0 }}>
        {isLoading ? (
          <div style={{ padding: "80px 0", textAlign: "center", color: "var(--gray-400)" }}>
            <div className="spinner" style={{ margin: "0 auto 12px" }} />
            Loading admin accounts...
          </div>
        ) : (
          <div>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>Logo</th>
                  <th>Company Name</th>
                  <th>Admin Email</th>
                  <th>Password</th>
                  <th>Location</th>
                  <th>State</th>
                  <th>Users</th>
                  <th>Projects</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right", width: "180px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "60px", color: "var(--gray-400)" }}>
                      <Building size={48} style={{ margin: "0 auto 12px", strokeWidth: 1.5, color: "var(--gray-300)" }} />
                      <p style={{ fontWeight: 500 }}>No admin accounts found</p>
                      <p style={{ fontSize: "13px", marginTop: "4px" }}>Try refining your search or state filters.</p>
                    </td>
                  </tr>
                ) : (
                  clients.map(client => {
                    const isToggling = togglingIds.has(client.id)
                    return (
                      <tr key={client.id} style={{ opacity: isToggling ? 0.6 : 1 }}>
                        <td>
                          <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid var(--gray-200)" }}>
                            {client.companyLogoUrl
                              ? <img src={client.companyLogoUrl} alt={client.companyName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--gray-500)" }}>{client.companyName.slice(0, 2).toUpperCase()}</span>
                            }
                          </div>
                        </td>
                        <td>
                          <Link href={`/superadmin/admins/${client.id}`} style={{ fontWeight: 600, color: "var(--gray-900)", textDecoration: "none" }} className="hover-underline">
                            {client.companyName}
                          </Link>
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <span>{client.clientEmail}</span>
                            <CopyButton text={client.clientEmail} />
                          </div>
                        </td>
                        <td style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}>
                          {client.passwordText ? (
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <span>{client.passwordText}</span>
                              <CopyButton text={client.passwordText} />
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{client.location}</td>
                        <td>{client.state}</td>
                        <td>{client.users.length}</td>
                        <td>{client.projects.length}</td>
                        <td>
                          <span className={`status-badge ${client.isActive ? "status-delivered" : "status-cancelled"}`}>
                            <span className="status-dot" />
                            {client.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", alignItems: "center" }}>
                            <Link href={`/superadmin/admins/${client.id}`}>
                              <button className="btn btn-secondary" style={{ padding: "6px 12px", display: "flex", alignItems: "center", gap: "4px" }}>
                                <Eye size={14} /> View
                              </button>
                            </Link>
                            <button
                              className={`btn ${client.isActive ? "btn-secondary" : "btn-primary"}`}
                              onClick={() => handleToggleActive(client.id, client.isActive)}
                              disabled={isToggling || deletingIds.has(client.id)}
                              style={{
                                padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px",
                                border: client.isActive ? "1px solid var(--color-error)" : undefined,
                                color: client.isActive ? "var(--color-error)" : undefined,
                                background: client.isActive ? "rgba(239,68,68,0.05)" : undefined,
                              }}
                            >
                              {client.isActive ? <><ToggleLeft size={16} />Suspend</> : <><ToggleRight size={16} />Activate</>}
                            </button>
                            <button
                              className="btn"
                              onClick={() => handleDeleteClient(client.id, client.companyName)}
                              disabled={isToggling || deletingIds.has(client.id)}
                              style={{
                                padding: "6px 12px", display: "flex", alignItems: "center", gap: "6px",
                                border: "1px solid #ef4444",
                                color: "white",
                                background: "#ef4444",
                                cursor: "pointer",
                                borderRadius: "6px",
                                fontSize: "14px",
                                fontWeight: 500
                              }}
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      <style>{`
        .hover-underline:hover { text-decoration: underline !important; }
        .spinner { width: 24px; height: 24px; border: 3px solid var(--gray-200); border-top: 3px solid #002a52; border-radius: 50%; animation: spin 1s linear infinite; }
        .copy-button-hover:hover { background-color: var(--gray-100, #f3f4f6); color: var(--gray-700, #374151) !important; }
        @keyframes spin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

export default function AdminsPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>Loading...</div>}>
      <AdminsInner />
    </Suspense>
  )
}
