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

interface CollateralData {
  itemName: string
  count: number
  spend: number
  quantity: number
}

interface TopCollateralsChartProps {
  data: CollateralData[]
}

export function TopCollateralsChart({ data }: TopCollateralsChartProps) {
  if (data.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="itemName"
            tick={{ fontSize: 11 }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip formatter={(value: number) => [formatCurrency(value), "Spend"]} />
          <Bar dataKey="spend" fill="#00a8cc" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={item.itemName} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#003c71] text-white text-xs flex items-center justify-center font-bold">
                {index + 1}
              </span>
              <span className="font-medium">{item.itemName}</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-[#003c71]">{formatCurrency(item.spend)}</span>
              <p className="text-xs text-gray-500">Qty: {item.quantity.toLocaleString()}</p>
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
