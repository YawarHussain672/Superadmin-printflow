import { basePrisma } from "@/lib/prisma"
import { ClientFilterDropdown } from "@/components/superadmin/client-filter-dropdown"
import { ProjectsFilters } from "@/components/superadmin/projects-filters"
import { StatusBadge } from "@/components/ui/status-badge"
import Link from "next/link"
import { FolderOpen } from "lucide-react"
import { MaterialCell } from "@/components/ui/material-cell"

interface SuperAdminProjectsPageProps {
  searchParams: Promise<{
    clientId?: string
    status?: string
    search?: string
    page?: string
  }>
}

const PAGE_SIZE = 20

export default async function SuperAdminProjectsPage({ searchParams }: SuperAdminProjectsPageProps) {
  const params = await searchParams
  const clientId = params.clientId || ""
  const status = params.status || ""
  const search = params.search || ""
  const page = Math.max(1, parseInt(params.page || "1"))

  const where: any = {}
  if (clientId) {
    where.tenantClientId = clientId
  }
  if (status) {
    where.status = status
  }
  if (search) {
    where.OR = [
      { projectId: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { pocName: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } }
    ]
  }

  const [projects, total, clients] = await Promise.all([
    basePrisma.project.findMany({
      where,
      include: {
        poc: { select: { id: true, name: true } },
        tenantClient: { select: { id: true, companyName: true, companyLogoUrl: true } },
        collaterals: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    basePrisma.project.count({ where }),
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
    return `/superadmin/projects?${searchParamsObj.toString()}`
  }

  return (
    <div style={{ display: 'inline-block', minWidth: 'max-content', width: '100%', verticalAlign: 'top' }}>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">All Projects</h1>
        <p className="page-subtitle">View-only monitoring of print projects across all tenant organizations</p>
      </div>

      <div style={{ minWidth: '1200px', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Filters Bar */}
        <div className="card" style={{ padding: "16px", margin: 0 }}>
           <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <ProjectsFilters />
            <ClientFilterDropdown clients={clients} />
          </div>
        </div>

        {/* Projects Table */}
        <div className="card" style={{ margin: 0 }}>
          <div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Name</th>
                  <th>Admin (Client)</th>
                  <th>POC</th>
                  <th>Location</th>
                  <th>Materials</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Delivery Date</th>
                  <th style={{ textAlign: "right" }}>Cost (incl. GST)</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: "60px", color: "var(--gray-500)" }}>
                      <FolderOpen size={48} style={{ margin: "0 auto 12px", strokeWidth: 1.5, color: "var(--gray-300)" }} />
                      <p style={{ fontWeight: 500 }}>No projects found</p>
                      <p style={{ fontSize: "13px", marginTop: "4px" }}>Try adjusting your search or organization filters.</p>
                    </td>
                  </tr>
                ) : (
                  projects.map((project) => {
                    const qty = project.collaterals?.reduce((sum, c) => sum + c.quantity, 0) || 0
                    
                    return (
                      <tr key={project.id}>
                        <td style={{ fontWeight: 600 }} className="font-mono">
                          {project.projectId}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: "var(--gray-900)", maxWidth: "200px", whiteSpace: "normal", wordBreak: "break-word" }}>
                            {project.name}
                          </div>
                        </td>
                        <td>
                          {project.tenantClient ? (
                            <div style={{ maxWidth: "150px", whiteSpace: "normal", wordBreak: "break-word" }}>
                              <Link 
                                href={`/superadmin/admins/${project.tenantClient.id}`}
                                style={{ fontWeight: 600, color: "#8b5cf6" }}
                                className="hover:underline"
                              >
                                {project.tenantClient.companyName}
                              </Link>
                            </div>
                          ) : (
                            <span style={{ color: "var(--gray-400)" }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ maxWidth: "150px", whiteSpace: "normal", wordBreak: "break-word" }}>
                            {project.poc?.name || project.pocName || "—"}
                          </div>
                        </td>
                        <td>
                          <div style={{ maxWidth: "120px", whiteSpace: "normal", wordBreak: "break-word" }}>
                            {project.location}
                          </div>
                        </td>
                        <td>
                          <MaterialCell materials={project.collaterals?.map(c => c.itemName).filter(Boolean) as string[]} />
                        </td>
                        <td className="font-mono">{qty.toLocaleString("en-IN")}</td>
                        <td>
                          <StatusBadge status={project.status} />
                        </td>
                        <td>
                          {new Date(project.deliveryDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }} className="font-mono">
                          ₹{project.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

