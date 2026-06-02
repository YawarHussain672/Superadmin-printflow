import nodemailer from "nodemailer"
import path from "path"
import { basePrisma } from "./prisma"

const FROM = process.env.MAIL_FROM_ADDRESS
  ? `${process.env.MAIL_FROM_NAME || "Printflow"} <${process.env.MAIL_FROM_ADDRESS}>`
  : "Printflow <noreply@rishirajmedia.in>"

function getTransporter() {
  const host = process.env.MAIL_HOST
  const port = process.env.MAIL_PORT
  const user = process.env.MAIL_USERNAME
  const pass = process.env.MAIL_PASSWORD

  const missing = [!host && "MAIL_HOST", !user && "MAIL_USERNAME", !pass && "MAIL_PASSWORD"].filter(Boolean)
  if (missing.length > 0) {
    console.error(`[EMAIL ERROR] SMTP credentials not set. Missing: ${missing.join(", ")}`)
    return null
  }

  const portNum = port ? parseInt(port) : 587

  return nodemailer.createTransport({
    host,
    port: portNum,
    secure: portNum === 465,
    requireTLS: portNum !== 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  })
}

async function sendMail(to: string, subject: string, html: string) {
  const transporter = getTransporter()
  if (!transporter) {
    throw new Error("SMTP transporter not configured — check MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD in .env")
  }
  try {
    await transporter.verify()
    const bannerPath = path.join(process.cwd(), "RM signature Banner (1).jpg")
    const result = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      attachments: [
        {
          filename: "banner.jpg",
          path: bannerPath,
          cid: "rm-signature-banner"
        }
      ]
    })
    console.log(`[EMAIL SENT] to=${to} subject="${subject}" messageId=${result.messageId}`)
    return result
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException & { code?: string; responseCode?: number; response?: string }
    console.error(`[EMAIL ERROR] Failed to send to ${to}:`)
    console.error(`  Code: ${err.code ?? "unknown"}`)
    console.error(`  SMTP Response: ${err.response ?? "none"}`)
    console.error(`  Message: ${err.message}`)
    throw error
  }
}

async function getClientBranding(projectId?: string | null, clientId?: string | null) {
  let clientName = "Rishiraj Media"
  let clientLogo: string | null = null

  try {
    if (projectId) {
      const project = await basePrisma.project.findUnique({
        where: { id: projectId },
        select: { tenantClientId: true }
      })
      if (project?.tenantClientId) {
        const client = await basePrisma.client.findUnique({
          where: { id: project.tenantClientId }
        })
        if (client) {
          clientName = client.companyName
          clientLogo = client.companyLogoUrl
        }
      }
    } else if (clientId) {
      const client = await basePrisma.client.findUnique({
        where: { id: clientId }
      })
      if (client) {
        clientName = client.companyName
        clientLogo = client.companyLogoUrl
      }
    }
  } catch (err) {
    console.error("Error looking up client branding for email:", err)
  }

  return { clientName, clientLogo }
}

async function getClientBrandingByPi(piNumber: string) {
  try {
    const project = await basePrisma.project.findFirst({
      where: { piNumber },
      select: { tenantClientId: true }
    })
    if (project?.tenantClientId) {
      return getClientBranding(null, project.tenantClientId)
    }
  } catch (err) {
    console.error("Error looking up client branding by PI for email:", err)
  }
  return { clientName: "Rishiraj Media", clientLogo: null }
}

async function getClientBrandingByProjectName(projectName: string) {
  try {
    const project = await basePrisma.project.findFirst({
      where: { name: projectName },
      select: { tenantClientId: true }
    })
    if (project?.tenantClientId) {
      return getClientBranding(null, project.tenantClientId)
    }
  } catch (err) {
    console.error("Error looking up client branding by Project Name for email:", err)
  }
  return { clientName: "Rishiraj Media", clientLogo: null }
}

async function getClientBrandingByUserEmail(email: string) {
  try {
    const user = await basePrisma.user.findUnique({
      where: { email },
      select: { clientId: true }
    })
    if (user?.clientId) {
      return getClientBranding(null, user.clientId)
    }
  } catch (err) {
    console.error("Error looking up client branding by User Email for email:", err)
  }
  return { clientName: "Rishiraj Media", clientLogo: null }
}

