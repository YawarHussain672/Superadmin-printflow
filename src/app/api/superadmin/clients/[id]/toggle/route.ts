import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { basePrisma } from "@/lib/prisma"
import { sendTenantDeactivatedEmail } from "@/lib/email"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const client = await basePrisma.client.findUnique({
      where: { id }
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const newStatus = !client.isActive
    const updatedClient = await basePrisma.client.update({
      where: { id },
      data: { isActive: newStatus }
    })

    // Notify the client admin if organization has been suspended
    if (!newStatus) {
      try {
        const adminUser = await basePrisma.user.findFirst({
          where: { clientId: id, role: "ADMIN" }
        })
        if (adminUser) {
          await sendTenantDeactivatedEmail(adminUser.email, {
            name: adminUser.name,
            companyName: client.companyName
          })
        }
      } catch (emailErr) {
        console.error("Failed to send client deactivation email:", emailErr)
      }
    }

    return NextResponse.json({ success: true, isActive: newStatus })
  } catch (error) {
    console.error("Toggle client active status error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
