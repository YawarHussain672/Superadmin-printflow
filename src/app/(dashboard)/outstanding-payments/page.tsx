import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { OutstandingPaymentsClient } from "@/components/projects/outstanding-payments-client"

export default async function OutstandingPaymentsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const isAdmin = session.user.role === "ADMIN"
  const isPoc = session.user.role === "POC"
  if (!isAdmin && !isPoc) redirect("/dashboard")

  const filter = isAdmin ? {} : { pocId: session.user.id }

  // Query projects where Tax Invoice is generated and payment has not been captured
  const outstandingProjects = await prisma.project.findMany({
    where: {
      status: { not: "CANCELLED" },
      paymentCaptured: false,
      files: {
        some: {
          type: "INVOICE",
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

  return (
    <OutstandingPaymentsClient
      initialProjects={JSON.parse(JSON.stringify(outstandingProjects))}
      userRole={session.user.role}
    />
  )
}
