"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { openNewProjectModal } from "@/components/projects/new-project-modal"
import { EditProjectDialog } from "@/components/projects/edit-project-dialog"
import { StatusBadge } from "@/components/ui/status-badge"
import { toast } from "sonner"
import { CITIES } from "@/lib/branch-locations"
import { getPusherClient, CHANNELS, EVENTS } from "@/lib/pusher"

const PAGE_SIZE = 20

interface POC {
  id: string
  name: string
  role?: string
}

interface Project {
  id: string
  projectId: string
  name: string
  status: string
  location: string
  state?: string
  branch?: string
  deliveryDate: string
  totalCost: number
  grandTotal?: number
  packingCharges?: number | null
  packingChargesGstRate?: number | null
  poc?: { id: string; name: string; role?: string }
  client?: { id: string; name: string; role?: string }
  pocName?: string | null
  clientName?: string | null
  collaterals?: { id?: string; itemName: string; quantity: number; unitPrice?: number; totalPrice?: number; gstRate?: number | null; gstAmount?: number | null; specification?: string | null }[]
  recipientName?: string | null
  recipientContact?: string | null
  recipientBranch?: string | null
  piNumber?: string | null
  dispatch?: { courier: string; trackingId: string } | null
}

// SVG Icons
const PlusIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
  </svg>
)

const ViewIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

const EditIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const DeleteIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const ChevronLeftIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
  </svg>
)

// Global events
const PROJECT_CREATED_EVENT = "project-created"
const PROJECT_DELETED_EVENT = "project-deleted"