function baseTemplate(title: string, body: string, clientName = "Rishiraj Media", clientLogo: string | null = null) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:1px solid #f3e8ff">
        <!-- Banner in the Head -->
        <tr><td style="padding:0;background:#2a0a4b;text-align:center;">
          <a href="https://rishirajmedia.com/" target="_blank" style="display:block;text-decoration:none;border:none;">
            <img src="cid:rm-signature-banner" alt="Rishiraj Media" style="width:100%;max-width:600px;height:auto;display:block;border:none;margin:0 auto;" />
          </a>
        </td></tr>
        <!-- Email Body -->
        <tr><td style="padding:32px 32px 24px">
          <h2 style="margin:0 0 16px;color:#1e1b4b;font-size:18px">${title}</h2>
          ${body}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 12px;color:#6b7280;font-size:13px;width:140px">${label}</td>
    <td style="padding:8px 12px;color:#111827;font-size:13px;font-weight:600">${value}</td>
  </tr>`
}

function button(text: string, url: string, color = "#7c3aed") {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px">${text}</a>`
}

export async function sendProjectApprovedEmail(to: string, data: {
  pocName: string; projectName: string; projectId: string; location: string; totalCost: string; appUrl: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `System Notification: Project Approved – ${data.projectName} | Status Update`,
    baseTemplate("Project Approved", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">Your project request has been reviewed and approved. The project will now proceed to the next stage.</p>
      <p style="color:#7c3aed;margin:0 0 12px;font-weight:600">Project Details:</p>
      <table style="background:#faf5ff;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project ID", data.projectId)}
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Location", data.location)}
        ${infoRow("Total Cost", data.totalCost)}
      </table>
      <p style="color:#475569;margin:0 0 20px">You will be notified upon completion of subsequent stages.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>No action is required at this stage.</strong></p>
    `, clientName, clientLogo))
}

export async function sendProjectRejectedEmail(to: string, data: {
  pocName: string; projectName: string; projectId: string; reason?: string; appUrl: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `System Notification: Project Rejected – ${data.projectName} | Attention Required`,
    baseTemplate("Project Rejected", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">Your project request has been reviewed and rejected.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project ID", data.projectId)}
        ${infoRow("Project Name", data.projectName)}
        ${data.reason ? infoRow("Reason for Rejection", data.reason) : ""}
      </table>
      <p style="color:#475569;margin:0 0 20px">Please review the reason and submit a revised request or contact your account representative.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>Action Required:</strong> Submit revised request or contact account representative</p>
    `, clientName, clientLogo))
}

export async function sendDispatchNotificationEmail(to: string, data: {
  pocName: string; projectName: string; projectId: string; courier: string
  trackingId: string; expectedDelivery: string; appUrl: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `System Notification: Material Dispatched – ${data.projectName} | Shipment Details`,
    baseTemplate("Material Dispatched", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">The materials for the project below have been dispatched.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project ID", data.projectId)}
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Courier / Transport Partner", data.courier)}
        ${infoRow("Tracking ID", data.trackingId)}
        ${infoRow("Expected Delivery", data.expectedDelivery)}
      </table>
      ${button("Track Shipment", `${data.appUrl}/projects`)}
    `, clientName, clientLogo))
}

export async function sendApprovalReminderEmail(to: string, data: {
  adminName: string; projectName: string; projectId: string
  pocName: string; totalCost: string; reminderCount: number; appUrl: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `Reminder: Pending Approval – ${data.projectName} | Action Required`,
    baseTemplate("Pending Approval Reminder", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.adminName},</p>
      <p style="color:#475569;margin:0 0 20px">This is reminder #${data.reminderCount} that the following project is awaiting your approval.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project ID", data.projectId)}
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Requested By", data.pocName)}
        ${infoRow("Total Cost", data.totalCost)}
      </table>
      ${button("Review & Approve", `${data.appUrl}/approvals`)}
    `, clientName, clientLogo))
}

export async function sendPasswordResetEmail(to: string, data: {
  name: string; resetUrl: string
}) {
  const { clientName, clientLogo } = await getClientBrandingByUserEmail(to)
  await sendMail(to, `Reset Your Password — ${clientName}`,
    baseTemplate("Reset Your Password", `
      <p style="color:#475569;margin:0 0 20px">Hi ${data.name},</p>
      <p style="color:#475569;margin:0 0 20px">We received a request to reset your password. Click below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      ${button("Reset Password", data.resetUrl)}
      <p style="color:#94a3b8;font-size:13px;margin-top:20px">If you didn't request this, you can safely ignore this email.</p>
    `, clientName, clientLogo))
}

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const { clientName, clientLogo } = await getClientBrandingByUserEmail(to)
  await sendMail(to, subject, baseTemplate(subject, `<p>${text}</p>`, clientName, clientLogo))
}

