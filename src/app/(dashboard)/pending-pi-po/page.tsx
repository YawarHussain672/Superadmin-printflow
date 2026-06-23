import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { PendingPiPoClient } from "@/components/projects/pending-pi-po-client"

export default async function PendingPiPoPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const isAdmin = session.user.role === "ADMIN"
  const isPoc = session.user.role === "POC"
  if (!isAdmin && !isPoc) redirect("/dashboard")

  const filter = isAdmin ? {} : { pocId: session.user.id }

  // Query pending PI projects
  const pendingPiProjects = await prisma.project.findMany({
    where: isAdmin
      ? {
          status: { not: "CANCELLED" },
          OR: [
            { piStatus: "PENDING" },
            { piStatus: "REJECTED" },
            { piStatus: null, piNumber: null },
          ],
        }
      : {
          pocId: session.user.id,
          status: { not: "CANCELLED" },
          OR: [
            { piStatus: "PENDING" },
            { piStatus: "REJECTED" },
            { piStatus: null, piNumber: null },
          ],
        },
    include: {
      poc: { select: { id: true, name: true, email: true, phone: true, role: true } },
      client: { select: { id: true, name: true, email: true, phone: true, role: true } },
      collaterals: true,
      files: true,
    },
    orderBy: { updatedAt: "desc" },
  })

  // Query pending PO projects
  const pendingPoProjects = await prisma.project.findMany({
    where: {
      piStatus: "VERIFIED",
      files: {
        none: {
          type: "PO",
        },
      },
      ...filter,
    },
    include: {
      poc: { select: { id: true, name: true, email: true, phone: true, role: true } },
      client: { select: { id: true, name: true, email: true, phone: true, role: true } },
      collaterals: true,
      files: true,
    },
    orderBy: { updatedAt: "desc" },
  })

  // Query settings if admin
  let settingsConfig = null
  if (isAdmin) {
    const settings = await prisma.systemSetting.findMany()
    settingsConfig = {
      enabled: settings.find(s => s.key === "reminder_emails_enabled")?.value === "true",
      intervalDays: parseInt(settings.find(s => s.key === "reminder_emails_interval_days")?.value || "7"),
      lastRun: settings.find(s => s.key === "reminder_emails_last_run")?.value || null
    }
  }

  return (
    <PendingPiPoClient
      initialPendingPi={JSON.parse(JSON.stringify(pendingPiProjects))}
      initialPendingPo={JSON.parse(JSON.stringify(pendingPoProjects))}
      userRole={session.user.role}
      initialSettings={settingsConfig}
    />
  )
}
