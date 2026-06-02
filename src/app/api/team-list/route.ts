import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const users = await prisma.user.findMany({
      where: {
        active: true,
        role: { in: ["POC", "CLIENT"] },
        ...(session.user.role === "POC" ? { id: session.user.id } : {}),
        ...(session.user.clientId ? { clientId: session.user.clientId } : {}),
      },
      select: { id: true, name: true, role: true, email: true, phone: true, location: true, branch: true },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(users)
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
