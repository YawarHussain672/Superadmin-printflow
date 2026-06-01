"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { formatCurrency } from "@/utils/formatters"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import { Building, TrendingUp, BarChart2, CheckCircle2, AlertCircle, FileText, Download } from "lucide-react"

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
  pendingProjects: number
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

interface ClientOption {
  id: string
  companyName: string
}

export default function SuperAdminAnalyticsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState("")
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [branchFilter, setBranchFilter] = useState("all")

  // Fetch all clients for the dropdown filter
  useEffect(() => {
    if (status !== "authenticated" || session?.user.role !== "SUPERADMIN") return
    
    const fetchClients = async () => {
      try {
        const res = await fetch("/api/superadmin/clients")
        if (res.ok) {
          const result = await res.json()
          setClients(result.clients)
        }
      } catch (err) {
        console.error("Failed to load clients list", err)
      }
    }
    fetchClients()
  }, [session, status])

  const fetchAnalyticsData = useCallback(async () => {
    if (status !== "authenticated" || session?.user.role !== "SUPERADMIN") return

    setLoading(true)
    try {
      const url = selectedClientId 
        ? `/api/analytics?clientId=${selectedClientId}`
        : "/api/analytics"
      
      const res = await fetch(url)
      if (res.ok) {
        const analyticsData = await res.json()
        setData(analyticsData)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [session?.user.role, status, selectedClientId])

  useEffect(() => {
    fetchAnalyticsData()
  }, [fetchAnalyticsData])

  if (status === "unauthenticated") {
    router.push("/login")
    return null
  }
  
  if (status === "authenticated" && session.user.role !== "SUPERADMIN") {
    router.push("/dashboard")
    return null
  }

  const exportReport = () => {
    if (!data) return
    const doc = new jsPDF()
    const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    const pageW = doc.internal.pageSize.getWidth()

    const selectedClient = clients.find(c => c.id === selectedClientId)
    const clientHeader = selectedClient ? selectedClient.companyName.toUpperCase() : "ALL ORGANIZATIONS (AGGREGATED)"

    // Header
    doc.setFillColor(0, 60, 113)
    doc.rect(0, 0, pageW, 24, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(13)
    doc.setFont("helvetica", "bold")
    doc.text("RISHIRAJ MEDIA", 14, 11)
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(`Tenant Audit: ${clientHeader}`, 14, 16)
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("SuperAdmin Analytics Report", pageW / 2, 13, { align: "center" })
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(`Generated: ${date}`, pageW - 14, 11, { align: "right" })

    // Summary data rows
    const summaryData = [
      ["Organization Filter", selectedClient ? selectedClient.companyName : "All (Aggregated)"],
      ["Total Marketing Spend", `Rs. ${data.totalSpend.toLocaleString("en-US")}`],
      ["Leads Generated", data.totalLeadsGenerated.toLocaleString("en-US")],
      ["Conversions", data.totalLeadsConverted.toLocaleString("en-US")],
      ["Conversion Rate", `${data.conversionRate.toFixed(1)}%`],
      ["Cost Per Lead (CPL)", `Rs. ${data.avgCPL.toLocaleString("en-US")}`],
      ["Cost Per Acquisition (CPA)", `Rs. ${data.avgCPA.toLocaleString("en-US")}`],
      ["Total Campaign Projects", data.totalProjects.toString()],
      ["Delivered Projects", data.deliveredProjects.toString()],
      ["Delivery Rate", `${data.deliveryRate.toFixed(1)}%`],
    ]

    autoTable(doc, {
      head: [["Metric", "Value"]],
      body: summaryData,
      startY: 30,
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [0, 60, 113], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: "bold" },
        1: { halign: "right" },
      },
    })

    doc.save(`superadmin-analytics-report-${new Date().toISOString().split("T")[0]}.pdf`)
  }

  const exportBranchData = () => {
    if (!data?.branchData) return
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.setTextColor(0, 60, 113)
    doc.text("Branch-Level Campaign & Spend Analysis", 14, 20)

    const tableData = data.branchData.map((b) => {
      const leads = Number(b.leads_generated) || 0
      const conversions = Number(b.conversions) || 0
      const spend = b.marketing_spend || 0
      const cpl = leads > 0 ? Math.round(spend / leads) : 0
      const cpa = conversions > 0 ? Math.round(spend / conversions) : 0
      const conversionRate = leads > 0 ? ((conversions / leads) * 100).toFixed(1) + "%" : "0.0%"

      return [
        b.branch,
        b.campaigns.toString(),
        leads.toLocaleString("en-US"),
        conversions.toLocaleString("en-US"),
        conversionRate,
        "Rs. " + spend.toLocaleString("en-US"),
        cpl > 0 ? "Rs. " + cpl.toLocaleString("en-US") : "Rs. 0",
        cpa > 0 ? "Rs. " + cpa.toLocaleString("en-US") : "N/A"
      ]
    })

    autoTable(doc, {
      head: [["Branch / Location", "Campaigns", "Leads Generated", "Conversions", "Conversion Rate", "Marketing Spend", "CPL", "CPA"]],
      body: tableData,
      startY: 30,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [0, 60, 113], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    })

    doc.save(`branch-performance-${new Date().toISOString().split("T")[0]}.pdf`)
  }

  const filteredBranchData = data?.branchData || []

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title">Analytics & Reports</h1>
          <p className="page-subtitle">Aggregated system-wide ROI metrics, lead performance, and branch campaign drill-down.</p>
        </div>

        {/* Client Selector Filter */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            style={{
              padding: "10px 16px",
              border: "1px solid var(--gray-200)",
              borderRadius: "8px",
              fontSize: "14px",
              outline: "none",
              backgroundColor: "white",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            <option value="">All Organizations (Aggregated)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.companyName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading || !data ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "24rem", color: "var(--gray-400)" }}>
          <div className="spinner" style={{ marginRight: "12px" }}></div>
          Loading system analytics...
        </div>
      ) : (
        <>
          {/* ROI Cards Grid */}
          <div className="card" style={{ marginBottom: "32px", padding: "24px" }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div className="card-title" style={{ fontSize: "20px", fontWeight: 700, color: "#1f2937" }}>Marketing Performance Summary</div>
              <button className="btn btn-primary" onClick={exportReport} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Download size={16} />
                Export Report
              </button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
              <div style={{ background: "rgba(14, 165, 233, 0.06)", border: "1px solid rgba(14, 165, 233, 0.15)", borderRadius: "12px", padding: "20px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px" }}>Total Spend</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#0ea5e9" }}>{formatCurrency(data.totalSpend)}</div>
              </div>

              <div style={{ background: "rgba(168, 85, 247, 0.06)", border: "1px solid rgba(168, 85, 247, 0.15)", borderRadius: "12px", padding: "20px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px" }}>Leads Generated</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#8b5cf6" }}>{data.totalLeadsGenerated.toLocaleString()}</div>
              </div>

              <div style={{ background: "rgba(34, 197, 94, 0.06)", border: "1px solid rgba(34, 197, 94, 0.15)", borderRadius: "12px", padding: "20px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px" }}>Conversions</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#22c55e" }}>{data.totalLeadsConverted.toLocaleString()}</div>
              </div>

              <div style={{ background: "rgba(234, 179, 8, 0.06)", border: "1px solid rgba(234, 179, 8, 0.15)", borderRadius: "12px", padding: "20px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px" }}>Cost Per Lead (CPL)</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#eab308" }}>{formatCurrency(data.avgCPL)}</div>
              </div>

              <div style={{ background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.15)", borderRadius: "12px", padding: "20px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px" }}>CPA</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#ef4444" }}>{formatCurrency(data.avgCPA)}</div>
              </div>

              <div style={{ background: "rgba(59, 130, 246, 0.06)", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: "12px", padding: "20px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: "8px" }}>Conversion Rate</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#3b82f6" }}>{data.conversionRate.toFixed(1)}%</div>
              </div>
            </div>
          </div>

          {/* Aggregated Charts Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", marginBottom: "24px" }}>
            
            {/* Funnel Conversions */}
            <div className="card" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1f2937", marginBottom: "20px" }}>Campaign Funnel Efficiency</h3>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
                <div style={{ position: "relative", width: "140px", height: "140px" }}>
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="58" fill="none" stroke="#f1f5f9" strokeWidth="12" />
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
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 500, letterSpacing: "0.5px" }}>Leads</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color: "#334155" }}>{data.totalLeadsGenerated}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1, textAlign: "center", padding: "16px", background: "#ecfdf5", borderRadius: "12px", border: "1px solid #a7f3d0" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#059669", marginBottom: "4px" }}>Converted</p>
                  <p style={{ fontSize: "22px", fontWeight: 800, color: "#047857" }}>{data.totalLeadsConverted}</p>
                </div>
                <div style={{ flex: 1, textAlign: "center", padding: "16px", background: "#f9fafb", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#4b5563", marginBottom: "4px" }}>Pending</p>
                  <p style={{ fontSize: "22px", fontWeight: 800, color: "#374151" }}>{data.totalLeadsGenerated - data.totalLeadsConverted}</p>
                </div>
              </div>
            </div>

            {/* Location Spend Distribution */}
            <div className="card" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1f2937", marginBottom: "20px" }}>Spend by Campaign Location</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {data.projectsByLocation.length === 0 ? (
                  <p style={{ color: "var(--gray-400)", textAlign: "center", padding: "24px 0" }}>No location data available</p>
                ) : (
                  data.projectsByLocation.slice(0, 5).map((loc) => {
                    const maxCost = Math.max(...data.projectsByLocation.map(l => l._sum.totalCost || 1), 1)
                    const percentage = Math.round(((loc._sum.totalCost || 0) / maxCost) * 100)
                    return (
                      <div key={loc.location} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontWeight: 600, color: "#374151", width: "100px", minWidth: "100px", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {loc.location}
                        </span>
                        <div style={{ flex: 1, height: "10px", background: "#f3f4f6", borderRadius: "5px", overflow: "hidden" }}>
                          <div style={{ width: `${percentage}%`, height: "100%", background: "linear-gradient(90deg, #8b5cf6 0%, #a855f7 100%)", borderRadius: "5px" }} />
                        </div>
                        <span style={{ fontWeight: 700, color: "#1f2937", minWidth: "75px", fontSize: "13px", textAlign: "right" }}>
                          ₹{Math.round((loc._sum.totalCost || 0) / 1000)}K
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Project Status Breakdown */}
            <div className="card" style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#1f2937", marginBottom: "20px" }}>Project Status Breakdown</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {data.projectsByStatus.map((s) => {
                  const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
                    delivered: { bg: "rgba(34, 197, 94, 0.12)", text: "#16a34a", dot: "#22c55e" },
                    dispatched: { bg: "rgba(37, 99, 235, 0.12)", text: "#2563eb", dot: "#3b82f6" },
                    printing: { bg: "rgba(217, 119, 6, 0.12)", text: "#d97706", dot: "#f59e0b" },
                    approved: { bg: "rgba(124, 58, 237, 0.12)", text: "#7c3aed", dot: "#8b5cf6" },
                    requested: { bg: "rgba(100, 116, 139, 0.12)", text: "#64748b", dot: "#94a3b8" },
                    cancelled: { bg: "rgba(220, 38, 38, 0.12)", text: "#dc2626", dot: "#ef4444" }
                  }
                  const style = statusStyles[s.status.toLowerCase()] || statusStyles.requested

                  return (
                    <div key={s.status} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{
                        fontWeight: 600,
                        color: style.text,
                        background: style.bg,
                        padding: "4px 12px",
                        borderRadius: "9999px",
                        fontSize: "12px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px"
                      }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: style.dot }} />
                        {s.status}
                      </span>
                      <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>
                        {s._count.id} Projects
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

          {/* Branch performance table */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 className="card-title">Branch-Level Performance</h3>
              <div style={{ display: "flex", gap: "12px" }}>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "14px" }}
                >
                  <option value="all">All Branches</option>
                  <option value="top">Top Performer (Spend &gt; ₹50K)</option>
                  <option value="attention">Need Attention (Conv. Rate &lt; 10%)</option>
                </select>
                <button className="btn btn-secondary" onClick={exportBranchData}>Export CSV/Branch Data</button>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Branch Name</th>
                    <th style={{ textAlign: "center" }}>Campaigns</th>
                    <th style={{ textAlign: "center" }}>Leads Generated</th>
                    <th style={{ textAlign: "center" }}>Conversions</th>
                    <th style={{ textAlign: "center" }}>Conversion Rate</th>
                    <th style={{ textAlign: "right" }}>Spend (Base Cost)</th>
                    <th style={{ textAlign: "right" }}>CPL</th>
                    <th style={{ textAlign: "right" }}>CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBranchData
                    .filter((branch) => {
                      if (branchFilter === "top") return branch.marketing_spend > 50000
                      if (branchFilter === "attention") {
                        const rate = branch.leads_generated > 0 ? (branch.conversions / branch.leads_generated) * 100 : 0
                        return rate < 10
                      }
                      return true
                    })
                    .map((branch, idx) => {
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
                          <td style={{ textAlign: "center" }}>{leads.toLocaleString()}</td>
                          <td style={{ textAlign: "center" }}>{conversions.toLocaleString()}</td>
                          <td style={{ textAlign: "center" }}>
                            <span style={{
                              padding: "4px 8px",
                              background: conversionRate >= 12 ? "#dcfce7" : conversionRate > 0 ? "#fef3c7" : "#fee2e2",
                              color: conversionRate >= 12 ? "#166534" : conversionRate > 0 ? "#92400e" : "#991b1b",
                              borderRadius: "9999px",
                              fontSize: "12px",
                              fontWeight: 600
                            }}>
                              {conversionRate.toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600, color: "#003c71" }}>
                            {formatCurrency(spend)}
                          </td>
                          <td style={{ textAlign: "right" }}>{cpl > 0 ? `₹${cpl}` : "₹0"}</td>
                          <td style={{ textAlign: "right" }}>{cpa > 0 ? `₹${cpa}` : "₹0"}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid var(--gray-200);
          border-top: 3px solid #8b5cf6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
