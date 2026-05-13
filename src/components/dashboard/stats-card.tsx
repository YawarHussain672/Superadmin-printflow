"use client"

import { cn } from "@/utils/cn"
import { formatCurrency, formatNumber } from "@/utils/formatters"

interface StatsCardProps {
  title: string
  value: number
  isCurrency?: boolean
  icon: React.ReactNode
  color: "blue" | "purple" | "amber" | "cyan" | "green" | "rose"
  trend?: string
}

const colorMap = {
  blue: { bg: "bg-white", icon: "bg-[#003c71]/10 text-[#003c71]", val: "text-[#131b2e]", border: "border-[#003c71]/20", hover: "hover:border-[#003c71]/40 hover:shadow-[#003c71]/10", line: "bg-[#003c71]" },
  purple: { bg: "bg-white", icon: "bg-violet-50 text-violet-600", val: "text-slate-900", border: "border-violet-100", hover: "hover:border-violet-300 hover:shadow-violet-100", line: "bg-violet-400" },
  amber: { bg: "bg-white", icon: "bg-amber-50 text-amber-600", val: "text-slate-900", border: "border-amber-100", hover: "hover:border-amber-300 hover:shadow-amber-100", line: "bg-amber-400" },
  cyan: { bg: "bg-white", icon: "bg-cyan-50 text-cyan-600", val: "text-slate-900", border: "border-cyan-100", hover: "hover:border-cyan-300 hover:shadow-cyan-100", line: "bg-cyan-400" },
  green: { bg: "bg-white", icon: "bg-emerald-50 text-emerald-600", val: "text-slate-900", border: "border-emerald-100", hover: "hover:border-emerald-300 hover:shadow-emerald-100", line: "bg-emerald-400" },
  rose: { bg: "bg-white", icon: "bg-rose-50 text-rose-600", val: "text-slate-900", border: "border-rose-100", hover: "hover:border-rose-300 hover:shadow-rose-100", line: "bg-rose-400" },
}

export function StatsCard({ title, value, isCurrency, icon, color, trend }: StatsCardProps) {
  const c = colorMap[color]
  return (
    <div className={cn(
      "rounded-lg flex flex-col gap-3 border shadow-sm transition-all duration-200 cursor-default overflow-hidden",
      "hover:shadow-md hover:-translate-y-0.5 group",
      c.bg, c.border, c.hover
    )}>
      {/* Top accent line — appears on hover */}
      <div className={cn("h-0.5 w-full transition-all duration-300 scale-x-0 group-hover:scale-x-100 origin-left", c.line)} />
      <div className="px-5 pb-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", c.icon)}>
            {icon}
          </div>
        </div>
        <div>
          <p className={cn("text-2xl font-bold tracking-tight", c.val)}>
            {isCurrency ? formatCurrency(value) : formatNumber(value)}
          </p>
          {trend && <p className="text-xs text-slate-400 mt-1">{trend}</p>}
        </div>
      </div>
    </div>
  )
}
