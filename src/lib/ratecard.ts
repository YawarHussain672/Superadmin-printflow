import { prisma } from "./prisma"
import { parseVolumeSlabs } from "./rate-card-pricing"

export async function getUnitPrice(itemName: string, quantity: number): Promise<number | null> {
  const rateCard = await prisma.rateCard.findFirst({
    where: { itemName, active: true },
    select: { volumeSlabs: true },
  })

  if (!rateCard) return null

  const slabs = parseVolumeSlabs(rateCard.volumeSlabs).sort((a, b) => a.minQty - b.minQty)
  if (slabs.length === 0) return null

  // Find the applicable slab for this quantity
  const matchingSlab = slabs.find(
    (slab) => quantity >= slab.minQty && (slab.maxQty === null || quantity <= slab.maxQty)
  )

  // Calculate effective unit price (base price + any tier discount/offset)
  // First slab is always the base price
  const basePrice = slabs[0].price

  if (matchingSlab) {
    // For subsequent slabs, the price represents the effective unit price
    // or a discount if negative
    if (slabs.indexOf(matchingSlab) === 0) {
      return basePrice
    } else {
      // For higher tiers, price can be negative (discount) or a new price
      // If negative, it's a per-unit discount from base price
      // If positive, it's the new unit price
      return matchingSlab.price < 0 ? basePrice + matchingSlab.price : matchingSlab.price
    }
  }

  // If quantity exceeds all defined ranges, use the highest tier
  const highestSlab = slabs[slabs.length - 1]
  return highestSlab.price < 0 ? basePrice + highestSlab.price : highestSlab.price
}

export async function calculateTotal(itemName: string, quantity: number): Promise<{ unitPrice: number; subtotal: number; gst: number; total: number; gstRate: number } | null> {
  const rateCard = await prisma.rateCard.findFirst({
    where: { itemName, active: true },
    select: { gstRate: true },
  })

  const unitPrice = await getUnitPrice(itemName, quantity)
  if (!unitPrice) return null

  const gstRate = rateCard?.gstRate ?? 18
  const subtotal = unitPrice * quantity
  const gst = subtotal * (gstRate / 100)
  const total = subtotal + gst

  return { unitPrice, subtotal, gst, total, gstRate }
}

/**
 * Calculate total using tiered pricing where each tier has a specific price
 * Supports large quantities (millions, billions) and tiered discounts
 */
export async function calculateTieredTotal(
  itemName: string,
  quantity: number
): Promise<{
  unitPrice: number
  basePrice: number
  tierDiscount: number
  subtotal: number
  gst: number
  total: number
  gstRate: number
  breakdown: { tier: string; qty: number; price: number; amount: number }[]
} | null> {
  const rateCard = await prisma.rateCard.findFirst({
    where: { itemName, active: true },
    select: { volumeSlabs: true, gstRate: true },
  })

  if (!rateCard) return null

  const slabs = parseVolumeSlabs(rateCard.volumeSlabs).sort((a, b) => a.minQty - b.minQty)
  if (slabs.length === 0) return null

  const basePrice = slabs[0].price
  if (basePrice < 0) return null // Base price must be positive

  // Find applicable tier
  let applicableSlab = slabs.find(
    (slab) => quantity >= slab.minQty && (slab.maxQty === null || quantity <= slab.maxQty)
  )

  // If no exact match, use highest tier
  if (!applicableSlab) {
    applicableSlab = slabs[slabs.length - 1]
  }

  // Calculate effective price
  const tierIndex = slabs.indexOf(applicableSlab)
  let effectivePrice = basePrice
  let tierDiscount = 0

  if (tierIndex > 0) {
    // Higher tier - apply discount if negative, or use new price
    if (applicableSlab.price < 0) {
      tierDiscount = applicableSlab.price // Negative value
      effectivePrice = Math.max(0, basePrice + tierDiscount) // Ensure price doesn't go below zero
    } else {
      effectivePrice = applicableSlab.price
    }
  }

  const gstRate = rateCard.gstRate ?? 18
  const subtotal = effectivePrice * quantity
  const gst = subtotal * (gstRate / 100)
  const total = subtotal + gst

  // Build breakdown for display
  const breakdown = [{
    tier: applicableSlab.slab,
    qty: quantity,
    price: effectivePrice,
    amount: subtotal
  }]

  return {
    unitPrice: effectivePrice,
    basePrice,
    tierDiscount,
    subtotal,
    gst,
    total,
    gstRate,
    breakdown
  }
}
