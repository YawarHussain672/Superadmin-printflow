import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
// PUT /api/team/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Prevent admin from deactivating or changing their own role
    if (id === session.user.id) {
      return NextResponse.json({ error: "You cannot modify your own account" }, { status: 403 })
    }

    const { name, phone, role, active, location, branch } = await request.json()

    // Get existing user to check for changes
    const existingUser = await prisma.user.findUnique({ where: { id } })
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const nameChanged = name !== undefined && name !== existingUser.name

    const user = await prisma.user.update({
      where: { id },
      data: { name, phone, role, active, location, branch },
    })

    if (nameChanged) {
      if (user.role === "POC") {
        await prisma.project.updateMany({
          where: { pocId: id },
          data: { pocName: name },
        })
      } else if (user.role === "CLIENT") {
        await prisma.project.updateMany({
          where: { clientId: id },
          data: { clientName: name },
        })
      }
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      location: user.location,
      branch: user.branch,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
    return NextResponse.json(safeUser)
  } catch (error) {
    return NextResponse.json({ error: "Failed to update team member" }, { status: 500 })
  }
}

// DELETE /api/team/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Prevent admin from deleting themselves
    if (id === session.user.id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 403 })
    }

    // Check if permanent delete is requested (for inactive accounts)
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get("permanent") === "true"

    if (permanent) {
      // Permanent delete - only allowed for inactive accounts
      const user = await prisma.user.findUnique({ where: { id } })
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
      if (user.active) {
        return NextResponse.json({ error: "Cannot permanently delete active account. Deactivate first." }, { status: 400 })
      }

      await prisma.user.delete({ where: { id } })
      return NextResponse.json({ success: true, message: "Account permanently deleted" })
    }

    // Soft delete - just deactivate
    await prisma.user.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ success: true, message: "Account deactivated" })
  } catch (error) {
    console.error("Team member delete error:", error)
    if (error instanceof Error && error.message.includes("foreign key constraint")) {
      return NextResponse.json({ error: "Cannot delete: User has related records (projects, approvals, or activities)" }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to delete team member" }, { status: 500 })
  }
}
