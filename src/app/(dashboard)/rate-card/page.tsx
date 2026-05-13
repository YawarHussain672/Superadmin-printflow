import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RateCardClient } from "@/components/rate-card/rate-card-client"

// Type matching the RateCardClient component interface
type RateCardItem = {
  id: string
  itemName: string
  subcategory: string | null
  specification: string
  volumeSlabs: unknown
  gstRate: number
  active: boolean
}

async function getRateCards(): Promise<RateCardItem[]> {
  const items = await prisma.rateCard.findMany({ where: { active: true }, orderBy: { itemName: "asc" } })
  return items.map(item => ({
    id: item.id,
    itemName: item.itemName,
    subcategory: item.subcategory,
    specification: item.specification,
    volumeSlabs: item.volumeSlabs,
    gstRate: item.gstRate,
    active: item.active,
  }))
}

export default async function RateCardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "ADMIN") redirect("/dashboard")

  const rateCards = await getRateCards()
  return <RateCardClient initialItems={rateCards} />
}
