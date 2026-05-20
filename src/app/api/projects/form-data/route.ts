import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUnitPriceFromSlabs } from "@/lib/rate-card-pricing"
import { Prisma } from "@prisma/client"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // For POCs: return themselves + all clients
  // For Admins: return all POCs + all clients
  const userWhere: Prisma.UserWhereInput = session.user.role === "POC"
    ? { OR: [{ id: session.user.id }, { role: "CLIENT" as const }], active: true }
    : { role: { in: ["POC" as const, "CLIENT" as const] }, active: true }

  const [pocs, rateCards] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, email: true, role: true, phone: true, location: true, branch: true },
      orderBy: { name: "asc" },
    }),
    prisma.rateCard.findMany({
      where: { active: true },
      select: { id: true, itemName: true, volumeSlabs: true, gstRate: true },
      orderBy: { itemName: "asc" },
    }),
  ])

  return NextResponse.json({
    pocs,
    rateCards: rateCards.map((r) => ({
      id: r.id,
      name: r.itemName,
      volumeSlabs: r.volumeSlabs,
      defaultPrice: getUnitPriceFromSlabs(r.volumeSlabs, 1) ?? 0,
      gstRate: r.gstRate ?? 18,
    })),
    currentUser: {
      id: session.user.id,
      role: session.user.role,
    },
  })
}
