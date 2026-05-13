import { format, formatDistanceToNow } from 'date-fns'

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const GST_RATE = 0.18 // 18%

export function applyGST(amount: number): number {
  return amount * (1 + GST_RATE)
}

export function getGSTAmount(amount: number): number {
  return amount * GST_RATE
}

export function formatGSTBreakdown(subtotal: number): { subtotal: number; gst: number; total: number } {
  const gst = getGSTAmount(subtotal)
  return { subtotal, gst, total: subtotal + gst }
}

// When total already includes GST, extract the base cost and GST amount
export function extractBaseCostFromTotal(totalWithGST: number): number {
  return totalWithGST / (1 + GST_RATE)
}

export function extractGSTFromTotal(totalWithGST: number): number {
  const baseCost = extractBaseCostFromTotal(totalWithGST)
  return totalWithGST - baseCost
}

export function formatCostBreakdownFromTotal(totalWithGST: number): { baseCost: number; gst: number; total: number } {
  const baseCost = extractBaseCostFromTotal(totalWithGST)
  const gst = totalWithGST - baseCost
  return { baseCost, gst, total: totalWithGST }
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMM dd, yyyy')
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMM dd, yyyy HH:mm')
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'dd MMM')
}

export function generateProjectId(): string {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 900) + 100
  return `PRJ-${year}-${random}`
}

export function generatePINumber(): string {
  return Math.floor(Math.random() * 9000 + 1000).toString()
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    REQUESTED: 'bg-purple-100 text-purple-700 border-purple-200',
    APPROVED: 'bg-blue-100 text-blue-700 border-blue-200',
    PRINTING: 'bg-amber-100 text-amber-700 border-amber-200',
    DISPATCHED: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    DELIVERED: 'bg-green-100 text-green-700 border-green-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
    PENDING: 'bg-purple-100 text-purple-700 border-purple-200',
    REJECTED: 'bg-red-100 text-red-700 border-red-200',
  }
  return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200'
}

export function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    REQUESTED: '📋',
    APPROVED: '✅',
    PRINTING: '🖨️',
    DISPATCHED: '🚚',
    DELIVERED: '📦',
    CANCELLED: '❌',
  }
  return icons[status] || '📋'
}
