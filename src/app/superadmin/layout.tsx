import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { SuperAdminDashboardLayout } from "@/components/layout/superadmin-dashboard-layout"

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "SUPERADMIN") {
    redirect("/login")
  }

  return (
    <SuperAdminDashboardLayout user={session.user}>
      {children}
    </SuperAdminDashboardLayout>
  )
}
