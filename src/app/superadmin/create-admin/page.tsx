"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function CreateAdminRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/superadmin/admins")
  }, [router])
  return null
}
