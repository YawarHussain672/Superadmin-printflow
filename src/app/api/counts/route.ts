import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { ProjectStatus } from "@prisma/client"
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

    const [totalProjects, pendingApprovals, pendingPiCount, pendingPoCount] = await Promise.all([
      prisma.project.count({ where: pocFilter }),
      isPrivileged
        ? prisma.approval.count({ where: { status: "PENDING" } })
        : prisma.approval.count({ where: { status: "PENDING", requestedById: session.user.id } }),
      isPrivileged
        ? prisma.project.count({
            where: {
              status: { not: "CANCELLED" },
              OR: [
                { piStatus: "PENDING" },
                { piStatus: "REJECTED" },
                { piStatus: null, piNumber: null },
              ],
            },
          })
        : prisma.project.count({
            where: {
              pocId: session.user.id,
              status: { not: "CANCELLED" },
              OR: [
                { piStatus: "PENDING" },
                { piStatus: "REJECTED" },
                { piStatus: null, piNumber: null },
              ],
            },
          }),
      prisma.project.count({
        where: {
          piStatus: "VERIFIED",
          files: { none: { type: "PO" } },
          ...pocFilter,
        },
      }),
    ])

    const pendingPiPo = pendingPiCount + pendingPoCount

    return NextResponse.json({ totalProjects, pendingApprovals, pendingPiPo })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch counts" }, { status: 500 })
  }
}
