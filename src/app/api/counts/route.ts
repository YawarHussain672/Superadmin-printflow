import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = session.user.role === "ADMIN"
    const isSuperAdmin = session.user.role === "SUPERADMIN"
    const isPrivileged = isAdmin || isSuperAdmin
    const pocFilter = isPrivileged ? {} : { pocId: session.user.id }

    const [totalProjects, pendingApprovals, pendingPoCount, outstandingPaymentsCount] = await Promise.all([
      prisma.project.count({ where: pocFilter }),
      isPrivileged
        ? prisma.approval.count({ where: { status: "PENDING" } })
        : prisma.approval.count({ where: { status: "PENDING", requestedById: session.user.id } }),
      prisma.project.count({
        where: {
          status: { not: "CANCELLED" },
          piStatus: "VERIFIED",
          files: { none: { type: "PO" } },
          ...pocFilter,
        },
      }),
      prisma.project.count({
        where: {
          status: { not: "CANCELLED" },
          paymentCaptured: false,
          files: { some: { type: "INVOICE" } },
          ...pocFilter,
        },
      }),
    ])

    return NextResponse.json({
      totalProjects,
      pendingApprovals,
      pendingPiPo: pendingPoCount,
      pendingPo: pendingPoCount,
      outstandingPayments: outstandingPaymentsCount,
    })
  } catch (error) {
    console.error("Failed to fetch counts:", error)
    return NextResponse.json({ error: "Failed to fetch counts" }, { status: 500 })
  }
}
