"use client"

import { use, useEffect, useState } from "react"
import { redirect, useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { formatDate, formatCurrency, extractBaseCostFromTotal, extractGSTFromTotal } from "@/utils/formatters"
import { ProjectStatus, FileType } from "@prisma/client"
import { UpdateStatusButton } from "@/components/projects/update-status-button"
import { DeleteProjectButton } from "@/components/projects/delete-project-button"
import { EditProjectDialog } from "@/components/projects/edit-project-dialog"
import { FileUploadButton } from "@/components/projects/file-upload-button"
import { PISection } from "@/components/projects/pi-section"
import { TrackButton } from "@/components/dispatch/track-button"
import { StatusBadge } from "@/components/ui/status-badge"
import { toast } from "sonner"

// SVG Icons matching HTML exactly
const ArrowLeftIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
)

const EditIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const UploadIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
)

const DownloadIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const TrashIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>
}

interface ProjectFile {
  id: string
  type: "PO" | "CHALLAN" | "INVOICE"
  url: string
  filename: string
  size: number | null
  uploadedAt: string
}

interface Project {
  id: string
  projectId: string
  name: string
  description: string | null
  status: ProjectStatus
  piNumber: string | null
  piStatus: string | null
  piPdfUrl: string | null
  piGeneratedAt: string | null
  piVerifiedAt: string | null
  createdAt: string
  pocId: string
  clientId: string
  location: string
  state: string
  branch: string
  totalCost: number
  packingCharges: number | null
  packingChargesGstRate: number | null
  deliveryDate: string | null
  instructions: string | null
  poc: { id: string; name: string; email: string; phone: string; role?: string }
  client: { id: string; name: string; email: string; phone: string; role?: string }
  collaterals: { id: string; itemName: string; quantity: number; unitPrice: number; totalPrice: number; gstRate?: number | null }[]
  statusHistory: { id: string; status: ProjectStatus; note: string | null; timestamp: string }[]
  files: ProjectFile[]
  dispatch: {
    dispatchDate: string | null
    courier: string
    trackingId: string
    expectedDelivery: string | null
    actualDelivery: string | null
  } | null
  approval: {
    status: string
    requestedById: string
    approvedById: string | null
    approvedAt: string | null
  } | null
  leadsGenerated: number | null
  leadsConverted: number | null
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [approving, setApproving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)
  const [editingLeads, setEditingLeads] = useState(false)
  const [leadsGen, setLeadsGen] = useState('')
  const [leadsConv, setLeadsConv] = useState('')
  const [savingLeads, setSavingLeads] = useState(false)
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<Project | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  const fetchProject = async (): Promise<Project | null> => {
    try {
      const res = await fetch(`/api/projects/${id}`)
      if (!res.ok) {
        router.replace("/projects")
        return null
      }
      const data = await res.json()
      setProject(data)
      return data
    } catch {
      setProject(null)
      return null
    }
  }

  const refreshProject = async (): Promise<Project | null> => {
    setLoading(true)
    try {
      return await fetchProject()
    } finally {
      setLoading(false)
    }
  }

