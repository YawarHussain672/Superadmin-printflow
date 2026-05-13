export interface VolumeSlab {
  slab: string
  price: number
}

interface ParsedVolumeSlab extends VolumeSlab {
  minQty: number
  maxQty: number | null
}

function parseSlabRange(label: string): Pick<ParsedVolumeSlab, "minQty" | "maxQty"> {
  const lower = label.toLowerCase()
  const numbers = label.match(/\d+/g)?.map(Number) ?? []

  if (lower.includes("less") && numbers.length >= 1) {
    return { minQty: 1, maxQty: numbers[0] - 1 }
  }

  if (lower.includes("upto") && numbers.length >= 1) {
    return { minQty: 1, maxQty: numbers[0] }
  }

  if (numbers.length >= 2) {
    return { minQty: numbers[0], maxQty: numbers[1] }
  }

  if (numbers.length === 1) {
    return { minQty: numbers[0], maxQty: null }
  }

  return { minQty: 1, maxQty: null }
}

export function parseVolumeSlabs(value: unknown): ParsedVolumeSlab[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return []
    }

    const slab = "slab" in entry ? entry.slab : null
    const price = "price" in entry ? entry.price : null
    if (typeof slab !== "string" || typeof price !== "number") {
      return []
    }

    return [{ slab, price, ...parseSlabRange(slab) }]
  })
}

export function getUnitPriceFromSlabs(value: unknown, quantity: number): number | null {
  const slabs = parseVolumeSlabs(value).sort((a, b) => a.minQty - b.minQty)
  if (slabs.length === 0) return null

  // Check if this is tiered discount pricing (negative prices = discounts)
  const hasNegativePrices = slabs.some(s => s.price < 0)

  if (hasNegativePrices) {
    // Tiered discount pricing: each slab's price is base + that slab's discount
    // Find which slab the quantity falls into
    let matchedSlabIndex = -1

    for (let i = 0; i < slabs.length; i++) {
      const slab = slabs[i]
      if (slab.maxQty !== null) {
        // Range slab: check if quantity is within range
        if (quantity >= slab.minQty && quantity <= slab.maxQty) {
          matchedSlabIndex = i
          break
        }
      } else {
        // Threshold slab: check if quantity meets minimum
        if (quantity >= slab.minQty) {
          matchedSlabIndex = i
          // Don't break - continue to find the highest matching slab
        }
      }
    }

    if (matchedSlabIndex === -1) {
      // Quantity is below first slab - no price available
      return null
    }

    // Calculate price: base price + matched slab's discount (not cumulative!)
    const basePrice = slabs[0].price
    const discount = matchedSlabIndex > 0 ? slabs[matchedSlabIndex].price : 0
    const finalPrice = basePrice + discount

    // Ensure price doesn't go below zero
    return Math.max(0, finalPrice)
  }

  // Standard pricing (all positive prices)
  // First, try to find an exact range match (e.g., "1-10" for quantity 5)
  const exactRangeMatch = slabs.find(
    (slab) => slab.maxQty !== null && quantity >= slab.minQty && quantity <= slab.maxQty
  )
  if (exactRangeMatch) return exactRangeMatch.price

  // For threshold-style slabs (e.g., "1000", "5000"), find the highest minQty that matches
  const sortedByMinDesc = [...slabs].sort((a, b) => b.minQty - a.minQty)

  const thresholdMatch = sortedByMinDesc.find(
    (slab) => quantity >= slab.minQty
  )

  if (thresholdMatch) return thresholdMatch.price

  // Fallback to first slab if nothing matches
  return slabs[0].price
}
