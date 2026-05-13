"use client"

import { ProjectStatus } from "@prisma/client"

interface StatusBadgeProps {
  status: ProjectStatus | string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig: Record<string, { class: string; label: string }> = {
    REQUESTED: { class: "status-requested", label: "Requested" },
    APPROVED: { class: "status-approved", label: "Approved" },
    PRINTING: { class: "status-printing", label: "Printing" },
    DISPATCHED: { class: "status-dispatched", label: "Dispatched" },
    DELIVERED: { class: "status-delivered", label: "Delivered" },
    CANCELLED: { class: "status-cancelled", label: "Cancelled" },
  }

  const config = statusConfig[status] || { class: "", label: status }

  return (
    <span className={`status-badge ${config.class}`}>
      <span className="status-dot"></span>
      {config.label}
    </span>
  )
}
