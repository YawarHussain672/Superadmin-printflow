import { prisma } from "@/lib/prisma"
import { ProjectStatus, ApprovalStatus } from "@prisma/client"
import Link from "next/link"

const FolderIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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

const ProjectsIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

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
  if (valueStr.length > 12) {
    fontSize = "16px"
  } else if (valueStr.length > 10) {
    fontSize = "20px"
  } else if (valueStr.length > 8) {
    fontSize = "24px"
  } else if (valueStr.length > 6) {
    fontSize = "28px"
  }

  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-header">
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ fontSize, transition: 'font-size 0.2s', whiteSpace: 'nowrap' }}>{value}</div>
        </div>
        <div className="stat-icon" style={{ background: iconBg, color: iconColor }}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default async function SuperAdminDashboard() {
  // Query aggregated metrics across all tenants (Prisma client extensions do not scope query since user role is SUPERADMIN)
  const [
    totalClients,
    activeProjects,
    pendingApproval,
    inProduction,
    inTransit,
    delivered,
    cancelled,
    totalSpendResult,
    recentClients,
  ] = await Promise.all([
    prisma.client.count({ where: { isActive: true } }),
    prisma.project.count({ where: { status: { not: ProjectStatus.CANCELLED } } }),
    prisma.approval.count({ where: { status: ApprovalStatus.PENDING } }),
    prisma.project.count({ where: { status: ProjectStatus.PRINTING } }),
    prisma.project.count({ where: { status: ProjectStatus.DISPATCHED } }),
    prisma.project.count({ where: { status: ProjectStatus.DELIVERED } }),
    prisma.project.count({ where: { status: ProjectStatus.CANCELLED } }),
    prisma.project.aggregate({
      where: {
        status: { not: ProjectStatus.CANCELLED },
        approval: { status: ApprovalStatus.APPROVED }
      },
      _sum: { grandTotal: true },
    }),
    prisma.client.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
  ])

  const totalSpend = totalSpendResult._sum.grandTotal || 0

  const { getPresignedUrl } = await import("@/lib/s3")
  const signedRecentClients = await Promise.all(
    recentClients.map(async (client) => {
      if (client.companyLogoUrl && client.companyLogoUrl.includes("amazonaws.com")) {
        return {
          ...client,
          companyLogoUrl: await getPresignedUrl(client.companyLogoUrl)
        }
      }
      return client
    })
  )

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">SuperAdmin Overview</h1>
        <p className="page-subtitle">Real-time system insights aggregated across all tenant organizations</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard
          label="Total Admins"
          value={totalClients}
          icon={<FolderIcon />}
          iconBg="rgba(139, 92, 246, 0.1)"
          iconColor="#8b5cf6"
        />
        <StatCard
          label="Active Projects"
          value={activeProjects}
          icon={<ProjectsIcon />}
          iconBg="rgba(0, 168, 204, 0.1)"
          iconColor="var(--axis-accent)"
        />
        <StatCard
          label="Pending Approval"
          value={pendingApproval}
          icon={<ClockIcon />}
          iconBg="rgba(245, 158, 11, 0.1)"
          iconColor="var(--status-requested)"
        />
        <StatCard
          label="In Production"
          value={inProduction}
          icon={<PrinterIcon />}
          iconBg="rgba(59, 130, 246, 0.1)"
          iconColor="var(--status-printing)"
        />
        <StatCard
          label="In Transit"
          value={inTransit}
          icon={<TruckIcon />}
          iconBg="rgba(6, 182, 212, 0.1)"
          iconColor="var(--status-dispatched)"
        />
        <StatCard
          label="Delivered"
          value={delivered}
          icon={<CheckIcon />}
          iconBg="rgba(16, 185, 129, 0.1)"
          iconColor="var(--color-success)"
        />
        <StatCard
          label="Cancelled Projects"
          value={cancelled}
          icon={<XCircleIcon />}
          iconBg="rgba(239, 68, 68, 0.1)"
          iconColor="var(--color-error)"
        />
        <StatCard
          label="Total Spend (with GST)"
          value={new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalSpend)}
          icon={<RupeeIcon />}
          iconBg="rgba(16, 185, 129, 0.1)"
          iconColor="var(--color-success)"
          className="spend-card"
        />
      </div>

      {/* Recent Clients / Admins Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Recent Admins</h3>
          <Link href="/superadmin/admins">
            <button className="btn btn-secondary">View All Admins</button>
          </Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "60px" }}>Logo</th>
                <th>Company Name</th>
                <th>Admin Email</th>
                <th>Location</th>
                <th>State</th>
                <th>Status</th>
                <th>Created On</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {signedRecentClients.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--gray-500)" }}>
                    No client accounts created yet.
                  </td>
                </tr>
              ) : (
                signedRecentClients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: '#f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        border: '1px solid var(--gray-200)'
                      }}>
                        {client.companyLogoUrl ? (
                          <img 
                            src={client.companyLogoUrl} 
                            alt="Logo" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--gray-500)' }}>
                            {client.companyName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <Link href={`/superadmin/admins/${client.id}`} style={{ fontWeight: 600, color: "var(--gray-900)" }} className="hover:underline">
                        {client.companyName}
                      </Link>
                    </td>
                    <td>{client.clientEmail}</td>
                    <td>{client.location}</td>
                    <td>{client.state}</td>
                    <td>
                      <span className={`status-badge ${client.isActive ? "status-delivered" : "status-cancelled"}`}>
                        <span className="status-dot"></span>
                        {client.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{new Date(client.createdAt).toLocaleDateString('en-IN', { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link href={`/superadmin/admins/${client.id}`}>
                        <button className="btn btn-secondary" style={{ padding: "4px 12px", fontSize: "12px" }}>
                          View
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

