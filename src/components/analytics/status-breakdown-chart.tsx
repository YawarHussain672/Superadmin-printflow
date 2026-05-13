"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { formatCurrency } from "@/utils/formatters"

interface StatusData {
  status: string
  count: number
  spend: number
}

interface StatusBreakdownChartProps {
  data: StatusData[]
}

const STATUS_COLORS: Record<string, string> = {
  REQUESTED: "#a855f7",
  APPROVED: "#3b82f6",
  PRINTING: "#f59e0b",
  DISPATCHED: "#06b6d4",
  DELIVERED: "#22c55e",
  CANCELLED: "#ef4444",
}

export function StatusBreakdownChart({ data }: StatusBreakdownChartProps) {
  if (data.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="status"
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={50}
            paddingAngle={3}
          >
            {data.map((entry) => (
              <Cell
                key={entry.status}
                fill={STATUS_COLORS[entry.status] || "#94a3b8"}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [value, name]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-2">
        {data.map((item) => (
          <div key={item.status} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[item.status] || "#94a3b8" }}
              />
              <span className="font-medium text-gray-700">{item.status}</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-gray-900">{item.count}</span>
              <p className="text-xs text-gray-500">{formatCurrency(item.spend)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="h-[280px] flex items-center justify-center text-gray-400">
      <p>No data available</p>
    </div>
  )
}
