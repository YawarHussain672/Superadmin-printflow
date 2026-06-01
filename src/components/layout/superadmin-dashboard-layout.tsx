"use client"

import { useState } from "react"
import { SuperAdminSidebar } from "./superadmin-sidebar"
import { TopBar } from "./top-bar"
import { CreateAdminModal } from "@/components/superadmin/create-admin-modal"

interface SuperAdminDashboardLayoutProps {
  children: React.ReactNode
  user?: { name: string; email: string; role: string }
}

export function SuperAdminDashboardLayout({ children, user }: SuperAdminDashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <SuperAdminSidebar user={user} />
      <main className="main-content">
        <TopBar user={user} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <div className="content-wrapper">
          {children}
        </div>
      </main>

      {/* Global Create Admin Modal — triggered by openCreateAdmin custom event */}
      <CreateAdminModal />
    </div>
  )
}
