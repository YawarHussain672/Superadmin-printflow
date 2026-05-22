"use client"

import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ProjectStatus, Prisma } from "@prisma/client"
import { formatDate, formatCurrency } from "@/utils/formatters"

type ProjectWithPoc = Prisma.ProjectGetPayload<{
  include: { poc: { select: { name: true } } }
}> & { pocName?: string | null }

interface RecentProjectsTableProps {
  projects: ProjectWithPoc[]
}

const statusVariants: Record<ProjectStatus, string> = {
  REQUESTED: "requested",
  APPROVED: "approved",
  PRINTING: "printing",
  DISPATCHED: "dispatched",
  DELIVERED: "delivered",
  CANCELLED: "rejected",
}

export function RecentProjectsTable({ projects }: RecentProjectsTableProps) {
  const router = useRouter()

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project ID</TableHead>
          <TableHead>Project Name</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>POC</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Delivery Date</TableHead>
          <TableHead className="text-right">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.slice(0, 5).map((project) => (
          <TableRow
            key={project.id}
            className="cursor-pointer"
            onClick={() => router.push(`/projects/${project.id}`)}
          >
            <TableCell className="font-medium text-blue-600">
              {project.projectId}
            </TableCell>
            <TableCell className="font-medium text-slate-900">{project.name}</TableCell>
            <TableCell className="text-slate-600">
              {project.location}
              {project.state && `, ${project.state}`}
            </TableCell>
            <TableCell className="text-slate-600">{project.poc?.name || project.pocName || "Unknown"}</TableCell>
            <TableCell>
              <Badge variant={statusVariants[project.status] as Parameters<typeof Badge>[0]["variant"]}>
                {project.status}
              </Badge>
            </TableCell>
            <TableCell className="text-slate-600">{formatDate(project.deliveryDate)}</TableCell>
            <TableCell className="text-right">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{formatCurrency(project.grandTotal)}</span>
                <span style={{ fontSize: '11px', color: 'var(--gray-500)' }}>
                  (Base: {formatCurrency(project.totalCost)} + GST: {formatCurrency(project.grandTotal - project.totalCost)})
                </span>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {projects.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8 text-slate-500">
              No projects found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
