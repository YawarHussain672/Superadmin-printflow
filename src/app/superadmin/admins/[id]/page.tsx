import { basePrisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Building, Mail, MapPin, Shield, Folder, CheckCircle2, TrendingUp, Users } from "lucide-react"
import { StatusToggleButton } from "@/components/superadmin/status-toggle-button"
import { DeleteOrganizationButton } from "@/components/superadmin/delete-organization-button"
import { ProjectStatus } from "@prisma/client"

interface AdminDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AdminDetailPage({ params }: AdminDetailPageProps) {
  const { id } = await params

  const client = await basePrisma.client.findUnique({
    where: { id },
    include: {
      users: {
        orderBy: { createdAt: "desc" }
      },
      projects: {
        orderBy: { createdAt: "desc" },
        include: {
          poc: true
        }
      }
    }
  })

  if (!client) {
    notFound()
  }

  const { getPresignedUrl } = await import("@/lib/s3")
  if (client.companyLogoUrl && client.companyLogoUrl.includes("amazonaws.com")) {
    client.companyLogoUrl = await getPresignedUrl(client.companyLogoUrl)
  }

  // Calculate metrics
  const totalProjects = client.projects.length
  const totalSpend = client.projects
    .filter((p) => p.status !== ProjectStatus.CANCELLED)
    .reduce((sum, p) => sum + p.grandTotal, 0)

  const activeProjects = client.projects.filter((p) =>
    p.status !== ProjectStatus.DELIVERED && p.status !== ProjectStatus.CANCELLED
  ).length

  const deliveredProjects = client.projects.filter((p) => p.status === ProjectStatus.DELIVERED).length
  const totalUsers = client.users.length

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  }

  return (
    <div>
      {/* Back to Admins & Header */}
      <div style={{ marginBottom: "24px" }}>
        <Link href="/superadmin/admins" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--gray-500)", fontSize: "14px", fontWeight: 500, marginBottom: "16px" }} className="hover:underline">
          <ArrowLeft size={16} />
          Back to All Admins
        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "12px",
              backgroundColor: "#f3f4f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              border: "1px solid var(--gray-200)"
            }}>
              {client.companyLogoUrl ? (
                <img 
                  src={client.companyLogoUrl} 
                  alt={client.companyName} 
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <Building size={32} style={{ color: "var(--gray-400)" }} />
              )}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <h1 className="page-title" style={{ margin: 0 }}>{client.companyName}</h1>
                <span className={`status-badge ${client.isActive ? "status-delivered" : "status-cancelled"}`}>
                  <span className="status-dot"></span>
                  {client.isActive ? "Active" : "Suspended"}
                </span>
              </div>
              <p className="page-subtitle" style={{ margin: "4px 0 0", display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Mail size={14} /> {client.clientEmail}</span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><MapPin size={14} /> {client.location}, {client.state}</span>
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <StatusToggleButton clientId={client.id} initialIsActive={client.isActive} />
            <DeleteOrganizationButton clientId={client.id} companyName={client.companyName} />
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="stats-grid" style={{ marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-header">
            <div>
              <div className="stat-label">Total Spend (with GST)</div>
              <div className="stat-value">₹{totalSpend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--color-success)" }}>
              <TrendingUp size={20} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div>
              <div className="stat-label">Active Projects</div>
              <div className="stat-value">{activeProjects}</div>
            </div>
            <div className="stat-icon" style={{ background: "rgba(59, 130, 246, 0.1)", color: "var(--status-approved)" }}>
              <Folder size={20} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div>
              <div className="stat-label">Delivered Projects</div>
              <div className="stat-value">{deliveredProjects} / {totalProjects}</div>
            </div>
            <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--color-success)" }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <div>
              <div className="stat-label">Team Members</div>
              <div className="stat-value">{totalUsers}</div>
            </div>
            <div className="stat-icon" style={{ background: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6" }}>
              <Users size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Organization Details Card */}
      <div className="card" style={{ padding: "20px 24px", marginBottom: "24px" }}>
        <h3 className="card-title" style={{ fontSize: "16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Building size={18} style={{ color: "var(--gray-600)" }} />
          Organization Billing & Invoicing Profile
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "12px", color: "var(--gray-500)", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Billing Address</div>
            <div style={{ fontSize: "14px", color: "var(--gray-900)", fontWeight: 500, lineHeight: 1.4 }}>{client.branchLocation || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--gray-500)", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>PAN / IT No.</div>
            <div style={{ fontSize: "14px", color: "var(--gray-900)", fontWeight: 500 }} className="font-mono">{client.users.find(u => u.role === "ADMIN")?.clientPan || "—"}</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: "var(--gray-500)", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>GST No.</div>
            <div style={{ fontSize: "14px", color: "var(--gray-900)", fontWeight: 500 }} className="font-mono">{client.users.find(u => u.role === "ADMIN")?.clientGst || "—"}</div>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* Left Column: Associated Projects */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Associated Projects</h3>
            <span style={{ fontSize: "12px", color: "var(--gray-500)", fontWeight: 500 }}>
              {client.projects.length} Total Projects
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Project ID</th>
                  <th>Name</th>
                  <th>POC</th>
                  <th>Delivery Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {client.projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "48px", color: "var(--gray-400)" }}>
                      No projects found for this client.
                    </td>
                  </tr>
                ) : (
                  client.projects.map((project) => (
                    <tr key={project.id}>
                      <td style={{ fontWeight: 600 }} className="font-mono">
                        <Link 
                          href={`/superadmin/projects/${project.id}`}
                          style={{ color: "var(--axis-primary)", textDecoration: "none" }}
                          className="hover:underline"
                        >
                          {project.projectId}
                        </Link>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--gray-900)" }}>
                          <Link 
                            href={`/superadmin/projects/${project.id}`}
                            style={{ color: "inherit", textDecoration: "none" }}
                            className="hover:underline"
                          >
                            {project.name}
                          </Link>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--gray-400)" }}>{project.location}</div>
                      </td>
                      <td>{project.poc?.name || "—"}</td>
                      <td>{new Date(project.deliveryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td>
                        <span className={`status-badge status-${project.status.toLowerCase()}`}>
                          <span className="status-dot"></span>
                          {project.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }} className="font-mono">
                        ₹{project.grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Organization Users */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Organization Users</h3>
            <span style={{ fontSize: "12px", color: "var(--gray-500)", fontWeight: 500 }}>
              {client.users.length} Users
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "500px", overflowY: "auto", padding: "16px 0" }}>
            {client.users.length === 0 ? (
              <p style={{ textAlign: "center", padding: "24px", color: "var(--gray-400)", margin: 0 }}>
                No users linked to this client.
              </p>
            ) : (
              client.users.map((user) => (
                <div key={user.id} style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between", padding: "8px 16px", borderBottom: "1px solid var(--gray-50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: user.role === "ADMIN" ? "#8b5cf6" : "#3b82f6",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 700
                    }}>
                      {getInitials(user.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--gray-900)" }}>{user.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--gray-400)" }}>{user.email}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                    <span style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 6px",
                      backgroundColor: user.role === "ADMIN" ? "rgba(139, 92, 246, 0.1)" : "rgba(59, 130, 246, 0.1)",
                      color: user.role === "ADMIN" ? "#8b5cf6" : "#3b82f6",
                      borderRadius: "4px"
                    }}>
                      {user.role}
                    </span>
                    <span style={{ fontSize: "10px", color: user.active ? "var(--color-success)" : "var(--color-error)" }}>
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