  const handleProjectUpdated = async (shouldRegeneratePI = false) => {
    if (shouldRegeneratePI && project?.piNumber) {
      setLoading(true)
      try {
        const res = await fetch(`/api/projects/${id}/generate-pi`, { method: "POST" })
        const data = await res.json()
        if (res.ok) {
          toast.success("PI regenerated automatically after project update.")
          await fetchProject()
        } else {
          toast.error(data.error || "Failed to regenerate PI after project update.")
          await fetchProject()
        }
      } catch (error) {
        toast.error("Failed to regenerate PI after project update.")
        await fetchProject()
      } finally {
        setLoading(false)
      }
    } else {
      await refreshProject()
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login")
    }
    if (status === "authenticated" && id) {
      refreshProject()
    }
  }, [id, router, status])

  // Guard calculations until project is loaded
  const getStatusHistory = (status: ProjectStatus) =>
    project?.statusHistory.find((h) => h.status === status)

  const isAdmin = session?.user?.role === "ADMIN"
  const isClient = session?.user?.role === "CLIENT"
  const isOwner = project?.pocId === session?.user?.id
  const canManageOwnProject = !!isOwner && !isClient
  const projectApprovedByAdmin = project?.approval?.status === "APPROVED" || (
    project?.status !== ProjectStatus.REQUESTED && project?.status !== ProjectStatus.CANCELLED
  )
  const pocCanManageAfterApproval = canManageOwnProject && projectApprovedByAdmin && project?.piStatus === "VERIFIED"
  const canEditProject = isAdmin || (canManageOwnProject && project?.status === "REQUESTED")
  const canDeleteProject = isAdmin || canManageOwnProject
  const canUpdateStatus = isAdmin || pocCanManageAfterApproval
  const canUploadDocuments = isAdmin || pocCanManageAfterApproval

  // Timeline steps with correct flow
  const timelineSteps = project ? [
    {
      title: "Order Received",
      date: project.createdAt,
      note: `Project created by ${project.poc?.name}${project.branch ? ` • ${project.branch}` : ""}`,
      done: true,
    },
    {
      title: "Project Approved",
      date: getStatusHistory(ProjectStatus.APPROVED)?.timestamp ?? project.approval?.approvedAt ?? null,
      note: (() => {
        if (project.approval?.status === "APPROVED") {
          return "Project approved by Admin"
        }
        if (project.approval?.status === "REJECTED") {
          return "Project rejected - needs revision"
        }
        return "Pending admin approval"
      })(),
      done: project.approval?.status === "APPROVED" || !!getStatusHistory(ProjectStatus.APPROVED),
      active: project.status === ProjectStatus.REQUESTED || project.approval?.status === "PENDING",
    },
    {
      title: "PI Created",
      date: project.piGeneratedAt ?? null,
      note: project.piNumber && project.piPdfUrl
        ? `Proforma Invoice ${project.piNumber} generated by ${project.poc?.name}`
        : "Waiting for PI generation",
      done: !!project.piNumber && !!project.piPdfUrl,
      active: project.approval?.status === "APPROVED" && (!project.piNumber || !project.piPdfUrl),
    },
    {
      title: "PI Verified",
      date: project.piVerifiedAt ?? null,
      note: (() => {
        if (project.piStatus === "VERIFIED") {
          return "PI verified by Admin - ready to proceed"
        }
        if (project.piStatus === "REJECTED") {
          return "PI rejected - needs regeneration"
        }
        if (project.piNumber) {
          return "PI pending admin verification"
        }
        return "Waiting for PI generation"
      })(),
      done: project.piStatus === "VERIFIED",
      active: project.piStatus === "PENDING",
    },
    {
      title: "PO Generated",
      date: project.files.find((f) => f.type === FileType.PO)?.uploadedAt ?? null,
      note: project.files.some((f) => f.type === FileType.PO)
        ? "Purchase Order received from client"
        : "Waiting for Purchase Order",
      done: project.files.some((f) => f.type === FileType.PO),
      active: project.piStatus === "VERIFIED" && !project.files.some((f) => f.type === FileType.PO),
    },
    {
      title: "Material Under Production",
      date: getStatusHistory(ProjectStatus.PRINTING)?.timestamp ?? null,
      note: getStatusHistory(ProjectStatus.PRINTING)?.note || "Production in progress",
      done: !!getStatusHistory(ProjectStatus.PRINTING) || project.status === ProjectStatus.PRINTING || project.status === ProjectStatus.DISPATCHED || project.status === ProjectStatus.DELIVERED,
      active: project.status === ProjectStatus.APPROVED && project.files.some((f) => f.type === FileType.PO),
    },
    {
      title: "Material Dispatched",
      date: project.dispatch?.dispatchDate ?? null,
      note: (() => {
        if (!project.dispatch) return "Waiting for dispatch"
        const dispatchInfo = `Shipped via ${project.dispatch.courier}`
        const tracking = project.dispatch.trackingId ? ` • Tracking: ${project.dispatch.trackingId}` : ""
        return dispatchInfo + tracking
      })(),
      done: !!project.dispatch?.dispatchDate || project.status === ProjectStatus.DISPATCHED || project.status === ProjectStatus.DELIVERED,
      active: project.status === ProjectStatus.PRINTING && project.files.some((f) => f.type === FileType.CHALLAN),
    },
    {
      title: "Challan Uploaded",
      date: project.files.find((f) => f.type === FileType.CHALLAN)?.uploadedAt ?? null,
      note: project.files.some((f) => f.type === FileType.CHALLAN) ? "Delivery challan uploaded" : "Pending challan",
      done: project.files.some((f) => f.type === FileType.CHALLAN),
      active: project.status === ProjectStatus.DISPATCHED,
    },
    {
      title: "Tax Invoice Generated",
      date: project.files.find((f) => f.type === FileType.INVOICE)?.uploadedAt ?? null,
      note: project.files.some((f) => f.type === FileType.INVOICE) ? "Tax invoice generated" : "Pending invoice",
      done: project.files.some((f) => f.type === FileType.INVOICE),
      active: project.status === ProjectStatus.DISPATCHED,
    },
  ] : []

  if (!project) {
    return (
      <div style={{ padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <div style={{ width: '24px', height: '24px', background: 'var(--gray-200)', borderRadius: '4px' }} />
          <div style={{ width: '150px', height: '16px', background: 'var(--gray-200)', borderRadius: '4px' }} />
        </div>
        <div style={{ height: '200px', background: 'var(--gray-100)', borderRadius: '14px' }} />
      </div>
    )
  }

  return (
    <div className="detail-container">
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '14px', color: 'var(--gray-600)' }}>
        <Link href="/projects" style={{ color: 'var(--axis-accent)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeftIcon /> Back to All Projects
        </Link>
      </div>

      {/* Project Header */}
      <div className="detail-header">
        <div className="detail-header-top">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
              <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: 'var(--gray-900)' }}>{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', fontSize: '14px', color: 'var(--gray-600)' }}>
              <span><strong>Project ID:</strong> <span className="project-id">{project.projectId}</span></span>
              <span><strong>PI Number:</strong> <span className="font-mono">{project.piNumber || "—"}</span></span>
              <span><strong>Created:</strong> {formatDate(project.createdAt)}</span>
            </div>
          </div>
          <div className="detail-actions">
            {/* Project actions */}
            {(canEditProject || canUpdateStatus || canDeleteProject || isAdmin) && (
              <>
                {canEditProject && (
                  <button type="button" className="btn btn-secondary" onClick={() => setEditDialogOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <span style={{ pointerEvents: 'none' }}><EditIcon /></span> Edit Project
                  </button>
                )}
                {canUpdateStatus && <UpdateStatusButton projectId={project.id} currentStatus={project.status} />}
                {canDeleteProject && <DeleteProjectButton projectId={project.id} />}
              </>
            )}
          </div>
        </div>

        {/* Detail Grid */}
        <div className="detail-grid">
          <div className="detail-field">
            <span className="detail-label">Order Date</span>
            <span className="detail-value">{formatDate(project.createdAt)}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Assigned To</span>
            <div className="detail-value" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {/* Line 1: POC */}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                {project.poc.name}
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
              {project.client && (
                <span style={{ color: 'var(--gray-400)', fontSize: '12px', paddingLeft: '8px' }}>
                  on behalf of
                </span>
              )}
              {/* Line 3: Client */}
              {project.client && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  {project.client.name}
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
          </div>
          <div className="detail-field">
            <span className="detail-label">Company Name</span>
            <span className="detail-value">Axis Max Life Insurance</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Location</span>
            <span className="detail-value">{project.location}, {project.state}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Branch</span>
            <span className="detail-value">{project.branch || "—"}</span>
          </div>
          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-label">Delivery Address</span>
            <span className="detail-value">Axis Max Life Insurance, {project.location}, {project.state}, India</span>
          </div>
          {project.description && (
            <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
              <span className="detail-label">Description</span>
              <span className="detail-value">{project.description}</span>
            </div>
          )}
          {project.instructions && (
            <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
              <span className="detail-label">Special Instructions</span>
              <span className="detail-value">{project.instructions}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Items & Collaterals */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Items & Collaterals</h3>
            </div>
            <div className="card-body">
              <div className="items-list">
                {project.collaterals.map((c) => (
                  <div key={c.id} className="item-row">
                    <div>
                      <strong>{c.itemName}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--gray-600)', marginTop: '2px' }}>Quantity: {c.quantity.toLocaleString("en-IN")}</div>
                    </div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(c.totalPrice)}
                    </div>
                  </div>
                ))}
                {project.packingCharges != null && project.packingCharges > 0 && (
                  <div className="item-row" style={{ background: 'rgba(59, 130, 246, 0.05)', marginTop: '8px', padding: '12px', borderRadius: '6px', border: '1px dashed var(--gray-300)' }}>
                    <div>
                      <strong>Packaging Charges</strong>
                      <div style={{ fontSize: '12px', color: 'var(--gray-600)', marginTop: '2px' }}>GST @ {project.packingChargesGstRate || 18}%</div>
                    </div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(project.packingCharges)}
                    </div>
                  </div>
                )}
                <div className="item-row" style={{ background: 'var(--gray-100)', marginTop: '12px', padding: '12px', borderRadius: '6px' }}>
                  <strong>Total Project Cost (excl. GST)</strong>
                  <strong style={{ fontSize: '18px', color: 'var(--axis-primary)', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(project.collaterals.reduce((sum, c) => sum + c.totalPrice, 0) + (project.packingCharges || 0))}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Cost Breakdown</h3>
            </div>
            <div className="card-body">
              <div className="items-list" style={{ background: 'var(--gray-0)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                {/* Items Base Cost */}
                <div className="item-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-200)' }}>
                  <span style={{ color: 'var(--gray-600)' }}>Items Cost (excl. GST):</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(project.collaterals.reduce((sum, c) => sum + c.totalPrice, 0))}
                  </span>
                </div>
                {/* Packing Charges (if any) */}
                {project.packingCharges != null && project.packingCharges > 0 && (
                  <div className="item-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-200)' }}>
                    <span style={{ color: 'var(--gray-600)' }}>Packing Charges:</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(project.packingCharges)}
                    </span>
                  </div>
                )}
                {/* Total Base Cost */}
                <div className="item-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-200)', background: 'rgba(0,0,0,0.02)' }}>
                  <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Total Base Cost:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(project.collaterals.reduce((sum, c) => sum + c.totalPrice, 0) + (project.packingCharges || 0))}
                  </span>
                </div>
                {/* GST on Items */}
                <div className="item-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-200)' }}>
                  <span style={{ color: 'var(--gray-600)' }}>GST on Items:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(project.collaterals.reduce((sum, c) => sum + (c.totalPrice * ((c.gstRate || 18) / 100)), 0))}
                  </span>
                </div>
                {/* GST on Packing (if any) */}
                {project.packingCharges != null && project.packingCharges > 0 && (
                  <div className="item-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-200)' }}>
                    <span style={{ color: 'var(--gray-600)' }}>GST on Packing ({project.packingChargesGstRate || 18}%):</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency((project.packingCharges || 0) * ((project.packingChargesGstRate || 18) / 100))}
                    </span>
                  </div>
                )}
                {/* Total GST */}
                <div className="item-row" style={{ padding: '8px 0', borderBottom: '1px solid var(--gray-200)', background: 'rgba(0,0,0,0.02)' }}>
                  <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Total GST:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(
                      project.collaterals.reduce((sum, c) => sum + (c.totalPrice * ((c.gstRate || 18) / 100)), 0) +
                      ((project.packingCharges || 0) * ((project.packingChargesGstRate || 18) / 100))
                    )}
                  </span>
                </div>
                {/* Grand Total */}
                <div className="item-row" style={{ padding: '12px 0', borderBottom: 'none', marginTop: '8px', borderTop: '2px solid var(--gray-300)' }}>
                  <strong style={{ color: 'var(--gray-900)', fontSize: '16px' }}>Total Amount (incl. GST):</strong>
                  <strong style={{ fontSize: '20px', color: 'var(--axis-primary)', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(
                      project.collaterals.reduce((sum, c) => sum + c.totalPrice, 0) +
                      (project.packingCharges || 0) +
                      project.collaterals.reduce((sum, c) => sum + (c.totalPrice * ((c.gstRate || 18) / 100)), 0) +
                      ((project.packingCharges || 0) * ((project.packingChargesGstRate || 18) / 100))
                    )}
                  </strong>
                </div>
              </div>
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0, 168, 204, 0.1)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--axis-accent)' }}>
                <p style={{ fontSize: '13px', color: 'var(--gray-600)', margin: 0 }}>
                  💡 GST is applied per item at its rate. Packing @ {project.packingChargesGstRate || 18}%. Total shown is the final amount.
                </p>
              </div>
            </div>
          </div>

          {/* Lead Tracking & ROI */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Lead Tracking & ROI</h3>
                <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: '4px 0 0 0' }}>Enter campaign results after the event runs</p>
              </div>
              {/* Lead data entry - Admin or project owner (POC/CLIENT) when delivered */}
              {(isAdmin || (isOwner && project.status === 'DELIVERED')) && !editingLeads && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  onClick={() => {
                    setLeadsGen(project.leadsGenerated?.toString() || '')
                    setLeadsConv(project.leadsConverted?.toString() || '')
                    setEditingLeads(true)
                  }}
                >
                  {project.leadsGenerated ? 'Update' : 'Add Data'}
                </button>
              )}
              {(isAdmin || isOwner) && editingLeads && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => setEditingLeads(false)}
                    disabled={savingLeads}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={async () => {
                      const gen = parseInt(leadsGen) || 0
                      const conv = parseInt(leadsConv) || 0

                      if (conv > gen) {
                        alert('Converted leads cannot exceed generated leads')
                        return
                      }

                      setSavingLeads(true)
                      try {
                        const res = await fetch(`/api/projects/${project.id}/leads`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            leadsGenerated: gen || null,
                            leadsConverted: conv || null,
                          }),
                        })
                        if (res.ok) {
                          setEditingLeads(false)
                          // Update local project state to reflect changes immediately
                          setProject(prev => prev ? {
                            ...prev,
                            leadsGenerated: gen || null,
                            leadsConverted: conv || null
                          } : null)
                          toast.success('Lead data saved successfully!')
                          router.refresh()
                        } else {
                          const data = await res.json()
                          alert(data.error || 'Failed to save')
                        }
                      } catch {
                        alert('Network error')
                      } finally {
                        setSavingLeads(false)
                      }
                    }}
                    disabled={savingLeads}
                  >
                    {savingLeads ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
            <div className="card-body">
              {editingLeads ? (
                <div className="detail-grid">
                  <div className="detail-field">
                    <span className="detail-label">Leads Generated</span>
                    <input
                      type="number"
                      min="0"
                      value={leadsGen}
                      onChange={(e) => setLeadsGen(e.target.value)}
                      disabled={savingLeads}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--gray-300)',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--axis-primary)',
                      }}
                    />
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Leads Converted</span>
                    <input
                      type="number"
                      min="0"
                      value={leadsConv}
                      onChange={(e) => setLeadsConv(e.target.value)}
                      disabled={savingLeads}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--gray-300)',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: 'var(--color-success)',
                      }}
                    />
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Cost Per Lead</span>
                    <span className="detail-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {leadsGen && parseInt(leadsGen) > 0 ? formatCurrency(project.totalCost / parseInt(leadsGen)) : '—'}
                    </span>
                  </div>
                  <div className="detail-field">
                    <span className="detail-label">Cost Per Acquisition</span>
                    <span className="detail-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {leadsConv && parseInt(leadsConv) > 0 ? formatCurrency(project.totalCost / parseInt(leadsConv)) : '—'}
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="detail-grid">
                    <div className="detail-field">
                      <span className="detail-label">Leads Generated</span>
                      <span className="detail-value" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--axis-primary)' }}>
                        {project.leadsGenerated || 0}
                      </span>
                    </div>
                    <div className="detail-field">
                      <span className="detail-label">Leads Converted</span>
                      <span className="detail-value" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-success)' }}>
                        {project.leadsConverted || 0}
                      </span>
                    </div>
                    <div className="detail-field">
                      <span className="detail-label">Cost Per Lead</span>
                      <span className="detail-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {project.leadsGenerated ? formatCurrency(project.totalCost / project.leadsGenerated) : '—'}
                      </span>
                    </div>
                    <div className="detail-field">
                      <span className="detail-label">Cost Per Acquisition</span>
                      <span className="detail-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                        {project.leadsConverted ? formatCurrency(project.totalCost / project.leadsConverted) : '—'}
                      </span>
                    </div>
                  </div>
                  {(project.leadsGenerated ?? 0) > 0 && (
                    <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-success)' }}>
                      <p style={{ fontSize: '13px', color: 'var(--gray-600)', margin: 0 }}>
                        <strong>Conversion Rate:</strong> {(((project.leadsConverted ?? 0) / (project.leadsGenerated ?? 1)) * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Dispatch & Delivery Information */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Dispatch & Delivery Information</h3>
            </div>
            <div className="card-body">
              <div className="detail-grid">
                <div className="detail-field">
                  <span className="detail-label">Dispatch Date</span>
                  <span className="detail-value">{project.dispatch?.dispatchDate ? formatDate(project.dispatch.dispatchDate) : <span style={{ color: 'var(--gray-400)' }}>Not yet dispatched</span>}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Expected Delivery</span>
                  <span className="detail-value">{project.dispatch?.expectedDelivery ? formatDate(project.dispatch.expectedDelivery) : project.deliveryDate ? formatDate(project.deliveryDate) : <span style={{ color: 'var(--gray-400)' }}>Not set</span>}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Courier Partner</span>
                  <span className="detail-value">{project.dispatch?.courier || <span style={{ color: 'var(--gray-400)' }}>Not assigned</span>}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Tracking Number</span>
                  <span className="detail-value font-mono" style={{ color: 'var(--axis-accent)' }}>{project.dispatch?.trackingId || <span style={{ color: 'var(--gray-400)' }}>Not available</span>}</span>
                </div>
              </div>
              {project.dispatch?.trackingId && (
                <div style={{ marginTop: '16px' }}>
                  <TrackButton
                    courier={project.dispatch.courier}
                    trackingId={project.dispatch.trackingId}
                    dispatchDate={project.dispatch.dispatchDate}
                    expectedDelivery={project.dispatch.expectedDelivery}
                    actualDelivery={project.dispatch.actualDelivery}
                    variant="secondary"
                    fullWidth
                  />
                </div>
              )}
              {/* Payment Reminder Button - Admin only, for delivered projects */}
              {isAdmin && project.status === 'DELIVERED' && project.files.some(f => f.type === 'INVOICE') && (
                <div style={{ marginTop: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={async () => {
                      if (!confirm('Are you sure you want to send a payment reminder email to the POC?')) return

                      try {
                        const res = await fetch(`/api/projects/${project.id}/payment-reminder`, {
                          method: 'POST',
                        })

                        if (res.ok) {
                          toast.success('Payment reminder sent successfully!')
                        } else {
                          const data = await res.json()
                          toast.error(data.error || 'Failed to send payment reminder')
                        }
                      } catch (error) {
                        console.error('Error sending payment reminder:', error)
                        toast.error('Network error - failed to send payment reminder')
                      }
                    }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Send Payment Reminder
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Proforma Invoice (PI) Section */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Proforma Invoice (PI)</h3>
            </div>
            <div className="card-body">
              {project && (
                <PISection
                  projectId={project.id}
                  piNumber={project.piNumber}
                  piStatus={project.piStatus}
                  piPdfUrl={project.piPdfUrl}
                  piGeneratedAt={project.piGeneratedAt}
                  piVerifiedAt={project.piVerifiedAt}
                  userRole={session?.user?.role || ""}
                  userId={session?.user?.id || ""}
                  pocId={project.pocId}
                  clientId={project.clientId}
                />
              )}
            </div>
          </div>

          {/* Documents & Files */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Documents & Files</h3>
            </div>
            <div className="card-body">
              {/* Purchase Order */}
              <FileUploadButton
                projectId={project.id}
                fileType="PO"
                label="Purchase Order (PO)"
                existingFiles={project.files.filter((f) => f.type === "PO")}
                isAdmin={isAdmin}
                canUpload={canUploadDocuments}
                canDelete={isAdmin}
              />

              {/* Delivery Challan */}
              <FileUploadButton
                projectId={project.id}
                fileType="CHALLAN"
                label="Delivery Challan"
                existingFiles={project.files.filter((f) => f.type === "CHALLAN")}
                isAdmin={isAdmin}
                canUpload={canUploadDocuments}
                canDelete={isAdmin}
              />

              {/* Tax Invoice */}
              <FileUploadButton
                projectId={project.id}
                fileType="INVOICE"
                label="Tax Invoice"
                existingFiles={project.files.filter((f) => f.type === "INVOICE")}
                isAdmin={isAdmin}
                canUpload={canUploadDocuments}
                canDelete={isAdmin}
              />
            </div>
          </div>
        </div>

        {/* Right Column - Timeline */}
        <div>
          <div className="card" style={{ position: 'sticky', top: '90px' }}>
            <div className="card-header">
              <h3 className="card-title">Project Timeline</h3>
            </div>
            <div className="card-body">
              <div className="timeline">
                {timelineSteps.map((step, i) => (
                  <div key={i} className="timeline-item">
                    <div className={`timeline-dot ${step.done ? 'completed' : step.active ? 'active' : 'pending'}`} />
                    <div className="timeline-content">
                      <h4 className="timeline-title">{step.title}</h4>
                      <div className="timeline-meta">
                        {step.date ? <><strong>Date:</strong> {formatDate(step.date)}</> : <span style={{ color: 'var(--gray-400)' }}>Pending</span>}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--gray-600)', marginTop: '8px' }}>{step.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Project Dialog */}
      {project && (
        <EditProjectDialog
          project={project}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          isAdmin={isAdmin}
          onSuccess={(shouldRegeneratePI) => {
            handleProjectUpdated(shouldRegeneratePI)
          }}
        />
      )}
    </div>
  )
}
