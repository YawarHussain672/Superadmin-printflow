"use client"

import { Suspense } from "react"
import { ProjectsPageClient } from "@/components/projects/projects-page-client"

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">Loading...</div>}>
      <ProjectsPageClient />
    </Suspense>
  )
}
