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

  const basePrice = slabs[0].price

  // Check if any slab has a negative price (discount-style pricing)
  const hasNegativePrices = slabs.some(s => s.price < 0)

  if (hasNegativePrices) {
    // Discount-style: find highest matching slab, apply discount from base
    let matchedSlabIndex = -1
    for (let i = 0; i < slabs.length; i++) {
      const slab = slabs[i]
      const inRange = slab.maxQty !== null
        ? quantity >= slab.minQty && quantity <= slab.maxQty
        : quantity >= slab.minQty
      if (inRange) matchedSlabIndex = i // keep iterating to find highest
    }
    if (matchedSlabIndex === -1) return null
    const discount = matchedSlabIndex > 0 ? slabs[matchedSlabIndex].price : 0
    return Math.max(0, basePrice + discount)
  }

  // Standard pricing (all positive prices)
  // First try exact range match (slab has both minQty and maxQty)
  const exactRangeMatch = slabs.find(
    (slab) => slab.maxQty !== null && quantity >= slab.minQty && quantity <= slab.maxQty
  )
  if (exactRangeMatch) return exactRangeMatch.price

  // For threshold-style slabs (maxQty === null), find the highest minQty that still matches
  // Sort descending by minQty to find the best (most discounted / highest tier) match
  const sortedByMinDesc = [...slabs].sort((a, b) => b.minQty - a.minQty)
  const thresholdMatch = sortedByMinDesc.find((slab) => quantity >= slab.minQty)
  if (thresholdMatch) return thresholdMatch.price

  // Fallback to first slab
  return basePrice
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
