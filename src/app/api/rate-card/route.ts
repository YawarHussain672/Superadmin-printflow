import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/rate-card
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { itemName, subcategory, specification, volumeSlabs, gstRate } = await request.json()
    if (!itemName || !specification || gstRate === undefined || gstRate === null) {
      return NextResponse.json({ error: "itemName and specification are required" }, { status: 400 })
    }

    const parsedGstRate = typeof gstRate === 'number' ? gstRate : parseFloat(gstRate)
    const finalGstRate = isNaN(parsedGstRate) ? 18.0 : parsedGstRate

    // Check for existing item with same name (including inactive/deleted)
    const existing = await prisma.rateCard.findFirst({
      where: { itemName: { equals: itemName, mode: "insensitive" } }
    })

    if (existing) {
      if (existing.active) {
        // Item is active - cannot create duplicate
        return NextResponse.json({ error: `Rate card item "${itemName}" already exists` }, { status: 400 })
      }
      // Item exists but is inactive (soft-deleted) - reactivate and update it
      const updated = await prisma.rateCard.update({
        where: { id: existing.id },
        data: {
          subcategory: subcategory || null,
          specification,
          volumeSlabs: volumeSlabs || [],
          gstRate: finalGstRate,
          active: true
        }
      })
      return NextResponse.json({ ...updated, reactivated: true }, { status: 200 })
    }

    // No existing item - create new
    const item = await prisma.rateCard.create({
      data: { itemName, subcategory: subcategory || null, specification, volumeSlabs: volumeSlabs || [], gstRate: finalGstRate, active: true },
    })
    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to create rate card item", details: errorMessage }, { status: 500 })
  }
}
