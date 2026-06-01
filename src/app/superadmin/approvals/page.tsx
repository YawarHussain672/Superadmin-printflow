import { basePrisma } from "@/lib/prisma"
import { ClientFilterDropdown } from "@/components/superadmin/client-filter-dropdown"
import { StatusBadge } from "@/components/ui/status-badge"
import Link from "next/link"
import { CheckSquare, ArrowUpRight } from "lucide-react"
import { MaterialCell } from "@/components/ui/material-cell"

interface SuperAdminApprovalsPageProps {
  searchParams: Promise<{
    clientId?: string
    page?: string
  }>
}

const PAGE_SIZE = 20

export default async function SuperAdminApprovalsPage({ searchParams }: SuperAdminApprovalsPageProps) {
  const params = await searchParams
  const clientId = params.clientId || ""
  const page = Math.max(1, parseInt(params.page || "1"))

  const where: any = {
    status: "PENDING"
  }
  if (clientId) {
    where.clientId = clientId
  }

  const [approvals, total, clients] = await Promise.all([
    basePrisma.approval.findMany({
      where,
      include: {
        project: {
          include: {
            poc: { select: { id: true, name: true } },
            tenantClient: { select: { id: true, companyName: true } },
            collaterals: true,
          }
        },
        requestedBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    basePrisma.approval.count({ where }),
    basePrisma.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const buildUrl = (newParams: Record<string, string>) => {
    const query = { ...params, ...newParams }
    const searchParamsObj = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => {
      if (v) searchParamsObj.set(k, v)
    })
    return `/superadmin/approvals?${searchParamsObj.toString()}`
  }

  return (
    <div style={{ display: 'inline-block', minWidth: 'max-content', width: '100%', verticalAlign: 'top' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 className="page-title">Pending Approvals</h1>
          <p className="page-subtitle">View-only list of print projects currently awaiting client admin review</p>
        </div>
        <ClientFilterDropdown clients={clients} />
      </div>

      <div style={{ minWidth: '1200px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Approvals Table */}
        <div className="card" style={{ margin: 0 }}>
          <div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Project Name</th>
                  <th>Admin (Client)</th>
                  <th>Requested By</th>
                  <th>POC</th>
                  <th>Materials</th>
                  <th>Qty</th>
                  <th>Delivery Date</th>
                  <th>Est. Cost (incl. GST)</th>
                  <th style={{ textAlign: "right" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {approvals.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "60px", color: "var(--gray-500)" }}>
                      <CheckSquare size={48} style={{ margin: "0 auto 12px", strokeWidth: 1.5, color: "var(--gray-300)" }} />
                      <p style={{ fontWeight: 500 }}>No pending approvals found</p>
                      <p style={{ fontSize: "13px", marginTop: "4px" }}>All client organizations are currently caught up.</p>
                    </td>
                  </tr>
                ) : (
                  approvals.map((approval) => {
                    const qty = approval.project.collaterals?.reduce((sum, c) => sum + c.quantity, 0) || 0
                    
                    return (
                      <tr key={approval.id}>
                        <td style={{ fontWeight: 600 }} className="font-mono">
                          {approval.project.projectId}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--gray-900)", maxWidth: "200px", whiteSpace: "normal", wordBreak: "break-word" }}>{approval.project.name}</div>
                        </td>
                        <td>
                          {approval.project.tenantClient ? (
                            <div style={{ maxWidth: "150px", whiteSpace: "normal", wordBreak: "break-word" }}>
                              <Link 
                                href={`/superadmin/admins/${approval.project.tenantClient.id}`}
                                style={{ fontWeight: 600, color: "#8b5cf6" }}
                                className="hover:underline"
                              >
                                {approval.project.tenantClient.companyName}
                              </Link>
                            </div>
                          ) : (
                            <span style={{ color: "var(--gray-400)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ maxWidth: "150px", whiteSpace: "normal", wordBreak: "break-word" }}>{approval.requestedBy?.name || "—"}</div>
                        </td>
                        <td>
                          <div style={{ maxWidth: "150px", whiteSpace: "normal", wordBreak: "break-word" }}>{approval.project.poc?.name || "—"}</div>
                        </td>
                        <td>
                          <MaterialCell materials={approval.project.collaterals?.map(c => c.itemName).filter(Boolean) as string[]} />
                        </td>
                        <td className="font-mono">{qty.toLocaleString("en-IN")}</td>
                        <td>
                          {new Date(approval.project.deliveryDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td style={{ fontWeight: 600 }} className="font-mono">
                          ₹{approval.project.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <span className="status-badge status-requested" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <span className="status-dot"></span>
                            Pending Client Admin
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderTop: "1px solid var(--gray-200)" }}>
              <p style={{ fontSize: "14px", color: "var(--gray-600)" }}>
                Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {page > 1 ? (
                  <Link href={buildUrl({ page: String(page - 1) })} className="btn btn-secondary" style={{ padding: "6px 12px" }}>
                    Previous
                  </Link>
                ) : (
                  <button className="btn btn-secondary" style={{ padding: "6px 12px", opacity: 0.4 }} disabled>
                    Previous
                  </button>
                )}
                
                <span style={{ margin: "0 8px", fontSize: "14px", fontWeight: 500 }}>
                  Page {page} of {totalPages}
                </span>

                {page < totalPages ? (
                  <Link href={buildUrl({ page: String(page + 1) })} className="btn btn-secondary" style={{ padding: "6px 12px" }}>
                    Next
                  </Link>
                ) : (
                  <button className="btn btn-secondary" style={{ padding: "6px 12px", opacity: 0.4 }} disabled>
                    Next
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

