"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Sidebar } from "./sidebar"
import { TopBar } from "./top-bar"
import { NewProjectModal } from "@/components/projects/new-project-modal"

interface DashboardLayoutProps {
  children: React.ReactNode
  user?: { name: string; email: string; role: string }
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  const router = useRouter()

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 10000) // 10 seconds

    return () => clearInterval(interval)
  }, [router])

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
