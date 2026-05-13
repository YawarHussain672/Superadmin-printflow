"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { formatCurrency } from "@/utils/formatters"

interface MonthlyData {
  month: string
  count: number
  spend: number
}

interface MonthlyTrendChartProps {
  data: MonthlyData[]
}

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  if (data.length === 0) {
    return <EmptyState />
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value: number, name: string) =>
            name === "spend" ? [formatCurrency(value), "Spend"] : [value, "Projects"]
          }
        />
        <Legend />
        <Bar yAxisId="left" dataKey="count" name="Projects" fill="#003c71" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="right" dataKey="spend" name="spend" fill="#00a8cc" radius={[4, 4, 0, 0]} />
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
