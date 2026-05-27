"use client"

import { Sidebar } from "./sidebar"
import { TopBar } from "./top-bar"
import { NewProjectModal } from "@/components/projects/new-project-modal"

interface DashboardLayoutProps {
  children: React.ReactNode
  user?: { name: string; email: string; role: string }
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <main className="main-content">
        <TopBar user={user} />
        <div className="content-wrapper">
          {children}
        </div>
      </main>
      <NewProjectModal />
    </div>
  )
}
