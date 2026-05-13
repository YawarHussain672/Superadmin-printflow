import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ProjectStatus } from "@prisma/client"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [
      totalProjects,
      deliveredProjects,
      pendingProjects,
      totalSpendResult,
      projectsByStatus,
      projectsByLocation,
      collateralStats,
      monthlyProjects,
      leadStats,
      branchData,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: ProjectStatus.DELIVERED } }),
      prisma.project.count({ where: { status: { not: ProjectStatus.DELIVERED } } }),
      prisma.project.aggregate({ _sum: { totalCost: true } }),
      prisma.project.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { totalCost: true },
      }),
      prisma.project.groupBy({
        by: ["location"],
        _count: { id: true },
        _sum: { totalCost: true },
        orderBy: { _sum: { totalCost: "desc" } },
      }),
      prisma.collateral.groupBy({
        by: ["itemName"],
        _count: { id: true },
        _sum: { totalPrice: true, quantity: true },
        orderBy: { _sum: { totalPrice: "desc" } },
        take: 10,
      }),
      prisma.$queryRaw<Array<{ month: string; count: bigint; spend: number }>>`
        SELECT
          TO_CHAR("createdAt", 'Mon YYYY') as month,
          COUNT(id) as count,
          COALESCE(SUM("totalCost"), 0) as spend
        FROM projects
        GROUP BY TO_CHAR("createdAt", 'Mon YYYY'), DATE_TRUNC('month', "createdAt")
        ORDER BY DATE_TRUNC('month', "createdAt") DESC
        LIMIT 12
      `,
      prisma.$queryRaw<Array<{ total_leads: bigint; total_converted: bigint }>>`
        SELECT
          COALESCE(SUM("leadsGenerated"), 0) as total_leads,
          COALESCE(SUM("leadsConverted"), 0) as total_converted
        FROM projects
        WHERE "leadsGenerated" IS NOT NULL
      `,
      // Branch-wise marketing data - only show branches with real project data
      prisma.$queryRaw<Array<{
        branch: string;
        campaigns: bigint;
        leads_generated: bigint;
        conversions: bigint;
        marketing_spend: number;
      }>>`
        SELECT
          p.branch,
          COUNT(p.id) as campaigns,
          COALESCE(SUM(p."leadsGenerated"), 0) as leads_generated,
          COALESCE(SUM(p."leadsConverted"), 0) as conversions,
          COALESCE(SUM(p."totalCost"), 0) as marketing_spend
        FROM projects p
        WHERE p.branch IS NOT NULL AND p.branch != ''
        GROUP BY p.branch
        ORDER BY COALESCE(SUM(p."totalCost"), 0) DESC
      `,
    ])

    const totalSpend = totalSpendResult._sum.totalCost || 0
    const avgProjectCost = totalProjects > 0 ? totalSpend / totalProjects : 0

    const totalLeadsGenerated = Number(leadStats[0]?.total_leads ?? 0)
    const totalLeadsConverted = Number(leadStats[0]?.total_converted ?? 0)
    const conversionRate = totalLeadsGenerated > 0 ? (totalLeadsConverted / totalLeadsGenerated) * 100 : 0
    const avgCPL = totalLeadsGenerated > 0 ? totalSpend / totalLeadsGenerated : 0
    const avgCPA = totalLeadsConverted > 0 ? totalSpend / totalLeadsConverted : 0

    return NextResponse.json({
      totalProjects: Number(totalProjects),
      deliveredProjects: Number(deliveredProjects),
      pendingProjects: Number(pendingProjects),
      totalSpend: Number(totalSpend),
      avgProjectCost: Number(avgProjectCost),
      deliveryRate: totalProjects > 0 ? Math.round((deliveredProjects / totalProjects) * 1000) / 10 : 0,
      projectsByStatus: projectsByStatus.map(s => ({ ...s, _count: { id: Number(s._count.id) } })),
      projectsByLocation: projectsByLocation.map(l => ({ ...l, _count: { id: Number(l._count.id) }, _sum: { totalCost: Number(l._sum.totalCost || 0) } })),
      collateralStats: collateralStats.map(c => ({ ...c, _count: { id: Number(c._count.id) }, _sum: { totalPrice: Number(c._sum.totalPrice || 0), quantity: Number(c._sum.quantity || 0) } })),
      branchData: branchData.map((b) => ({
        branch: b.branch,
        campaigns: Number(b.campaigns),
        leads_generated: Number(b.leads_generated),
        conversions: Number(b.conversions),
        marketing_spend: Number(b.marketing_spend),
      })),
      monthlyProjects: monthlyProjects.reverse().map(m => ({
        month: m.month,
        count: Number(m.count),
        spend: Number(m.spend)
      })),
      totalLeadsGenerated: Number(totalLeadsGenerated),
      totalLeadsConverted: Number(totalLeadsConverted),
      conversionRate,
      avgCPL,
      avgCPA,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to fetch analytics", details: message }, { status: 500 })
  }
}
