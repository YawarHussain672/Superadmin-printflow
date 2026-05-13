"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useDebouncedCallback } from "use-debounce"
import { openNewProjectModal } from "@/components/projects/new-project-modal"
import { NotificationBell } from "./notification-bell"

interface TopBarProps {
  user?: { role: string }
}

// SVG Icons matching HTML file
const BellIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
)

const SearchIcon = () => (
  <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const ExportIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const PlusIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
)

const LoaderIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="animate-spin">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

export function TopBar({ user }: TopBarProps) {
  const router = useRouter()
  const [exporting, setExporting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{ id: string; projectId: string; name: string; status: string; location: string }[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const isAdmin = user?.role === "ADMIN"

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const doSearch = useDebouncedCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setSearchOpen(false); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/projects?search=${encodeURIComponent(q)}&limit=6`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.projects || [])
        setSearchOpen(true)
      }
    } catch { /* silent */ } finally {
      setSearching(false)
    }
  }, 350)

  const statusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      REQUESTED: "status-badge status-requested",
      APPROVED: "status-badge status-approved",
      PRINTING: "status-badge status-printing",
      DISPATCHED: "status-badge status-dispatched",
      DELIVERED: "status-badge status-delivered",
      CANCELLED: "status-badge status-cancelled",
    }
    return classes[status] || "status-badge"
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch("/api/export?type=projects")
      if (!res.ok) throw new Error("Failed to fetch")
      const { data } = await res.json()

      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      const pageW = doc.internal.pageSize.getWidth()

      doc.setFillColor(0, 60, 113)
      doc.rect(0, 0, pageW, 24, "F")
      doc.setTextColor(255, 255, 255)

      // Left: Company name and system name
      doc.setFontSize(13)
      doc.setFont("helvetica", "bold")
      doc.text("AXIS MAX LIFE", 14, 11)
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.text("Print Project Management System", 14, 16)

      // Center: Report title
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("Projects Report", pageW / 2, 13, { align: "center" })

      // Right: Date
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.text(`Generated: ${date}`, pageW - 14, 11, { align: "right" })

      autoTable(doc, {
        head: [["Project ID", "Name", "POC", "Location", "Status", "Delivery Date", "Cost"]],
        body: data.map((p: { 
          projectId: string; 
          name: string; 
          poc?: { name: string }; 
          client?: { name: string };
          location: string; 
          status: string; 
          deliveryDate: string; 
          totalCost: number 
        }) => [
          p.projectId,
          p.name.slice(0, 30),
          p.poc?.name 
            ? `${p.poc.name} (POC)${p.client?.name ? `\non behalf of\n${p.client.name} (CLIENT)` : ''}`
            : (p.client?.name ? `${p.client.name} (CLIENT)` : "—"),
          p.location,
          p.status,
          new Date(p.deliveryDate).toLocaleDateString("en-IN"),
          `Rs. ${p.totalCost.toLocaleString("en-US")}`,
        ]),
        startY: 28,
        styles: { fontSize: 8, cellPadding: 3, valign: "middle" },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        columnStyles: {
          2: { cellWidth: 50 }, // Give POC column more width for multiline
        },
        margin: { left: 14, right: 14 },
      })

      doc.save(`Projects_Report_${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("Report downloaded!")
    } catch {
      toast.error("Export failed")
    } finally {
      setExporting(false)
    }
  }

  return (
    <header className="top-bar">
      {/* Search */}
      <div className="search-bar" ref={searchRef}>
        <SearchIcon />
        <input
          type="text"
          className="search-input"
          placeholder="Search projects, locations, tracking IDs..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); doSearch(e.target.value) }}
          onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
        />
        {searching && (
          <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            <LoaderIcon />
          </div>
        )}

        {/* Dropdown results */}
        {searchOpen && searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid var(--gray-200)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 50,
            overflow: 'hidden'
          }}>
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => { router.push(`/projects/${p.id}`); setSearchOpen(false); setSearchQuery("") }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--gray-100)',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--gray-50)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-900)' }}>{p.name}</p>
                  <p className="font-mono" style={{ fontSize: '12px', color: 'var(--gray-500)' }}>{p.projectId} · {p.location}</p>
                </div>
                <span className={statusBadgeClass(p.status)}>
                  <span className="status-dot"></span>
                  {p.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="top-actions">
        {/* Notification Button - All roles */}
        <NotificationBell />

        {/* Export Button - Admin and POC only */}
        {user?.role !== "CLIENT" && (
          <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? <LoaderIcon /> : <ExportIcon />}
            Export
          </button>
        )}

        {/* New Project Button - Admin and POC only */}
        {user?.role !== "CLIENT" && (
          <button className="btn btn-primary" onClick={openNewProjectModal}>
            <PlusIcon />
            New Project
          </button>
        )}
      </div>
    </header>
  )
}
