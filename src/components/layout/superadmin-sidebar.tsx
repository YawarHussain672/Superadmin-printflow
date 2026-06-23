"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useState, useEffect } from "react"

interface SuperAdminSidebarProps {
  user?: { name: string; email: string; role: string; companyLogoUrl?: string }
}

const HomeIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
)

const UsersIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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

const PendingIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const PlusIcon = () => (
  <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
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

export function SuperAdminSidebar({ user }: SuperAdminSidebarProps) {
  const pathname = usePathname()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const initials = user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "SA"

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/")
  }

  return (
    <aside className="sidebar">
      {/* Header with Rishiraj Media Logo */}
      <div className="sidebar-header">
        <div className="logo" style={{ cursor: "default" }}>
          <img 
            src="/rm-white-logo3.svg" 
            alt="Rishiraj Media Logo" 
            className="logo-icon" 
            style={{ 
              objectFit: 'contain', 
              borderRadius: 'var(--radius-sm)', 
              background: 'transparent',
              filter: 'brightness(0) invert(1)'
            }}
          />
          <div className="logo-text">
            <h1 style={{ letterSpacing: "0.5px" }}>Rishiraj Media</h1>
            <p style={{ color: "#93c5fd" }}>SuperAdmin Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {/* Main Section */}
        <div className="nav-section">
          <div className="nav-label">Overview</div>
          <Link href="/superadmin/dashboard" className={`nav-item ${isActive("/superadmin/dashboard") ? "active" : ""}`}>
            <HomeIcon />
            Dashboard
          </Link>
          <Link href="/superadmin/admins" className={`nav-item ${isActive("/superadmin/admins") ? "active" : ""}`}>
            <UsersIcon />
            All Admins
          </Link>
          <Link href="/superadmin/projects" className={`nav-item ${isActive("/superadmin/projects") ? "active" : ""}`}>
            <FolderIcon />
            All Projects
          </Link>
          <Link href="/superadmin/approvals" className={`nav-item ${isActive("/superadmin/approvals") ? "active" : ""}`}>
            <CheckIcon />
            Approvals
          </Link>
          <Link href="/superadmin/pending-pi-po" className={`nav-item ${isActive("/superadmin/pending-pi-po") ? "active" : ""}`}>
            <PendingIcon />
            Pending PI/PO
          </Link>
          <Link href="/superadmin/dispatch" className={`nav-item ${isActive("/superadmin/dispatch") ? "active" : ""}`}>
            <TruckIcon />
            Dispatch & Tracking
          </Link>
        </div>

        {/* Management Section */}
        <div className="nav-section">
          <div className="nav-label">Management</div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("openCreateAdmin"))}
            className={`nav-item ${pathname.startsWith("/superadmin/admins") ? "active" : ""}`}
            style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <PlusIcon />
            Create Admin
          </button>
        </div>

        {/* Insights Section */}
        <div className="nav-section">
          <div className="nav-label">Insights</div>
          <Link href="/superadmin/analytics" className={`nav-item ${isActive("/superadmin/analytics") ? "active" : ""}`}>
            <ChartIcon />
            Analytics & Reports
          </Link>
        </div>
      </nav>

      {/* Footer - User Profile */}
      <div className="sidebar-footer">
        <div className="user-profile" onClick={() => setUserMenuOpen(!userMenuOpen)}>
          <div className="user-avatar" style={{ backgroundColor: "#8b5cf6" }}>{initials}</div>
          <div className="user-info">
            <h4>{user?.name || "SuperAdmin"}</h4>
            <p>SUPERADMIN</p>
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
      </div>
    </aside>
  )
}
