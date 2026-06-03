"use client"

import { use, useEffect, useState, useCallback } from "react"
import { redirect, useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { formatDate, formatCurrency } from "@/utils/formatters"
import { ProjectStatus } from "@prisma/client"
import { PISection } from "@/components/projects/pi-section"
import { FileUploadButton } from "@/components/projects/file-upload-button"
import { TrackButton } from "@/components/dispatch/track-button"
import { StatusBadge } from "@/components/ui/status-badge"
import { getPusherClient, CHANNELS, EVENTS } from "@/lib/pusher"

// Icons
const ArrowLeftIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
)

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
  pocId: string | null
  clientId: string | null
  location: string
  state: string
  branch: string
  totalCost: number
  packingCharges: number | null
  packingChargesGstRate: number | null
  deliveryDate: string | null
  instructions: string | null
  recipientName?: string | null
  recipientContact?: string | null
  recipientBranch?: string | null
  poc?: { id: string; name: string; email: string; phone: string; role?: string } | null
  client?: { id: string; name: string; email: string; phone: string; role?: string } | null
  tenantClient?: { id: string; companyName: string; companyLogoUrl: string | null } | null
  pocName?: string | null
  clientName?: string | null
  collaterals: { id: string; itemName: string; quantity: number; unitPrice: number; totalPrice: number; gstRate?: number | null; gstAmount?: number | null; specification?: string | null }[]
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

interface SuperAdminProjectDetailPageProps {
  params: Promise<{ id: string }>
}

