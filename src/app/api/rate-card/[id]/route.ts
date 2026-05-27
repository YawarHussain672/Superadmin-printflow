import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// PUT /api/rate-card/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { itemName, subcategory, specification, volumeSlabs, gstRate, active } = await request.json()

    const parsedGstRate = typeof gstRate === 'number' ? gstRate : parseFloat(gstRate)
    const finalGstRate = isNaN(parsedGstRate) ? 18.0 : parsedGstRate

    const item = await prisma.rateCard.update({
      where: { id },
      data: { itemName, subcategory: subcategory || null, specification, volumeSlabs, gstRate: finalGstRate, active },
    })
    return NextResponse.json(item)
  } catch (error) {
    return NextResponse.json({ error: "Failed to update rate card" }, { status: 500 })
  }
}

// DELETE /api/rate-card/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    await prisma.rateCard.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete rate card item" }, { status: 500 })
  }
}