export async function sendWelcomeEmail(to: string, data: {
  name: string; email: string; password: string; role: string; appUrl: string
}) {
  const { clientName, clientLogo } = await getClientBrandingByUserEmail(to)
  const roleDisplay = data.role === "ADMIN" ? "Administrator" : data.role === "POC" ? "Point of Contact (POC)" : "Client"
  const roleDescription = data.role === "ADMIN"
    ? "You have full access to manage projects, approvals, team members, and system settings."
    : data.role === "POC"
      ? "You can create and manage print projects, track orders, and coordinate with the admin team."
      : "You have view-only access to track your print projects and order status."

  const result = await sendMail(to, `System Notification: Account Created – ${data.name} | Welcome`,
    baseTemplate("Account Created Successfully", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.name},</p>
      <p style="color:#475569;margin:0 0 20px">Your account has been successfully created. You are registered as a <strong>${roleDisplay}</strong>.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Email", data.email)}
        ${infoRow("Temporary Password", `<code style="background:#e2e8f0;padding:4px 8px;border-radius:4px;font-family:monospace">${data.password}</code>`)}
        ${infoRow("Role", roleDisplay)}
      </table>
      <p style="color:#475569;margin:0 0 20px">${roleDescription}</p>
      <p style="color:#dc2626;margin:0 0 20px;font-size:13px"><strong>Important:</strong> Please change your password after your first login.</p>
      ${button("Login to Your Account", `${data.appUrl}/login`)}
    `, clientName, clientLogo))
  return result
}

export async function sendRoleChangeEmail(to: string, data: {
  name: string; oldRole: string; newRole: string; appUrl: string
}) {
  const { clientName, clientLogo } = await getClientBrandingByUserEmail(to)
  const oldRoleDisplay = data.oldRole === "ADMIN" ? "Administrator" : data.oldRole === "POC" ? "Point of Contact" : "Client"
  const newRoleDisplay = data.newRole === "ADMIN" ? "Administrator" : data.newRole === "POC" ? "Point of Contact" : "Client"

  await sendMail(to, `System Notification: Account Role Updated – ${data.name} | Information`,
    baseTemplate("Account Role Updated", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.name},</p>
      <p style="color:#475569;margin:0 0 20px">Your account role has been updated in the system.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Previous Role", oldRoleDisplay)}
        ${infoRow("New Role", newRoleDisplay)}
      </table>
      <p style="color:#475569;margin:0 0 20px">Your permissions have been updated. Please log in again to see the changes.</p>
      ${button("Login to Your Account", `${data.appUrl}/login`)}
    `, clientName, clientLogo))
}

export async function sendAccountStatusEmail(to: string, data: {
  name: string; status: "activated" | "deactivated"; appUrl: string
}) {
  const { clientName, clientLogo } = await getClientBrandingByUserEmail(to)
  const isActive = data.status === "activated"
  const title = isActive ? "Account Activated" : "Account Deactivated"
  const statusLabel = isActive ? "Activated" : "Deactivated"

  await sendMail(to, `System Notification: Account ${statusLabel} – ${data.name} | ${isActive ? "Information" : "Attention Required"}`,
    baseTemplate(title, `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.name},</p>
      <p style="color:#475569;margin:0 0 20px">Your account has been <strong style="color:${isActive ? "#16a34a" : "#dc2626"}">${statusLabel.toLowerCase()}</strong> in the system.</p>
      ${isActive
        ? `<p style="color:#475569;margin:0 0 20px">You can now log in and access the system.</p>${button("Login to Your Account", `${data.appUrl}/login`)}`
        : `<p style="color:#475569;margin:0 0 20px">Your account has been deactivated. Please contact support for assistance.</p>`
      }
    `, clientName, clientLogo))
}

