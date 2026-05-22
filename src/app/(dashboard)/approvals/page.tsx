import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { formatDate, formatCurrency } from "@/utils/formatters"
import { Prisma } from "@prisma/client"
import { ApprovalActions } from "@/components/approvals/approval-actions"
import { StatusBadge } from "@/components/ui/status-badge"

type ApprovalWithRelations = Prisma.ApprovalGetPayload<{
  include: {
    project: { include: { poc: { select: { id: true; name: true; email: true; role: true } }; client: { select: { id: true; name: true; email: true; role: true } }; collaterals: true } }
    requestedBy: { select: { id: true; name: true } }
  }
}>

async function getPendingApprovals(userId: string, isAdmin: boolean) {
  return prisma.approval.findMany({
    where: {
      status: "PENDING",
      ...(isAdmin ? {} : { requestedById: userId }),
    },
    include: {
      project: {
        include: {
          poc: { select: { id: true, name: true, email: true, role: true } },
          client: { select: { id: true, name: true, email: true, role: true } },
          collaterals: true,
        },
      },
      requestedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const isAdmin = session.user.role === "ADMIN"
  if (!isAdmin) redirect("/dashboard")

  const approvals = await getPendingApprovals(session.user.id, isAdmin)

  // Empty state icon
  const CheckIcon = () => (
    <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Pending Approvals</h1>
        <p className="page-subtitle">Review and approve project requests</p>
      </div>

      {/* Approval Cards */}
      <div style={{ display: 'grid', gap: '20px' }}>
        {approvals.map((approval: ApprovalWithRelations) => (
          <div
            key={approval.id}
            className="card"
            style={{
              borderLeft: '4px solid var(--status-requested)'
            }}
          >
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Approval Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span className="project-id">{approval.project.projectId}</span>
                      <StatusBadge status={approval.project.status} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', color: 'var(--gray-900)' }}>
                      {approval.project.name}
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--gray-600)' }}>
                      <strong>Requested by:</strong> {approval.requestedBy?.name}
                      {(approval.project.poc || approval.project.pocName) && (
                        <span> | <strong>POC:</strong> {approval.project.poc?.name || approval.project.pocName}</span>
                      )}
                      {(approval.project.client || approval.project.clientName) && (
                        <span> | <strong>Client:</strong> {approval.project.client?.name || approval.project.clientName}</span>
                      )}
                      <span> | <strong>Location:</strong> {approval.project.location}{approval.project.state ? `, ${approval.project.state}` : ""}</span>
                    </p>
                  </div>
                  <ApprovalActions approvalId={approval.id} reminderCount={approval.reminderCount} isAdmin={isAdmin} />
                </div>

                {/* Approval Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '16px',
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--gray-200)'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', marginBottom: '4px' }}>Material</div>
                    <div style={{ fontWeight: 600 }}>
                      {approval.project.collaterals.map((c: Prisma.CollateralGetPayload<Record<string, never>>) => c.itemName).join(", ")}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', marginBottom: '4px' }}>Quantity</div>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {approval.project.collaterals.reduce((sum: number, c: Prisma.CollateralGetPayload<Record<string, never>>) => sum + c.quantity, 0).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', marginBottom: '4px' }}>Delivery Date</div>
                    <div style={{ fontWeight: 600 }}>{formatDate(approval.project.deliveryDate)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', marginBottom: '4px' }}>Estimated Cost (incl. GST)</div>
                    <div style={{ fontWeight: 700, color: 'var(--axis-primary)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(approval.project.grandTotal ?? approval.project.totalCost * 1.18)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {approvals.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--color-success)' }}>
              <CheckIcon />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '4px' }}>All caught up!</h3>
            <p style={{ color: 'var(--gray-500)' }}>No pending approvals at the moment</p>
          </div>
        )}
      </div>
    </div>
  )
}
