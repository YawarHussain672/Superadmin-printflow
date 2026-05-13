import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { calculateTotal } from "@/lib/ratecard"

// GET /api/rate-card/calculate?itemName=Flier&quantity=1000
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const itemName = searchParams.get("itemName")
    const quantity = parseInt(searchParams.get("quantity") || "0")

    if (!itemName || quantity <= 0) {
      return NextResponse.json({ error: "Invalid item name or quantity" }, { status: 400 })
    }

    const result = await calculateTotal(itemName, quantity)
    if (!result) {
      return NextResponse.json({ error: "Item not found in rate card" }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: "Failed to calculate price" }, { status: 500 })
  }
}
