"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { formatCurrency } from "@/utils/formatters"
import { FileSpreadsheet } from "lucide-react"
import { exportToExcel } from "@/utils/excel-export"
import { toast } from "sonner"

interface StatusSummary {
  status: string
  _count: { id: number }
  _sum: { totalCost: number }
}

interface LocationSummary {
  location: string
  _count: { id: number }
  _sum: { totalCost: number }
}

interface BranchPerformance {
  branch: string
  campaigns: number
  leads_generated: number
  conversions: number
  marketing_spend: number
}

interface AnalyticsData {
  totalProjects: number
  deliveredProjects: number
  totalSpend: number
  avgProjectCost: number
  deliveryRate: number
  projectsByStatus: StatusSummary[]
  projectsByLocation: LocationSummary[]
  branchData: BranchPerformance[]
  totalLeadsGenerated: number
  totalLeadsConverted: number
  conversionRate: number
  avgCPL: number
  avgCPA: number
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [branchFilter, setBranchFilter] = useState("all")

  const fetchAnalyticsData = useCallback(async () => {
    if (status !== "authenticated" || session?.user.role !== "ADMIN") return

    try {
      const res = await fetch("/api/analytics")
      if (res.ok) {
        const analyticsData = await res.json()
        setData(analyticsData)
      }
    } catch {
      // Silent retry
    } finally {
      setLoading(false)
    }
  }, [session?.user.role, status])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchAnalyticsData()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [fetchAnalyticsData])

  if (status === "unauthenticated") {
    router.push("/login")
    return null
  }
  if (status === "authenticated" && session.user.role !== "ADMIN") {
    router.push("/dashboard")
    return null
  }

  const exportReport = async () => {
    if (!data) {
      toast.error("No analytics data available to export")
      return
    }

    const columns = [
      { header: "Metric / Category", key: "metric", width: 32 },
      { header: "Value", key: "value", width: 26 },
    ]

    const rows = [
      { metric: "Marketing Spend (₹)", value: `₹${data.totalSpend.toLocaleString("en-IN")}` },
      { metric: "Total Leads Generated", value: data.totalLeadsGenerated.toLocaleString("en-IN") },
      { metric: "Total Leads Converted", value: data.totalLeadsConverted.toLocaleString("en-IN") },
      { metric: "Conversion Rate (%)", value: `${data.conversionRate.toFixed(1)}%` },
      { metric: "Cost Per Lead - CPL (₹)", value: `₹${data.avgCPL.toLocaleString("en-IN")}` },
      { metric: "Cost Per Acquisition - CPA (₹)", value: `₹${data.avgCPA.toLocaleString("en-IN")}` },
      { metric: "Total Projects", value: data.totalProjects.toString() },
      { metric: "Delivered Projects", value: data.deliveredProjects.toString() },
      { metric: "Delivery Rate (%)", value: `${data.deliveryRate.toFixed(1)}%` },
    ]

    await exportToExcel({
      filename: `Marketing_ROI_Analytics_Report_${new Date().toISOString().split("T")[0]}`,
      sheetName: "Marketing ROI Summary",
      columns,
      data: rows,
    })
    toast.success("Marketing ROI report exported to Excel successfully!")
  }

  const exportBranchData = async () => {
    const list = data?.branchData || []
    if (list.length === 0) {
      toast.error("No branch data available to export")
      return
    }

    let targetBranches = list
    if (branchFilter === "top") {
      targetBranches = list.filter((b) => {
        const leads = Number(b.leads_generated) || 0
        const conversions = Number(b.conversions) || 0
        const rate = leads > 0 ? (conversions / leads) * 100 : 0
        return rate >= 10
      })
    } else if (branchFilter === "attention") {
      targetBranches = list.filter((b) => {
        const leads = Number(b.leads_generated) || 0
        const conversions = Number(b.conversions) || 0
        const rate = leads > 0 ? (conversions / leads) * 100 : 0
        return rate < 10
      })
    }

    const columns = [
      { header: "Branch Location", key: "branch", width: 25 },
      { header: "Campaigns", key: "campaigns", width: 14 },
      { header: "Leads Generated", key: "leads", width: 18 },
      { header: "Conversions", key: "conversions", width: 16 },
      { header: "Conversion Rate", key: "conversionRate", width: 18 },
      { header: "Marketing Spend (₹)", key: "marketingSpend", width: 22 },
      { header: "CPL (₹)", key: "cpl", width: 16 },
      { header: "CPA (₹)", key: "cpa", width: 16 },
    ]

    const rows = targetBranches.map((b) => {
      const leads = Number(b.leads_generated) || 0
      const conversions = Number(b.conversions) || 0
      const spend = b.marketing_spend || 0
      const cpl = leads > 0 ? Math.round(spend / leads) : 0
      const cpa = conversions > 0 ? Math.round(spend / conversions) : 0
      const conversionRate = leads > 0 ? ((conversions / leads) * 100).toFixed(1) + "%" : "0.0%"

      return {
        branch: b.branch,
        campaigns: b.campaigns,
        leads: leads.toLocaleString("en-IN"),
        conversions: conversions.toLocaleString("en-IN"),
        conversionRate,
        marketingSpend: `₹${spend.toLocaleString("en-IN")}`,
        cpl: cpl > 0 ? `₹${cpl.toLocaleString("en-IN")}` : "₹0",
        cpa: cpa > 0 ? `₹${cpa.toLocaleString("en-IN")}` : "N/A",
      }
    })

    await exportToExcel({
      filename: `Branch_Performance_Report_${branchFilter}_${new Date().toISOString().split("T")[0]}`,
      sheetName: "Branch Performance",
      columns,
      data: rows,
    })
    toast.success(`Exported ${rows.length} branch performance records to Excel!`)
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered": return "status-delivered"
      case "dispatched": return "status-dispatched"
      case "printing": return "status-printing"
      case "approved": return "status-approved"
      default: return "status-requested"
    }
  }

  if (loading || !data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "24rem" }}>
        <div style={{ width: "2rem", height: "2rem", border: "4px solid #003c71", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      </div>
    )
  }

  const filteredBranchData = data.branchData || []

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Analytics & Reports</h1>
        <p className="page-subtitle">Comprehensive marketing performance and ROI analysis</p>
      </div>

      {/* Marketing ROI Dashboard */}
      <div className="card" style={{ marginBottom: "32px", padding: "24px" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div className="card-title" style={{ fontSize: "20px", fontWeight: 700, color: "#1f2937" }}>Marketing ROI Dashboard</div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={exportReport}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '42px',
              padding: '0 16px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: 'var(--axis-primary, #003c71)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(0, 60, 113, 0.25)',
            }}
          >
            <FileSpreadsheet size={16} />
            Export Report
          </button>
        </div>
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "16px" }}>
            <div style={{
              background: "rgba(14, 165, 233, 0.08)",
              border: "2px solid rgba(14, 165, 233, 0.25)",
              borderRadius: "12px",
              padding: "20px 12px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>Marketing Spend</div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#0ea5e9" }}>{formatCurrency(data.totalSpend)}</div>
            </div>

            <div style={{
              background: "rgba(168, 85, 247, 0.08)",
              border: "2px solid rgba(168, 85, 247, 0.25)",
              borderRadius: "12px",
              padding: "20px 12px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>Leads Generated</div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#8b5cf6" }}>{data.totalLeadsGenerated.toLocaleString()}</div>
            </div>

            <div style={{
              background: "rgba(34, 197, 94, 0.08)",
              border: "2px solid rgba(34, 197, 94, 0.25)",
              borderRadius: "12px",
              padding: "20px 12px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>Conversions</div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#22c55e" }}>{data.totalLeadsConverted.toLocaleString()}</div>
            </div>

            <div style={{
              background: "rgba(234, 179, 8, 0.08)",
              border: "2px solid rgba(234, 179, 8, 0.25)",
              borderRadius: "12px",
              padding: "20px 12px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>Cost Per Lead</div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#eab308" }}>{formatCurrency(data.avgCPL)}</div>
            </div>

            <div style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "2px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "12px",
              padding: "20px 12px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>Cost Per Acquisition</div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#ef4444" }}>{formatCurrency(data.avgCPA)}</div>
            </div>

            <div style={{
              background: "rgba(59, 130, 246, 0.08)",
              border: "2px solid rgba(59, 130, 246, 0.25)",
              borderRadius: "12px",
              padding: "20px 12px",
              textAlign: "center"
            }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>Conversion Rate</div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: "#3b82f6" }}>{data.conversionRate.toFixed(1)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Three Column Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginBottom: "24px" }}>
        {/* Projected vs Actual Business */}
        <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1f2937", marginBottom: "20px" }}>Projected vs Actual Business</h3>

          {/* Modern Minimalist Pie Chart */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <div style={{ position: "relative", width: "140px", height: "140px" }}>
              <svg width="140" height="140" viewBox="0 0 140 140">
                {/* Subtle background circle */}
                <circle cx="70" cy="70" r="58" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                {/* Pipeline (light gray) */}
                <circle
                  cx="70"
                  cy="70"
                  r="58"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="12"
                  strokeDasharray={`${((data.totalLeadsGenerated - data.totalLeadsConverted) / data.totalLeadsGenerated) * 364} 364`}
                  transform="rotate(-90 70 70)"
                />
                {/* Converted (soft green) */}
                <circle
                  cx="70"
                  cy="70"
                  r="58"
                  fill="none"
                  stroke="#86efac"
                  strokeWidth="12"
                  strokeDasharray={`${(data.totalLeadsConverted / data.totalLeadsGenerated) * 364} 364`}
                  strokeLinecap="round"
                  transform={`rotate(${-90 + ((data.totalLeadsGenerated - data.totalLeadsConverted) / data.totalLeadsGenerated) * 360} 70 70)`}
                />
              </svg>
              {/* Center label */}
              <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center"
              }}>
                <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 500, letterSpacing: "0.5px" }}>Total</div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: "#334155" }}>{data.totalLeadsGenerated}</div>
              </div>
            </div>
          </div>

          {/* Data Boxes */}
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{
              flex: 1,
              textAlign: "center",
              padding: "16px",
              background: "#ecfdf5",
              borderRadius: "12px",
              border: "1px solid #a7f3d0"
            }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#059669", marginBottom: "4px" }}>Converted</p>
              <p style={{ fontSize: "24px", fontWeight: 800, color: "#047857" }}>{data.totalLeadsConverted}</p>
            </div>
            <div style={{
              flex: 1,
              textAlign: "center",
              padding: "16px",
              background: "#f9fafb",
              borderRadius: "12px",
              border: "1px solid #e5e7eb"
            }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#4b5563", marginBottom: "4px" }}>Pipeline</p>
              <p style={{ fontSize: "24px", fontWeight: 800, color: "#374151" }}>{data.totalLeadsGenerated - data.totalLeadsConverted}</p>
            </div>
          </div>
        </div>

        {/* Location Distribution */}
        <div style={{ background: "white", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#1f2937", marginBottom: "20px" }}>Location Distribution</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {data.projectsByLocation.slice(0, 6).map((loc) => {
              const maxCount = Math.max(...data.projectsByLocation.map(l => l._count.id), 1)
              const percentage = Math.round((loc._count.id / maxCount) * 100)
              return (
                <div key={loc.location} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{
                    fontWeight: 600,
                    color: "#374151",
                    width: "110px",
                    minWidth: "110px",
                    fontSize: "13px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }} title={loc.location}>{loc.location}</span>
                  <div style={{ flex: 1, height: "10px", background: "#f3f4f6", borderRadius: "5px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #0ea5e9 0%, #38bdf8 100%)",
                        borderRadius: "5px",
                        transition: "width 0.3s ease"
                      }}
                    />
                  </div>
                  <span style={{ fontWeight: 700, color: "#1f2937", minWidth: "28px", fontSize: "14px", textAlign: "right" }}>
                    {loc._count.id}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Status Breakdown</div>
          </div>
          <div className="card-body">
            {data.projectsByStatus.map((s) => {
              const statusStyles: Record<string, { bg: string; text: string; dot: string; glow: string }> = {
                delivered: { bg: "rgba(34, 197, 94, 0.15)", text: "#16a34a", dot: "#22c55e", glow: "0 0 8px #22c55e" },
                dispatched: { bg: "rgba(37, 99, 235, 0.15)", text: "#2563eb", dot: "#3b82f6", glow: "0 0 8px #3b82f6" },
                printing: { bg: "rgba(217, 119, 6, 0.15)", text: "#d97706", dot: "#f59e0b", glow: "0 0 8px #f59e0b" },
                approved: { bg: "rgba(124, 58, 237, 0.15)", text: "#7c3aed", dot: "#8b5cf6", glow: "0 0 8px #8b5cf6" },
                requested: { bg: "rgba(100, 116, 139, 0.15)", text: "#64748b", dot: "#94a3b8", glow: "0 0 8px #94a3b8" },
                cancelled: { bg: "rgba(220, 38, 38, 0.15)", text: "#dc2626", dot: "#ef4444", glow: "0 0 8px #ef4444" }
              }
              const style = statusStyles[s.status.toLowerCase()] || statusStyles.requested

              return (
                <div key={s.status} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span
                    style={{
                      fontWeight: 600,
                      color: style.text,
                      textTransform: "capitalize",
                      background: style.bg,
                      padding: "6px 14px",
                      borderRadius: "9999px",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}
                  >
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: style.dot,
                        boxShadow: style.glow,
                        animation: "pulse-glow 2s ease-in-out infinite"
                      }}
                    />
                    {s.status}
                  </span>
                  <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "16px" }}>
                    {s._count.id}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Branch-Level Performance Table */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="card-title">Branch-Level Performance</div>
          <div style={{ display: "flex", gap: "12px" }}>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "14px" }}
            >
              <option value="all">All Branches</option>
              <option value="top">Top Performer</option>
              <option value="attention">Need Attention</option>
            </select>
            <button
              type="button"
              className="btn btn-primary"
              onClick={exportBranchData}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '42px',
                padding: '0 16px',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                backgroundColor: 'var(--axis-primary, #003c71)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(0, 60, 113, 0.25)',
              }}
            >
              <FileSpreadsheet size={16} />
              Export Data
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Branch Location</th>
                <th style={{ textAlign: "center" }}>Campaigns</th>
                <th style={{ textAlign: "center" }}>Leads Generated</th>
                <th style={{ textAlign: "center" }}>Conversions</th>
                <th style={{ textAlign: "center" }}>Conversion Rate</th>
                <th style={{ textAlign: "right" }}>Marketing Spend</th>
                <th style={{ textAlign: "right" }}>CPL</th>
                <th style={{ textAlign: "right" }}>CPA</th>
              </tr>
            </thead>
            <tbody>
              {filteredBranchData.map((branch, idx) => {
                const leads = Number(branch.leads_generated) || 0
                const conversions = Number(branch.conversions) || 0
                const spend = branch.marketing_spend || 0
                const cpl = leads > 0 ? Math.round(spend / leads) : 0
                const cpa = conversions > 0 ? Math.round(spend / conversions) : 0
                const conversionRate = leads > 0 ? ((conversions / leads) * 100) : 0

                return (
                  <tr key={branch.branch + idx}>
                    <td style={{ fontWeight: 600 }}>{branch.branch}</td>
                    <td style={{ textAlign: "center" }}>{branch.campaigns}</td>
                    <td style={{ textAlign: "center" }}>{leads}</td>
                    <td style={{ textAlign: "center" }}>{conversions}</td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{
                        padding: "4px 8px",
                        background: conversionRate >= 10 ? "#dcfce7" : conversionRate > 0 ? "#fef3c7" : "#fee2e2",
                        color: conversionRate >= 10 ? "#166534" : conversionRate > 0 ? "#92400e" : "#991b1b",
                        borderRadius: "9999px",
                        fontSize: "12px",
                        fontWeight: 600
                      }}>
                        {conversionRate.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#003c71" }}>{formatCurrency(spend)}</td>
                    <td style={{ textAlign: "right" }}>{cpl > 0 ? `₹${cpl}` : "₹0"}</td>
                    <td style={{ textAlign: "right" }}>{cpa > 0 ? `₹${cpa}` : "₹0"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Animation styles */}
      <style jsx>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 6px currentColor;
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 12px currentColor, 0 0 20px currentColor;
            transform: scale(1.15);
          }
        }
      `}</style>
    </div>
  )
}
