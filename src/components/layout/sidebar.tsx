"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import { openNewProjectModal } from "@/components/projects/new-project-modal"

interface SidebarProps {
  user?: { name: string; email: string; role: string }
  isOpen?: boolean
}

// SVG Icons matching HTML file exactly
const HomeIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)

const FolderIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

const CheckIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const TruckIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
)

const PlusIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
)

const ReceiptIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
)

const UsersIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
)

const ChartIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
)

const ChevronDownIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 'auto' }}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
)

const LogoutIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
)

export function Sidebar({ user, isOpen = true }: SidebarProps) {
  const pathname = usePathname()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [counts, setCounts] = useState({ totalProjects: 0, pendingApprovals: 0 })
  const [countsLoaded, setCountsLoaded] = useState(false)

  // Fetch real-time counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch("/api/counts")
        if (res.ok) {
          const data = await res.json()
          setCounts(data)
          setCountsLoaded(true)
        }
      } catch {
        // Silently fail, keep showing 0 or loading state
        setCountsLoaded(true)
      }
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  const isAdmin = user?.role === "ADMIN"
  const isClient = user?.role === "CLIENT"
  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "??"

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href
    return pathname === href || pathname.startsWith(href + "/")
  }

  const handleCreateProject = (e: React.MouseEvent) => {
    e.preventDefault()
    openNewProjectModal()
  }

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="logo">
          <img 
            src={(user as any)?.companyLogoUrl || "https://play-lh.googleusercontent.com/Vn9VseeV197UW8_kkGzMJY0dsORX93S2wY3j_YHeotP_GaRZ-9rf9BSeCbSjNy83fzA"} 
            alt="Logo" 
            className="logo-icon" 
            style={{ objectFit: 'cover', borderRadius: 'var(--radius-sm)', background: 'transparent' }}
          />
          <div className="logo-text">
            <h1>{(user as any)?.companyName || "Axis Max Life"}</h1>
            <p>Print Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {/* Main Section */}
        <div className="nav-section">
          <div className="nav-label">Main</div>
          <Link href="/dashboard" className={`nav-item ${isActive("/dashboard") ? "active" : ""}`}>
            <HomeIcon />
            Dashboard
          </Link>
          <Link href="/projects" className={`nav-item ${isActive("/projects") ? "active" : ""}`}>
            <FolderIcon />
            {isClient ? "My Projects" : "All Projects"}
            {countsLoaded && counts.totalProjects > 0 && !isClient && (
              <span className="nav-badge">{counts.totalProjects}</span>
            )}
          </Link>
          {isAdmin && (
            <Link href="/approvals" className={`nav-item ${isActive("/approvals") ? "active" : ""}`}>
              <CheckIcon />
              Approvals
              {countsLoaded && counts.pendingApprovals > 0 && (
                <span className="nav-badge">{counts.pendingApprovals}</span>
              )}
            </Link>
          )}
          {!isClient && (
            <Link href="/dispatch" className={`nav-item ${isActive("/dispatch") ? "active" : ""}`}>
              <TruckIcon />
              Dispatch & Tracking
            </Link>
          )}
        </div>

        {/* Management Section - Hidden for CLIENT */}
        {!isClient && (
          <div className="nav-section">
            <div className="nav-label">Management</div>
            {!isClient && (
              <a href="#" onClick={handleCreateProject} className="nav-item">
                <PlusIcon />
                Create Project
              </a>
            )}
            {isAdmin && (
              <Link href="/rate-card" className={`nav-item ${isActive("/rate-card") ? "active" : ""}`}>
                <ReceiptIcon />
                Rate Card
              </Link>
            )}
            {isAdmin && (
              <Link href="/team" className={`nav-item ${isActive("/team") ? "active" : ""}`}>
                <UsersIcon />
                Team & Roles
              </Link>
            )}
          </div>
        )}

        {/* Insights Section */}
        {isAdmin && (
          <div className="nav-section">
            <div className="nav-label">Insights</div>
            <Link href="/analytics" className={`nav-item ${isActive("/analytics") ? "active" : ""}`}>
              <ChartIcon />
              Analytics & Reports
            </Link>
          </div>
        )}
      </nav>

      {/* Footer - User Profile */}
      <div className="sidebar-footer">
        <div className="user-profile" onClick={() => setUserMenuOpen(!userMenuOpen)}>
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <h4>{user?.name || "Loading..."}</h4>
            <p>{user?.role || "..."}</p>
          </div>
          <ChevronDownIcon />
        </div>
        {userMenuOpen && (
          <div style={{ marginTop: '8px' }}>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to logout?")) {
                  signOut({ callbackUrl: "/login" })
                }
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-error)',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px'
              }}
            >
              <LogoutIcon />
              Logout
            </button>
          </div>
        )}
        <a 
          href="https://www.rishirajmedia.com/" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            marginTop: '6px',
            display: 'inline-flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            textDecoration: 'none',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Powered by
          </span>
          <img src="/rm-white-logo3.svg" alt="Logo" style={{ height: '24px', opacity: 0.8, objectFit: 'contain', filter: 'brightness(0) invert(1)', position: 'relative', top: '1px' }} />
        </a>
      </div>
    </aside>
  )
}