export default function SuperAdminProjectDetailPage({ params }: SuperAdminProjectDetailPageProps) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<Project | null>(null)

  const fetchProject = useCallback(async (): Promise<Project | null> => {
    try {
      const res = await fetch(`/api/projects/${id}`)
      if (!res.ok) {
        router.replace("/superadmin/projects")
        return null
      }
      const data = await res.json()
      setProject(data)
      return data
    } catch {
      setProject(null)
      return null
    }
  }, [id, router])

  const refreshProject = async (): Promise<Project | null> => {
    setLoading(true)
    try {
      return await fetchProject()
    } finally {
      setLoading(false)
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

  // Real-time updates subscription via Pusher
  useEffect(() => {
    const client = getPusherClient()
    const channel = client.subscribe(CHANNELS.PROJECTS)

    const handleUpdated = (data?: { id?: string; projectId?: string }) => {
      if (!data || (!data.id && !data.projectId) || data.id === id || data.projectId === id) {
        void fetchProject()
      }
    }

    channel.bind(EVENTS.PROJECT_UPDATED, handleUpdated)

    return () => {
      channel.unbind(EVENTS.PROJECT_UPDATED, handleUpdated)
      client.unsubscribe(CHANNELS.PROJECTS)
    }
  }, [id, fetchProject])

  // Guard calculations until project is loaded
  const getStatusHistory = (status: ProjectStatus) =>
    project?.statusHistory.find((h) => h.status === status)

  // Timeline steps matching project state
  const timelineSteps = project ? [
    {
      title: "Order Received",
      date: project.createdAt,
      note: `Project created by ${project.poc?.name || project.pocName || "Unknown"}${project.branch ? ` • ${project.branch}` : ""}`,
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
        ? `Proforma Invoice ${project.piNumber} generated by ${project.poc?.name || project.pocName || "Unknown"}`
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
      date: project.files.find((f) => f.type === "PO")?.uploadedAt ?? null,
      note: project.files.some((f) => f.type === "PO")
        ? "Purchase Order received from client"
        : "Waiting for Purchase Order",
      done: project.files.some((f) => f.type === "PO"),
      active: project.piStatus === "VERIFIED" && !project.files.some((f) => f.type === "PO"),
    },
    {
      title: "Material Under Production",
      date: getStatusHistory(ProjectStatus.PRINTING)?.timestamp ?? null,
      note: getStatusHistory(ProjectStatus.PRINTING)?.note || "Production in progress",
      done: !!getStatusHistory(ProjectStatus.PRINTING) || project.status === ProjectStatus.PRINTING || project.status === ProjectStatus.DISPATCHED || project.status === ProjectStatus.DELIVERED,
      active: project.status === ProjectStatus.APPROVED && project.files.some((f) => f.type === "PO"),
    },
    {
      title: "Challan Uploaded",
      date: project.files.find((f) => f.type === "CHALLAN")?.uploadedAt ?? null,
      note: project.files.some((f) => f.type === "CHALLAN") ? "Delivery challan uploaded" : "Pending challan",
      done: project.files.some((f) => f.type === "CHALLAN"),
      active: project.status === ProjectStatus.PRINTING && !project.files.some((f) => f.type === "CHALLAN"),
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
      active: project.status === ProjectStatus.PRINTING && project.files.some((f) => f.type === "CHALLAN"),
    },
    {
      title: "Tax Invoice Generated",
      date: project.files.find((f) => f.type === "INVOICE")?.uploadedAt ?? null,
      note: project.files.some((f) => f.type === "INVOICE") ? "Tax invoice generated" : "Pending invoice",
      done: project.files.some((f) => f.type === "INVOICE"),
      active: project.status === ProjectStatus.DISPATCHED,
    },
  ] : []

  if (loading || !project) {
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

  // Cost calculations
  const itemsBaseCost = project.collaterals.reduce((sum, c) => sum + c.totalPrice, 0)
  const itemsGst = project.collaterals.reduce((sum, c) => sum + (c.gstAmount || (c.totalPrice * ((c.gstRate ?? 18) / 100))), 0)
  const packingBaseCost = project.packingCharges || 0
  const packingGst = packingBaseCost * ((project.packingChargesGstRate ?? 18) / 100)
  const totalBaseCost = itemsBaseCost + packingBaseCost
  const totalGst = itemsGst + packingGst
  const grandTotal = totalBaseCost + totalGst

  return (
    <div className="detail-container" style={{ maxWidth: '100%', width: '100%' }}>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', fontSize: '14px', color: 'var(--gray-600)' }}>
        <Link href="/superadmin/projects" style={{ color: 'var(--axis-accent)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            <span style={{ fontSize: '12px', padding: '6px 12px', background: 'var(--gray-100)', borderRadius: '6px', fontWeight: 600, color: 'var(--gray-600)' }}>
              View-Only Mode
            </span>
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
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#d97706' }}></span>
                  POC
                </span>
              </span>
              {/* Line 2: on behalf of */}
              {(project.client || project.clientName) && (
                <span style={{ color: 'var(--gray-400)', fontSize: '12px', paddingLeft: '8px' }}>
                  on behalf of
                </span>
              )}
              {/* Line 3: Client User */}
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
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#0284c7' }}></span>
                    CLIENT
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className="detail-field">
            <span className="detail-label">Client Organization</span>
            <span className="detail-value">
              {project.tenantClient ? (
                <Link
                  href={`/superadmin/admins/${project.tenantClient.id}`}
                  style={{ color: "#8b5cf6", textDecoration: "none", fontWeight: 700 }}
                  className="hover:underline"
                >
                  {project.tenantClient.companyName}
                </Link>
              ) : (
                "—"
              )}
            </span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Location</span>
            <span className="detail-value">{project.location}{project.state ? `, ${project.state}` : ""}</span>
          </div>
          <div className="detail-field">
            <span className="detail-label">Branch</span>
            <span className="detail-value">{project.branch || "—"}</span>
          </div>
          <div className="detail-field" style={{ gridColumn: '1 / -1' }}>
            <span className="detail-label">Delivery Address</span>
            <span className="detail-value">
              {project.recipientName ? `${project.recipientName} | ` : ""}
              {project.recipientContact ? `${project.recipientContact} | ` : ""}
              {project.recipientBranch ? `${project.recipientBranch}, ` : ""}
              {project.location}{project.state ? `, ${project.state}` : ""}, India
            </span>
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
                  <div key={c.id} className="item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{c.itemName}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--gray-600)', marginTop: '2px' }}>
                        Quantity: {c.quantity.toLocaleString("en-IN")} @ {formatCurrency(c.unitPrice)}
                        {c.specification ? ` • Spec: ${c.specification}` : ""}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(c.totalPrice)}
                    </div>
                  </div>
                ))}
                {project.packingCharges != null && project.packingCharges > 0 && (
                  <div className="item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59, 130, 246, 0.05)', marginTop: '8px', padding: '12px', borderRadius: '6px', border: '1px dashed var(--gray-300)' }}>
                    <div>
                      <strong>Packaging Charges</strong>
                      <div style={{ fontSize: '12px', color: 'var(--gray-600)', marginTop: '2px' }}>GST @ {project.packingChargesGstRate ?? 18}%</div>
                    </div>
                    <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(project.packingCharges)}
                    </div>
                  </div>
                )}
                  <div className="item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: 'var(--gray-100)', marginTop: '12px', padding: '12px', borderRadius: '6px' }}>
                    <strong>Total Project Cost (excl. GST)</strong>
                    <strong style={{ fontSize: '18px', color: 'var(--axis-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(itemsBaseCost + packingBaseCost)}
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
                <div className="item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--gray-200)' }}>
                  <span style={{ color: 'var(--gray-600)' }}>Items Cost (excl. GST):</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(itemsBaseCost)}
                  </span>
                </div>
                {/* Packing Charges */}
                {packingBaseCost > 0 && (
                  <div className="item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--gray-200)' }}>
                    <span style={{ color: 'var(--gray-600)' }}>Packing Charges:</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(packingBaseCost)}
                    </span>
                  </div>
                )}
                {/* Total Base Cost */}
                <div className="item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--gray-200)', background: 'rgba(0,0,0,0.02)' }}>
                  <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Total Base Cost:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(totalBaseCost)}
                  </span>
                </div>
                {/* GST on Items */}
                <div className="item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--gray-200)' }}>
                  <span style={{ color: 'var(--gray-600)' }}>GST on Items:</span>
                  <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(itemsGst)}
                  </span>
                </div>
                {/* GST on Packing */}
                {packingBaseCost > 0 && (
                  <div className="item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--gray-200)' }}>
                    <span style={{ color: 'var(--gray-600)' }}>GST on Packing ({project.packingChargesGstRate ?? 18}%):</span>
                    <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(packingGst)}
                    </span>
                  </div>
                )}
                {/* Total GST */}
                <div className="item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--gray-200)', background: 'rgba(0,0,0,0.02)' }}>
                  <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>Total GST:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(totalGst)}
                  </span>
                </div>
                {/* Grand Total */}
                  <div className="item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: 'none', marginTop: '8px', borderTop: '2px solid var(--gray-300)' }}>
                    <strong style={{ color: 'var(--gray-900)', fontSize: '16px' }}>Total Amount (incl. GST):</strong>
                    <strong style={{ fontSize: '20px', color: 'var(--axis-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(grandTotal)}
                    </strong>
                  </div>
              </div>
            </div>
          </div>

          {/* Lead Tracking & ROI */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">Lead Tracking & ROI</h3>
                <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: '4px 0 0 0' }}>Campaign results entered by tenant</p>
              </div>
            </div>
            <div className="card-body">
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
                    {project.leadsGenerated ? formatCurrency(grandTotal / project.leadsGenerated) : '—'}
                  </span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Cost Per Acquisition</span>
                  <span className="detail-value" style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                    {project.leadsConverted ? formatCurrency(grandTotal / project.leadsConverted) : '—'}
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
                  onUpdate={fetchProject}
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
                isAdmin={false}
                canUpload={false}
                canDelete={false}
              />

              {/* Delivery Challan */}
              <FileUploadButton
                projectId={project.id}
                fileType="CHALLAN"
                label="Delivery Challan"
                existingFiles={project.files.filter((f) => f.type === "CHALLAN")}
                isAdmin={false}
                canUpload={false}
                canDelete={false}
              />

              {/* Tax Invoice */}
              <FileUploadButton
                projectId={project.id}
                fileType="INVOICE"
                label="Tax Invoice"
                existingFiles={project.files.filter((f) => f.type === "INVOICE")}
                isAdmin={false}
                canUpload={false}
                canDelete={false}
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
    </div>
  )
}
