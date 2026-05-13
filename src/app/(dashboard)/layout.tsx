import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { RealtimeProvider } from "@/components/layout/realtime-provider"
import { Session } from "next-auth"

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions) as Session | null

  if (!session) {
    redirect("/login")
  }

  return (
    <DashboardLayout user={session.user}>
      <RealtimeProvider />
      {children}
    </DashboardLayout>
  )
}
