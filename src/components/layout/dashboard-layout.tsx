"use client"

import { useState } from "react"
import { Sidebar } from "./sidebar"
import { TopBar } from "./top-bar"
import { NewProjectModal } from "@/components/projects/new-project-modal"

interface DashboardLayoutProps {
  children: React.ReactNode
  user?: { name: string; email: string; role: string }
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <Sidebar user={user} isOpen={sidebarOpen} />
      <main className="main-content">
        <TopBar user={user} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <div className="content-wrapper">
          {children}
        </div>
      </main>
      <NewProjectModal />
    </div>
  )
}

