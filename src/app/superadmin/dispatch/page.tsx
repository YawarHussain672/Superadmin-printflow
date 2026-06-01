import { basePrisma } from "@/lib/prisma"
import { ClientFilterDropdown } from "@/components/superadmin/client-filter-dropdown"
import { TrackButton } from "@/components/dispatch/track-button"
import { StatusBadge } from "@/components/ui/status-badge"
import Link from "next/link"
import { Truck, Download, FileText, CheckCircle } from "lucide-react"

interface SuperAdminDispatchPageProps {
  searchParams: Promise<{
    clientId?: string
    page?: string
  }>
}

const PAGE_SIZE = 20

function getTrackingId(dispatch: { trackingId: string | null; courierDetails: unknown }) {
  if (dispatch.trackingId) return dispatch.trackingId
  const details = dispatch.courierDetails as Record<string, unknown> | null
  const awbNo = details?.AwbNo ?? details?.awbNo ?? details?.AWBNo
  return awbNo ? String(awbNo) : ""
}

export default async function SuperAdminDispatchPage({ searchParams }: SuperAdminDispatchPageProps) {
  const params = await searchParams
  const clientId = params.clientId || ""
  const page = Math.max(1, parseInt(params.page || "1"))

  const where: any = {}
  if (clientId) {
    where.clientId = clientId
  }

  const [dispatches, total, clients] = await Promise.all([
    basePrisma.dispatch.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            projectId: true,
            name: true,
            location: true,
            status: true,
            tenantClient: { select: { id: true, companyName: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    basePrisma.dispatch.count({ where }),
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
    return `/superadmin/dispatch?${searchParamsObj.toString()}`
  }

  return (
    <div style={{ display: 'inline-block', minWidth: 'max-content', width: '100%', verticalAlign: 'top' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title">Dispatch & Tracking</h1>
          <p className="page-subtitle">View-only material dispatch statuses and proof-of-delivery (POD) tracking</p>
        </div>
        <ClientFilterDropdown clients={clients} />
      </div>

      {/* Dispatches Table */}
      <div className="card" style={{ minWidth: "1150px", width: "100%" }}>
        <div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Admin (Client)</th>
                <th>Location</th>
                <th>Courier</th>
                <th>Tracking ID</th>
                <th>Dispatch Date</th>
                <th>Expected Delivery</th>
                <th>Status</th>
                <th>Project Excel</th>
                <th>POD</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: "center", padding: "60px", color: "var(--gray-500)" }}>
                    <Truck size={48} style={{ margin: "0 auto 12px", strokeWidth: 1.5, color: "var(--gray-300)" }} />
                    <p style={{ fontWeight: 500 }}>No dispatches found</p>
                    <p style={{ fontSize: "13px", marginTop: "4px" }}>Dispatches will appear once client orders are shipped.</p>
                  </td>
                </tr>
              ) : (
                dispatches.map((dispatch) => {
                  const trackingId = getTrackingId(dispatch)
                  
                  return (
                    <tr key={dispatch.id}>
                      <td style={{ fontWeight: 600 }} className="font-mono">
                        {dispatch.project.projectId}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--gray-900)", maxWidth: '180px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{dispatch.project.name}</div>
                      </td>
                      <td>
                        {dispatch.project.tenantClient ? (
                          <div style={{ maxWidth: '150px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            <Link 
                              href={`/superadmin/admins/${dispatch.project.tenantClient.id}`}
                              style={{ fontWeight: 600, color: "#8b5cf6" }}
                              className="hover:underline"
                            >
                              {dispatch.project.tenantClient.companyName}
                            </Link>
                          </div>
                        ) : (
                          <span style={{ color: "var(--gray-400)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ maxWidth: '120px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{dispatch.project.location}</div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '100px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{dispatch.courier}</div>
                      </td>
                      <td className="font-mono" style={{ color: "var(--axis-accent)", fontWeight: 600 }}>
                        {trackingId || "—"}
                      </td>
                      <td>
                        {dispatch.dispatchDate
                          ? new Date(dispatch.dispatchDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                          : "—"}
                      </td>
                      <td>
                        {dispatch.expectedDelivery
                          ? new Date(dispatch.expectedDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                          : "—"}
                      </td>
                      <td>
                        <StatusBadge status={dispatch.project.status} />
                      </td>
                      <td>
                        <a
                          href={`/api/dispatch/${dispatch.id}/details-excel`}
                          style={{
                            color: "var(--axis-accent)",
                            textDecoration: "none",
                            fontWeight: 600,
                            fontSize: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                          className="hover-underline"
                        >
                          <Download size={12} />
                          Excel
                        </a>
                      </td>
                      <td>
                        {dispatch.podUrl ? (
                          <a
                            href={`/api/dispatch/${dispatch.id}/pod/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: "var(--color-success)",
                              textDecoration: "none",
                              fontWeight: 600,
                              fontSize: "12px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                            className="hover-underline"
                          >
                            <CheckCircle size={12} />
                            View POD
                          </a>
                        ) : (
                          <span style={{ color: "var(--gray-400)", fontSize: "12px" }}>No POD</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {dispatch.courier && trackingId ? (
                          <TrackButton
                            courier={dispatch.courier}
                            trackingId={trackingId}
                            dispatchDate={dispatch.dispatchDate}
                            expectedDelivery={dispatch.expectedDelivery}
                            actualDelivery={dispatch.actualDelivery}
                          />
                        ) : (
                          <span style={{ color: "var(--gray-400)", fontSize: "12px" }}>No tracking</span>
                        )}
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
  )
}

