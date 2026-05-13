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
    const pocFilter = isAdmin ? {} : { pocId: session.user.id }

    const [totalProjects, pendingApprovals] = await Promise.all([
      prisma.project.count({ where: pocFilter }),
      isAdmin
        ? prisma.approval.count({ where: { status: "PENDING" } })
        : prisma.approval.count({ where: { status: "PENDING", requestedById: session.user.id } }),
    ])

    return NextResponse.json({ totalProjects, pendingApprovals })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch counts" }, { status: 500 })
  }
}
