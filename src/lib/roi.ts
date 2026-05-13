export interface ROIMetrics {
  leadsGenerated: number
  leadsConverted: number
  totalCost: number
  conversionRate: number | null
  costPerLead: number | null
  costPerAcquisition: number | null
}

export function calculateROI(
  leadsGenerated: number,
  leadsConverted: number,
  totalCost: number
): ROIMetrics {
  const conversionRate = leadsGenerated > 0 ? (leadsConverted / leadsGenerated) * 100 : null
  const costPerLead = leadsGenerated > 0 ? totalCost / leadsGenerated : null
  const costPerAcquisition = leadsConverted > 0 ? totalCost / leadsConverted : null

  return {
    leadsGenerated,
    leadsConverted,
    totalCost,
    conversionRate,
    costPerLead,
    costPerAcquisition,
  }
}

export function formatROI(metrics: ROIMetrics) {
  return {
    conversionRate: metrics.conversionRate !== null ? `${metrics.conversionRate.toFixed(2)}%` : "N/A",
    costPerLead: metrics.costPerLead !== null ? `₹${metrics.costPerLead.toFixed(2)}` : "N/A",
    costPerAcquisition: metrics.costPerAcquisition !== null ? `₹${metrics.costPerAcquisition.toFixed(2)}` : "N/A",
  }
}
