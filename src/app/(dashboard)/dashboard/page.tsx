import { prisma } from "@/lib/prisma"
import { ProjectStatus, ApprovalStatus, Prisma } from "@prisma/client"
import Link from "next/link"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { StatusBadge } from "@/components/ui/status-badge"
import { DashboardRealtimeRefresh } from "@/components/dashboard/dashboard-realtime-refresh"

// SVG Icons matching HTML file
const FolderIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

const ClockIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const PrinterIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
  </svg>
)

const TruckIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
)

const CheckIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const XCircleIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const RupeeIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 8h6M9 11h6M9 14h2a3 3 0 0 0 0-6M9 14l5 5" />
  </svg>
)

async function getDashboardStats(projectFilter: Prisma.ProjectWhereInput) {
  const [
    totalProjects,
    pendingApproval,
    inProduction,
    inTransit,
    delivered,
    cancelled,
    totalSpend,
    recentProjects,
  ] = await Promise.all([
    prisma.project.count({ where: { ...projectFilter, status: { not: ProjectStatus.CANCELLED } } }),
    prisma.project.count({ where: { ...projectFilter, status: ProjectStatus.REQUESTED } }),
    prisma.project.count({ where: { ...projectFilter, status: ProjectStatus.PRINTING } }),
    prisma.project.count({ where: { ...projectFilter, status: ProjectStatus.DISPATCHED } }),
    prisma.project.count({ where: { ...projectFilter, status: ProjectStatus.DELIVERED } }),
    prisma.project.count({ where: { ...projectFilter, status: ProjectStatus.CANCELLED } }),
    prisma.project.aggregate({ 
      where: { 
        ...projectFilter, 
        status: { not: ProjectStatus.CANCELLED },
        approval: { status: ApprovalStatus.APPROVED }
      }, 
      _sum: { totalCost: true, grandTotal: true } 
    }),
    prisma.project.findMany({
      where: projectFilter,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { poc: { select: { name: true, role: true } }, client: { select: { name: true, role: true } } },
    })
  ])

  const totalSpendWithGST = totalSpend._sum.grandTotal || 0
  const totalBaseCost = totalSpend._sum.totalCost || 0
  const totalGST = totalSpendWithGST - totalBaseCost

  return {
    totalProjects,
    pendingApproval,
    inProduction,
    inTransit,
    delivered,
    cancelled,
    totalSpendWithGST,
    totalBaseCost,
    totalGST,
    recentProjects,
  }
}

function StatCard({ label, value, icon, iconBg, iconColor, className = "" }: {
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  className?: string
}) {
  const valueStr = String(value)
  let fontSize = "32px"
  if (valueStr.length > 10) {
    fontSize = "18px"
  } else if (valueStr.length > 8) {
    fontSize = "22px"
  } else if (valueStr.length > 6) {
    fontSize = "26px"
  }

  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-header">
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ fontSize, transition: 'font-size 0.2s' }}>{value}</div>
        </div>
        <div className="stat-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  // POC and CLIENT only see their own projects
  const projectFilter = session?.user.role === "POC"
    ? { pocId: session.user.id }
    : session?.user.role === "CLIENT"
      ? { clientId: session.user.id }
      : {}
  const stats = await getDashboardStats(projectFilter)

  return (
    <div>
      <DashboardRealtimeRefresh />
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          {session?.user.role === "CLIENT" ? "My Project Dashboard" : "Dashboard Overview"}
        </h1>
        <p className="page-subtitle">
          {session?.user.role === "CLIENT"
            ? "Track your assigned print projects and orders"
            : "Real-time insights into print operations across 480+ locations"}
        </p>
      </div>

      {/* Stats Grid - CLIENT sees personalized view */}
      <div className="stats-grid">
        <StatCard
          label={session?.user.role === "CLIENT" ? "My Projects" : "Active Projects"}
          value={stats.totalProjects}
          icon={<FolderIcon />}
          iconBg="rgba(0, 168, 204, 0.1)"
          iconColor="var(--axis-accent)"
        />
        {session?.user.role !== "CLIENT" && (
          <StatCard
            label="Pending Approval"
            value={stats.pendingApproval}
            icon={<ClockIcon />}
            iconBg="rgba(139, 92, 246, 0.1)"
            iconColor="var(--status-requested)"
          />
        )}
        <StatCard
          label="In Production"
          value={stats.inProduction}
          icon={<PrinterIcon />}
          iconBg="rgba(245, 158, 11, 0.1)"
          iconColor="var(--status-printing)"
        />
        <StatCard
          label="In Transit"
          value={stats.inTransit}
          icon={<TruckIcon />}
          iconBg="rgba(6, 182, 212, 0.1)"
          iconColor="var(--status-dispatched)"
        />
        <StatCard
          label="Delivered"
          value={stats.delivered}
          icon={<CheckIcon />}
          iconBg="rgba(16, 185, 129, 0.1)"
          iconColor="var(--color-success)"
        />
        <StatCard
          label="Canceled Projects"
          value={stats.cancelled.toString()}
          icon={<XCircleIcon />}
          iconBg="rgba(239, 68, 68, 0.1)"
          iconColor="var(--color-error)"
        />
        <StatCard
          label={session?.user.role === "CLIENT" ? "My Spend (with GST)" : "Total Spend (with GST)"}
          value={`₹${Math.round(stats.totalSpendWithGST).toLocaleString('en-IN')}`}
          icon={<RupeeIcon />}
          iconBg="rgba(16, 185, 129, 0.1)"
          iconColor="var(--color-success)"
          className="spend-card"
        />
      </div>

      {/* Recent Projects Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{session?.user.role === "CLIENT" ? "My Recent Projects" : "Recent Projects"}</h3>
          <Link href="/projects">
            <button className="btn btn-secondary">View All</button>
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Project ID</th>
                <th>Project Name</th>
                <th>Location</th>
                {session?.user.role !== "CLIENT" && <th>Assigned To</th>}
                <th>Status</th>
                <th>Delivery Date</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentProjects.map((project) => (
                <tr key={project.id} style={{ position: 'relative' }}>
                  <td>
                    <Link href={`/projects/${project.id}`} style={{ position: 'absolute', inset: 0, zIndex: 1 }} aria-label={`View project ${project.name}`} />
                    <span className="project-id" style={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}>{project.projectId}</span>
                  </td>
                  <td style={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}>
                    <strong>{project.name}</strong>
                  </td>
                  <td style={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}>{project.location}{project.state ? `, ${project.state}` : ''}</td>
                  {session?.user.role !== "CLIENT" && (
                    <td style={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}>
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
                        {(project.client?.name || project.clientName) && (
                          <span style={{ color: 'var(--gray-400)', fontSize: '11px', paddingLeft: '8px' }}>
                            on behalf of
                          </span>
                        )}
                        {/* Line 3: Client */}
                        {(project.client?.name || project.clientName) && (
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
                  )}
                  <td style={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}><StatusBadge status={project.status} /></td>
                  <td style={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}>{new Date(project.deliveryDate).toLocaleDateString('en-IN')}</td>
                  <td className="font-mono" style={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 600 }}>₹{project.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                        (Base: ₹{(project.totalCost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + GST: ₹{(project.grandTotal - project.totalCost).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