export function ProjectsPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [total, setTotal] = useState(0)
  const [pocs, setPocs] = useState<POC[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const mergedLocations = Array.from(new Set([...CITIES, ...locations])).sort()

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const isAdmin = session?.user?.role === "ADMIN"
  const isClient = session?.user?.role === "CLIENT"
  const isPoc = session?.user?.role === "POC"

  const params = {
    status: searchParams.get("status") || "",
    poc: searchParams.get("poc") || "",
    location: searchParams.get("location") || "",
    search: searchParams.get("search") || "",
    page: searchParams.get("page") || "1",
  }

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const queryParams = new URLSearchParams()
      if (params.status) queryParams.set("status", params.status)
      if (params.poc) queryParams.set("poc", params.poc)
      if (params.location) queryParams.set("location", params.location)
      if (params.search) queryParams.set("search", params.search)
      queryParams.set("page", params.page || "1")

      const res = await fetch(`/api/projects?${queryParams}`)
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects)
        setTotal(data.total)
        setPocs(data.pocs || [])
        setLocations(data.locations || [])
        setPage(data.page)
        setTotalPages(data.totalPages)
      }
    } catch {
      // silently fail
    } finally {
      setIsLoading(false)
    }
  }, [params.status, params.poc, params.location, params.search, params.page])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchData()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [fetchData])

  const buildUrl = (newParams: Record<string, string>) => {
    const p = { ...params, ...newParams }
    const qs = new URLSearchParams()
    Object.entries(p).forEach(([k, v]) => {
      if (v && v !== "all") qs.set(k, v)
    })
    return `/projects?${qs.toString()}`
  }

  const handleProjectCreated = useCallback(() => {
    fetchData()
    router.refresh()
  }, [fetchData, router])

  const handleProjectDeleted = useCallback(() => {
    fetchData()
    router.refresh()
  }, [fetchData, router])

  useEffect(() => {
    window.addEventListener(PROJECT_CREATED_EVENT, handleProjectCreated)
    window.addEventListener(PROJECT_DELETED_EVENT, handleProjectDeleted)
    return () => {
      window.removeEventListener(PROJECT_CREATED_EVENT, handleProjectCreated)
      window.removeEventListener(PROJECT_DELETED_EVENT, handleProjectDeleted)
    }
  }, [handleProjectCreated, handleProjectDeleted])

  useEffect(() => {
    const client = getPusherClient()
    const channel = client.subscribe(CHANNELS.PROJECTS)

    const handleCreated = () => {
      fetchData()
      router.refresh()
    }
    const handleUpdated = () => {
      fetchData()
      router.refresh()
    }
    const handleDeleted = () => {
      fetchData()
      router.refresh()
    }

    channel.bind(EVENTS.PROJECT_CREATED, handleCreated)
    channel.bind(EVENTS.PROJECT_UPDATED, handleUpdated)
    channel.bind(EVENTS.PROJECT_DELETED, handleDeleted)

    return () => {
      channel.unbind(EVENTS.PROJECT_CREATED, handleCreated)
      channel.unbind(EVENTS.PROJECT_UPDATED, handleUpdated)
      channel.unbind(EVENTS.PROJECT_DELETED, handleDeleted)
      client.unsubscribe(CHANNELS.PROJECTS)
    }
  }, [fetchData, router])

  const handleDelete = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
      if (res.ok) {
        window.dispatchEvent(new Event(PROJECT_DELETED_EVENT))
      }
    } catch {
      alert("Failed to delete project")
    }
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">All Projects</h1>
        <p className="page-subtitle">Complete project list with advanced filtering</p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--gray-200)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {!isPoc && (
            <select
              className="form-select"
              style={{ width: '200px' }}
              value={params.poc}
              onChange={(e) => router.push(buildUrl({ poc: e.target.value }))}
            >
              <option value="">All POCs</option>
              {pocs.map((poc) => (
                <option key={poc.id} value={poc.id}>{poc.name}</option>
              ))}
            </select>
          )}
          <select
            className="form-select"
            style={{ width: '200px' }}
            value={params.status}
            onChange={(e) => router.push(buildUrl({ status: e.target.value }))}
          >
            <option value="">All Status</option>
            <option value="REQUESTED">Requested</option>
            <option value="APPROVED">Approved</option>
            <option value="PRINTING">Printing</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            className="form-select"
            style={{ width: '200px' }}
            value={params.location}
            onChange={(e) => router.push(buildUrl({ location: e.target.value }))}
          >
            <option value="">All Cities</option>
            {mergedLocations.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
          {!isClient && (
            <button className="btn btn-primary" onClick={openNewProjectModal} style={{ marginLeft: 'auto' }}>
              <PlusIcon />
              New Project
            </button>
          )}
        </div>
      </div>

      {/* Projects Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--gray-500)' }}>
            <div className="animate-spin" style={{ width: '32px', height: '32px', border: '2px solid var(--axis-primary)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 16px' }} />
            <p>Loading projects...</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project ID</th>
                    <th>Name</th>
                    <th>Assigned To</th>
                    <th>Location</th>
                    <th>Branch</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Status</th>
                    <th>Delivery Date</th>
                    <th>Cost</th>
                    <th style={{ width: '140px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td className="project-id" onClick={() => router.push(`/projects/${project.id}`)} style={{ cursor: 'pointer' }}>
                        {project.projectId}
                      </td>
                      <td onClick={() => router.push(`/projects/${project.id}`)} style={{ cursor: 'pointer' }}>
                        <strong>{project.name}</strong>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {/* Line 1: POC */}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                            {project.poc?.name || project.pocName || "—"}
                            <span style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              backgroundColor: 'rgba(217, 119, 6, 0.1)',
                              color: '#d97706',
                              fontWeight: 500,
                              border: '1px solid rgba(217, 119, 6, 0.2)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              <span style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                backgroundColor: '#d97706'
                              }}></span>
                              POC
                            </span>
                          </span>
                          {/* Line 2: on behalf of */}
                          {(project.client || project.clientName) && (
                            <span style={{ color: 'var(--gray-400)', fontSize: '11px', paddingLeft: '8px' }}>
                              on behalf of
                            </span>
                          )}
                          {/* Line 3: Client */}
                          {(project.client || project.clientName) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                              {project.client?.name || project.clientName}
                              <span style={{
                                fontSize: '10px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                backgroundColor: 'rgba(2, 132, 199, 0.1)',
                                color: '#0284c7',
                                fontWeight: 500,
                                border: '1px solid rgba(2, 132, 199, 0.2)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}>
                                <span style={{
                                  width: '4px',
                                  height: '4px',
                                  borderRadius: '50%',
                                  backgroundColor: '#0284c7'
                                }}></span>
                                CLIENT
                              </span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{project.location}{project.state ? `, ${project.state}` : ''}</td>
                      <td>{project.branch || "—"}</td>
                      <td>{project.collaterals?.map((c) => c.itemName).join(", ") || "—"}</td>
                      <td className="font-mono">
                        {project.collaterals?.reduce((s, c) => s + c.quantity, 0).toLocaleString("en-IN")}
                      </td>
                      <td><StatusBadge status={project.status} /></td>
                      <td>{new Date(project.deliveryDate).toLocaleDateString('en-IN')}</td>
                      <td className="font-mono">
                        {(() => {
                          // Compute grand total from collateral gstAmounts when grandTotal is 0 (legacy projects)
                          const collateralGst = project.collaterals?.reduce((s, c) => s + (c.gstAmount ?? (c.totalPrice || 0) * ((c.gstRate ?? 18) / 100)), 0) ?? 0
                          const packingGst = (project.packingCharges || 0) * ((project.packingChargesGstRate ?? 18) / 100)
                          const computedGrandTotal = project.totalCost + collateralGst + packingGst
                          const displayGrandTotal = project.grandTotal && project.grandTotal > project.totalCost
                            ? project.grandTotal
                            : computedGrandTotal
                          const gstPart = displayGrandTotal - project.totalCost
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 600 }}>₹{displayGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                                (Base: ₹{project.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + GST: ₹{gstPart.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                              </span>
                            </div>
                          )
                        })()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <Link href={`/projects/${project.id}`}>
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} title="View">
                              <ViewIcon />
                            </button>
                          </Link>
                          {!isClient && (
                            <>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '12px' }}
                                title="Edit"
                                onClick={() => {
                                  setEditingProject(project)
                                  setEditDialogOpen(true)
                                }}
                              >
                                <EditIcon />
                              </button>
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--color-error)' }}
                                title="Delete"
                                onClick={() => handleDelete(project.id)}
                              >
                                <DeleteIcon />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {projects.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-500)' }}>
                        <h3>No projects found</h3>
                        <p>{isClient ? "You don't have any assigned projects yet" : "Try adjusting your filters or create a new project"}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid var(--gray-200)' }}>
                <p style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                  Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {page > 1 ? (
                    <Link href={buildUrl({ page: String(page - 1) })} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
                      <ChevronLeftIcon />
                    </Link>
                  ) : (
                    <button className="btn btn-secondary" style={{ padding: '6px 10px', opacity: 0.4 }} disabled>
                      <ChevronLeftIcon />
                    </button>
                  )}
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = i + 1
                    return (
                      <Link
                        key={p}
                        href={buildUrl({ page: String(p) })}
                        className={`btn ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '6px 12px', minWidth: '36px' }}
                      >
                        {p}
                      </Link>
                    )
                  })}
                  {page < totalPages ? (
                    <Link href={buildUrl({ page: String(page + 1) })} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
                      <ChevronRightIcon />
                    </Link>
                  ) : (
                    <button className="btn btn-secondary" style={{ padding: '6px 10px', opacity: 0.4 }} disabled>
                      <ChevronRightIcon />
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Project Dialog */}
      {editingProject && (
        <EditProjectDialog
          project={{
            id: editingProject.id,
            name: editingProject.name,
            pocId: editingProject.poc?.id || '',
            clientId: editingProject.client?.id || '',
            location: editingProject.location,
            branch: editingProject.branch,
            state: editingProject.state || '',
            deliveryDate: editingProject.deliveryDate,
            status: editingProject.status,
            material: editingProject.collaterals?.[0]?.itemName || '',
            quantity: editingProject.collaterals?.[0]?.quantity || 0,
            packingCharges: editingProject.packingCharges,
            packingChargesGstRate: editingProject.packingChargesGstRate,
            collaterals: editingProject.collaterals?.map((c, i) => ({
              id: c.id || String(i),
              itemName: c.itemName,
              quantity: c.quantity,
              unitPrice: c.unitPrice || 0,
              totalPrice: c.totalPrice || 0,
              gstRate: c.gstRate ?? 18,
              gstAmount: c.gstAmount ?? 0,
              specification: c.specification || '',
            })),
            recipientName: editingProject.recipientName,
            recipientContact: editingProject.recipientContact,
            recipientBranch: editingProject.recipientBranch,
            piNumber: editingProject.piNumber,
            dispatch: editingProject.dispatch,
          }}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          isAdmin={isAdmin}
          onSuccess={async (shouldRegeneratePI) => {
            fetchData()
            const projId = editingProject?.id
            setEditingProject(null)
            if (shouldRegeneratePI && projId) {
              toast.success("PI regenerated automatically after project update.")
            }
          }}
        />
      )}
    </div>
  )
}
