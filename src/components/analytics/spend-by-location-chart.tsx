"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { formatCurrency } from "@/utils/formatters"

interface LocationData {
  location: string
  count: number
  spend: number
}

interface SpendByLocationChartProps {
  data: LocationData[]
}

export function SpendByLocationChart({ data }: SpendByLocationChartProps) {
  if (data.length === 0) {
    return <EmptyState />
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#bae6fd" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
          axisLine={{ stroke: '#7dd3fc', strokeWidth: 1 }}
        />
        <YAxis
          type="category"
          dataKey="location"
          tick={{ fontSize: 12, fill: '#374151' }}
          width={70}
          axisLine={{ stroke: '#7dd3fc', strokeWidth: 1 }}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value), "Spend"]}
        />
        <Bar dataKey="spend" fill="#38bdf8" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function EmptyState() {
  return (
    <div className="h-[280px] flex items-center justify-center text-gray-400">
      <p>No data available</p>
    </div>
  )
}
