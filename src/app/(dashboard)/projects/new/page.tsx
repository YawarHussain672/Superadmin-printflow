"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function NewProjectPage() {
  const router = useRouter()

  useEffect(() => {
    // Open modal and redirect back
    window.dispatchEvent(new CustomEvent("open-new-project-modal"))
    router.replace("/projects")
  }, [router])

  return null
}
