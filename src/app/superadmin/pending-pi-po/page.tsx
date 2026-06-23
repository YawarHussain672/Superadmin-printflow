import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { basePrisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { SuperAdminPendingPiPoClient } from "@/components/superadmin/pending-pi-po-client"

export default async function SuperAdminPendingPiPoPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (session.user.role !== "SUPERADMIN") {
    redirect("/dashboard")
  }

  // Query pending PI projects globally across all tenants
  const pendingPiProjects = await basePrisma.project.findMany({
    where: {
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
      tenantClient: { select: { id: true, companyName: true } },
      collaterals: true,
      files: true,
    },
    orderBy: { updatedAt: "desc" },
  })

  // Query pending PO projects globally across all tenants
  const pendingPoProjects = await basePrisma.project.findMany({
    where: {
      piStatus: "VERIFIED",
      files: {
        none: {
          type: "PO",
        },
      },
    },
    include: {
      poc: { select: { id: true, name: true, email: true, phone: true, role: true } },
      client: { select: { id: true, name: true, email: true, phone: true, role: true } },
      tenantClient: { select: { id: true, companyName: true } },
      collaterals: true,
      files: true,
    },
    orderBy: { updatedAt: "desc" },
  })

  // Query all active organizations (tenants)
  const organizations = await basePrisma.client.findMany({
    where: { isActive: true },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  })

  // Query all active POC users
  const pocs = await basePrisma.user.findMany({
    where: { role: "POC", active: true },
    select: { id: true, name: true, email: true, clientId: true },
    orderBy: { name: "asc" },
  })

  return (
    <SuperAdminPendingPiPoClient
      initialPendingPi={JSON.parse(JSON.stringify(pendingPiProjects))}
      initialPendingPo={JSON.parse(JSON.stringify(pendingPoProjects))}
      organizations={JSON.parse(JSON.stringify(organizations))}
      pocs={JSON.parse(JSON.stringify(pocs))}
    />
  )
}