export async function sendPIGeneratedEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; piDate: string; piAmount: string; appUrl: string; projectId: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `Attach: PI | Proforma Invoice Issued – ${data.projectName} | Action Required`,
    baseTemplate("Proforma Invoice Issued", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">A Proforma Invoice (PI) has been issued for the project below. Please review and take necessary action.</p>
      <table style="background:#faf5ff;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("PI Number", data.piNumber)}
        ${infoRow("PI Date", data.piDate)}
        ${infoRow("Total Amount", data.piAmount)}
      </table>
      <p style="color:#475569;margin:0 0 20px">Please review the PI and provide formal approval to enable further processing.</p>
      <p style="color:#64748b;font-size:12px;margin:0">Do not reply directly to this email.</p>
    `, clientName, clientLogo))
}

export async function sendProductionStartedEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; productionStartDate: string; appUrl: string; projectId: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `System Notification: Production Initiated – ${data.projectName} | Status Update`,
    baseTemplate("Production Initiated", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">Materials for the project below have moved to the Production Stage.</p>
      <table style="background:#faf5ff;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Order / PI Reference", data.piNumber)}
        ${infoRow("Production Start Date", data.productionStartDate)}
        ${infoRow("Current Status", "Under Production")}
      </table>
      <p style="color:#475569;margin:0 0 20px">You will be notified upon completion or if any exceptions arise.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>No action is required at this stage.</strong></p>
    `, clientName, clientLogo))
}

export async function sendShipmentDispatchedEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; dispatchDate: string; courier: string; deliveryAddress: string; appUrl: string; projectId: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `Attach: Challan | System Notification: Material Dispatched – ${data.projectName} | Shipment Details`,
    baseTemplate("Material Dispatched", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">Materials for the project below have been dispatched from the production facility.</p>
      <table style="background:#faf5ff;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Order / PI Reference", data.piNumber)}
        ${infoRow("Dispatch Date", data.dispatchDate)}
        ${infoRow("Courier / Transport Partner", data.courier)}
        ${infoRow("Delivery Address", data.deliveryAddress)}
      </table>
      ${button("Track Shipment", `${data.appUrl}/projects`)}
      <p style="color:#64748b;font-size:12px;margin-top:24px"><strong>Action Required:</strong> Please monitor shipment and arrange for receipt.</p>
    `, clientName, clientLogo))
}

export async function sendPendingPOReminderEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; piDate: string; piAmount: string; appUrl: string; projectId: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `Attach: PI | Reminder: Pending PO – ${data.projectName} | Action Required`,
    baseTemplate("Pending Purchase Order Reminder", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">The Purchase Order (PO) for the project below is still pending as per system records.</p>
      <table style="background:#faf5ff;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Proforma Invoice (PI) Number", data.piNumber)}
        ${infoRow("PI Date", data.piDate)}
        ${infoRow("PI Amount", data.piAmount)}
      </table>
      <p style="color:#475569;margin:0 0 20px">Please share the PO at the earliest to avoid delays.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>Action Required:</strong> Submission of Purchase Order</p>
    `, clientName, clientLogo))
}

export async function sendOutstandingPaymentReminderEmail(to: string, data: {
  pocName: string; projectName: string; invoiceNumber: string; invoiceDate: string; outstandingAmount: string; appUrl: string; referenceType?: string; projectId: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `Attach ${data.referenceType || "Invoice"} | Reminder: Outstanding Payment Due – ${data.invoiceNumber} | Attention Required`,
    baseTemplate("Outstanding Payment Reminder", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">The following ${data.referenceType?.toLowerCase() || "invoice"} remains outstanding.</p>
      <table style="background:#faf5ff;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow(`${data.referenceType || "Invoice"} Number`, data.invoiceNumber)}
        ${infoRow(`${data.referenceType || "Invoice"} Date`, data.invoiceDate)}
        ${infoRow("Outstanding Amount", data.outstandingAmount)}
      </table>
      <p style="color:#475569;margin:0 0 20px">Please arrange for payment at the earliest.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>Action Required:</strong> Payment of outstanding dues</p>
    `, clientName, clientLogo))
}

export async function sendPIVerifiedEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; appUrl: string; projectId: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `System Notification: PI Verified – ${data.projectName} | Action Required`,
    baseTemplate("Proforma Invoice Verified", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">Your Proforma Invoice has been reviewed and verified by the Admin.</p>
      <table style="background:#faf5ff;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("PI Number", data.piNumber)}
        ${infoRow("Status", "Verified")}
      </table>
      <p style="color:#475569;margin:0 0 20px">Please share the verified PI with the client and obtain the Purchase Order (PO) to enable further processing.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>Action Required:</strong> Share PI with client and obtain Purchase Order.</p>
    `, clientName, clientLogo))
}

