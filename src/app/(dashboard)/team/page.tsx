"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { TeamActions } from "@/components/team/team-actions"
import { toast } from "sonner"
import { FileSpreadsheet } from "lucide-react"
import { exportToExcel } from "@/utils/excel-export"

interface TeamMember {
  id: string
  name: string
  email?: string
  phone?: string
  location?: string
  branch?: string
  role: string
  active: boolean
  createdAt?: Date
}

export default function TeamPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch members on mount
  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/login")
      return
    }
    if (session.user.role !== "ADMIN") {
      router.push("/dashboard")
      return
    }

    fetchMembers()
  }, [session, status, router])

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/team")
      if (res.ok) {
        const data = await res.json()
        setMembers(data)
      } else {
        toast.error("Failed to load team members")
      }
    } catch {
      toast.error("Failed to load team members")
    } finally {
      setIsLoading(false)
    }
  }

  // Real-time update handlers
  const handleMemberAdded = (newMember: TeamMember) => {
    setMembers((prev) => [newMember, ...prev])
  }

  const handleMemberUpdated = (updatedMember: TeamMember) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === updatedMember.id ? updatedMember : m))
    )
  }

  const handleMemberDeleted = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
  }

  if (status === "loading" || isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <div style={{ color: "var(--gray-400)", fontSize: "15px" }}>Loading team members...</div>
      </div>
    )
  }

  if (!session || session.user.role !== "ADMIN") return null

  // Empty state icon
  const UsersIcon = () => (
    <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
  }

  // Format date
  const formatJoinedDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })
  }

  const handleExportExcel = async () => {
    if (members.length === 0) {
      toast.error("No team members to export")
      return
    }

    const columns = [
      { header: "Name", key: "name", width: 24 },
      { header: "Email", key: "email", width: 28 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Location", key: "location", width: 18 },
      { header: "Branch", key: "branch", width: 18 },
      { header: "Role", key: "role", width: 14 },
      { header: "Status", key: "status", width: 14 },
      { header: "Joined Date", key: "joinedDate", width: 16 },
    ]

    const data = members.map((member) => ({
      name: member.name,
      email: member.email || "—",
      phone: member.phone || "—",
      location: member.location || "—",
      branch: member.branch || "—",
      role: member.role,
      status: member.active ? "Active" : "Inactive",
      joinedDate: member.createdAt ? formatJoinedDate(member.createdAt) : "—",
    }))

    await exportToExcel({
      filename: "Team_and_Roles_Report",
      sheetName: "Team Members",
      columns,
      data,
    })
    toast.success(`Exported ${members.length} team members to Excel!`)
  }

  return (
    <div style={{ display: 'inline-block', minWidth: 'max-content', width: '100%', verticalAlign: 'top' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Team & Roles</h1>
          <p className="page-subtitle">Manage POCs and team members</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExportExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '42px',
              padding: '0 16px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: 'var(--axis-primary, #003c71)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(0, 60, 113, 0.25)',
            }}
          >
            <FileSpreadsheet size={16} />
            Export to Excel
          </button>
          <TeamActions mode="add" onSuccess={handleMemberAdded} />
        </div>
      </div>

      {/* Team Table Card */}
      <div className="card" style={{ minWidth: '1000px', width: '100%' }}>
        <div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Location</th>
                <th>Branch</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member: TeamMember) => (
                <tr key={member.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', maxWidth: '220px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      <div
                        className="user-avatar"
                        style={{
                          width: '36px',
                          height: '36px',
                          fontSize: '14px',
                          background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          color: 'white',
                          flexShrink: 0
                        }}
                      >
                        {getInitials(member.name)}
                      </div>
                      <strong style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{member.name}</strong>
                    </div>
                  </td>
                  <td>
                    <div style={{ maxWidth: '200px', whiteSpace: 'normal', wordBreak: 'break-all' }}>{member.email}</div>
                  </td>
                  <td className="font-mono">{member.phone || "—"}</td>
                  <td>
                    <div style={{ maxWidth: '150px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{member.location || "—"}</div>
                  </td>
                  <td>
                    <div style={{ maxWidth: '150px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{member.branch || "—"}</div>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '4px 12px',
                        background: member.role === 'ADMIN' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        color: member.role === 'ADMIN' ? 'var(--status-requested)' : 'var(--status-approved)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    >
                      {member.role}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${member.active ? 'status-delivered' : 'status-cancelled'}`}>
                      <span className="status-dot"></span>
                      {member.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{member.createdAt ? formatJoinedDate(member.createdAt) : '-'}</td>
                  <td>
                    <TeamActions
                      mode="edit"
                      member={{
                        id: member.id,
                        name: member.name,
                        email: member.email,
                        phone: member.phone || "",
                        role: member.role,
                        active: member.active,
                        location: member.location || "",
                        branch: member.branch || ""
                      }}
                      onSuccess={handleMemberUpdated}
                      onDelete={handleMemberDeleted}
                    />
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '60px', color: 'var(--gray-400)' }}>
                    <div style={{ color: 'var(--gray-300)', marginBottom: '12px' }}>
                      <UsersIcon />
                    </div>
                    <p style={{ fontWeight: 500 }}>No team members yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