export async function sendPIRejectedEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; reason?: string; appUrl: string; projectId: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `System Notification: PI Rejected – ${data.projectName} | Action Required`,
    baseTemplate("Proforma Invoice Rejected", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">Your Proforma Invoice has been reviewed and rejected.</p>
      <table style="background:#faf5ff;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("PI Number", data.piNumber)}
        ${infoRow("Status", "Rejected")}
        ${data.reason ? infoRow("Reason for Rejection", data.reason) : ""}
      </table>
      <p style="color:#475569;margin:0 0 20px">Please review the reason and regenerate the PI with the necessary corrections.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>Action Required:</strong> Regenerate PI with corrections.</p>
    `, clientName, clientLogo))
}

export async function sendAdminNewProjectEmail(to: string, data: {
  adminName: string; projectName: string; projectId: string; pocName: string; clientName?: string; appUrl: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `Action Required: New Project Submitted – ${data.projectName} | Approval Pending`,
    baseTemplate("New Project Submitted for Approval", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.adminName},</p>
      <p style="color:#475569;margin:0 0 20px">A new project has been submitted and is pending your review and approval.</p>
      <table style="background:#faf5ff;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Project ID", data.projectId)}
        ${infoRow("Submitted By", data.pocName)}
        ${data.clientName ? infoRow("On Behalf Of", data.clientName) : ""}
      </table>
      ${button("Review & Approve", `${data.appUrl}/approvals`)}
      <p style="color:#64748b;font-size:12px;margin-top:24px"><strong>Action Required:</strong> Review and approve or reject the project.</p>
    `, clientName, clientLogo))
}

export async function sendAdminPIPendingEmail(to: string, data: {
  adminName: string; projectName: string; piNumber: string; pocName: string; appUrl: string; projectId: string
}) {
  const { clientName, clientLogo } = await getClientBranding(data.projectId)
  await sendMail(to, `Action Required: PI Pending Verification – ${data.projectName} | Review Required`,
    baseTemplate("Proforma Invoice Pending Verification", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.adminName},</p>
      <p style="color:#475569;margin:0 0 20px">A Proforma Invoice has been generated and is pending your verification.</p>
      <table style="background:#faf5ff;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("PI Number", data.piNumber)}
        ${infoRow("Generated By", data.pocName)}
      </table>
      ${button("Verify PI", `${data.appUrl}/projects`)}
      <p style="color:#64748b;font-size:12px;margin-top:24px"><strong>Action Required:</strong> Verify or reject the Proforma Invoice.</p>
    `, clientName, clientLogo))
}

export async function sendAdminWelcomeEmail(to: string, data: {
  name: string; email: string; passwordText: string; appUrl: string
}) {
  await sendMail(to, `Welcome to Printflow — Admin Account Created`,
    baseTemplate("Welcome to Printflow", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.name},</p>
      <p style="color:#475569;margin:0 0 20px">Your client administrator account has been successfully created. You can now manage your organization's print operations.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Email", data.email)}
        ${infoRow("Temporary Password", `<code style="background:#e2e8f0;padding:4px 8px;border-radius:4px;font-family:monospace">${data.passwordText}</code>`)}
        ${infoRow("Role", "Client Administrator")}
      </table>
      <p style="color:#dc2626;margin:0 0 20px;font-size:13px"><strong>Important:</strong> Please change your password after logging in.</p>
      ${button("Login to Printflow", `${data.appUrl}/login`)}
    `, "Rishiraj Media", "/rm-white-logo3.svg"))
}

export async function sendTenantDeactivatedEmail(to: string, data: {
  name: string; companyName: string
}) {
  await sendMail(to, `Account Suspension Notice — Printflow`,
    baseTemplate("Account Suspension Notice", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.name},</p>
      <p style="color:#dc2626;margin:0 0 20px;font-weight:600">Your organization account (${data.companyName}) has been deactivated by the system administrator.</p>
      <p style="color:#475569;margin:0 0 20px">Your users will no longer be able to log in or access the system resources. Please contact Rishiraj Media support if you believe this is an error or to reactivate your subscription.</p>
    `, "Rishiraj Media", "/rm-white-logo3.svg"))
}
