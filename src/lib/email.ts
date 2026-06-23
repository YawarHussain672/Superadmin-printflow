import nodemailer from "nodemailer"
import path from "path"

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
    // port 465 = SSL/TLS directly; port 587 = STARTTLS upgrade
    secure: portNum === 465,
    requireTLS: portNum !== 465, // force STARTTLS on port 587
    auth: { user, pass },
    tls: {
      // Accept self-signed certs in dev; remove in production if not needed
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  })
}

async function sendMail(to: string, subject: string, html: string) {
  const transporter = getTransporter()
  if (!transporter) {
    throw new Error("SMTP transporter not configured ΓÇö check MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD in .env")
  }
  try {
    // Verify SMTP connection before sending (helps surface auth errors immediately)
    await transporter.verify()
    const purpleLogoPath = path.join(process.cwd(), "rm-purple-logo.png")
    const footerLogoPath = path.join(process.cwd(), "rm-purple-logo-padded.png")
    const result = await transporter.sendMail({
      from: FROM,
      to,
      subject,
      html,
      attachments: [
        {
          filename: "logo-purple.png",
          path: purpleLogoPath,
          cid: "rm-logo-purple",
          contentType: "image/png"
        },
        {
          filename: "logo-purple-footer.png",
          path: footerLogoPath,
          cid: "rm-logo-purple-footer",
          contentType: "image/png"
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

function baseTemplate(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
        <tr><td style="padding:14px 24px;text-align:center;border-bottom:1px solid #e2e8f0;background-color:#ffffff;background-image:linear-gradient(to bottom, #ffffff 0%, #ffffff 100%);">
          <div style="text-align:center;">
            <a href="https://rishirajmedia.com/" target="_blank" style="display:inline-block;text-decoration:none;border:none;">
              <img src="cid:rm-logo-purple" alt="Rishiraj Media" height="68" style="height:68px;width:auto;display:block;border:none;margin:0 auto;" />
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:32px 32px 24px">
          <h2 style="margin:0 0 16px;color:#0f172a;font-size:18px">${title}</h2>
          ${body}
        </td></tr>
        <tr><td style="padding:16px;background-color:#f8fafc;border-top:1px solid #e2e8f0;background-image:linear-gradient(to bottom, #f8fafc 0%, #f8fafc 100%);text-align:center;font-size:13px;color:#64748b;line-height:24px;">
          <table cellpadding="0" cellspacing="0" style="margin:0 auto;display:inline-table;vertical-align:middle">
            <tr>
              <td width="71" style="width:71px;line-height:0"></td>
              <td style="color:#64748b;padding-right:8px;font-size:13px;font-weight:bold;vertical-align:middle;line-height:24px">
                Powered by :
              </td>
              <td style="vertical-align:middle;line-height:0">
                <a href="https://rishirajmedia.com/" target="_blank" style="display:inline-block;text-decoration:none;border:none;">
                  <img src="cid:rm-logo-purple-footer" alt="Rishiraj Media" height="22" width="105" style="height:22px;width:105px;display:block;border:none;" />
                </a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}


function infoRow(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 12px;color:#64748b;font-size:13px;width:140px">${label}</td>
    <td style="padding:8px 12px;color:#0f172a;font-size:13px;font-weight:600">${value}</td>
  </tr>`
}

function button(text: string, url: string, color = "#003c71") {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px">${text}</a>`
}

export async function sendProjectApprovedEmail(to: string, data: {
  pocName: string; projectName: string; projectId: string; location: string; totalCost: string; appUrl: string
}) {
  await sendMail(to, `Project Approved - ${data.projectName} | Status Update`,
    baseTemplate("Project Approved", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">Your project request has been reviewed and approved. The project will now proceed to the next stage.</p>
      <p style="color:#003c71;margin:0 0 12px;font-weight:600">Project Details:</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project ID", data.projectId)}
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Location", data.location)}
        ${infoRow("Total Cost", data.totalCost)}
      </table>
      <p style="color:#475569;margin:0 0 20px">You will be notified upon completion of subsequent stages.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>No action is required at this stage.</strong></p>
    `))
}

export async function sendProjectRejectedEmail(to: string, data: {
  pocName: string; projectName: string; projectId: string; reason?: string; appUrl: string
}) {
  await sendMail(to, `Project Rejected - ${data.projectName} | Attention Required`,
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
    `))
}

export async function sendDispatchNotificationEmail(to: string, data: {
  pocName: string; projectName: string; projectId: string; courier: string
  trackingId: string; expectedDelivery: string; appUrl: string
}) {
  await sendMail(to, `Material Dispatched - ${data.projectName} | Shipment Details`,
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
    `))
}

export async function sendApprovalReminderEmail(to: string, data: {
  adminName: string; projectName: string; projectId: string
  pocName: string; totalCost: string; reminderCount: number; appUrl: string
}) {
  await sendMail(to, `Pending Approval - ${data.projectName} | Action Required`,
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
    `))
}

export async function sendPasswordResetEmail(to: string, data: {
  name: string; resetUrl: string
}) {
  await sendMail(to, "Reset Your Password ΓÇö Axis Print Management",
    baseTemplate("Reset Your Password", `
      <p style="color:#475569;margin:0 0 20px">Hi ${data.name},</p>
      <p style="color:#475569;margin:0 0 20px">We received a request to reset your password. Click below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      ${button("Reset Password", data.resetUrl)}
      <p style="color:#94a3b8;font-size:13px;margin-top:20px">If you didn't request this, you can safely ignore this email.</p>
    `))
}

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  await sendMail(to, subject, `<p>${text}</p>`)
}

export async function sendWelcomeEmail(to: string, data: {
  name: string; email: string; password: string; role: string; appUrl: string
}) {
  const roleDisplay = data.role === "ADMIN" ? "Administrator" : data.role === "POC" ? "Point of Contact (POC)" : "Client"
  const roleDescription = data.role === "ADMIN"
    ? "You have full access to manage projects, approvals, team members, and system settings."
    : data.role === "POC"
      ? "You can create and manage print projects, track orders, and coordinate with the admin team."
      : "You have view-only access to track your print projects and order status."

  const result = await sendMail(to, `Account Created - ${data.name} | Welcome`,
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
    `))
  return result
}

export async function sendRoleChangeEmail(to: string, data: {
  name: string; oldRole: string; newRole: string; appUrl: string
}) {
  const oldRoleDisplay = data.oldRole === "ADMIN" ? "Administrator" : data.oldRole === "POC" ? "Point of Contact" : "Client"
  const newRoleDisplay = data.newRole === "ADMIN" ? "Administrator" : data.newRole === "POC" ? "Point of Contact" : "Client"

  await sendMail(to, `Account Role Updated - ${data.name} | Information`,
    baseTemplate("Account Role Updated", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.name},</p>
      <p style="color:#475569;margin:0 0 20px">Your account role has been updated in the system.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Previous Role", oldRoleDisplay)}
        ${infoRow("New Role", newRoleDisplay)}
      </table>
      <p style="color:#475569;margin:0 0 20px">Your permissions have been updated. Please log in again to see the changes.</p>
      ${button("Login to Your Account", `${data.appUrl}/login`)}
    `))
}

export async function sendAccountStatusEmail(to: string, data: {
  name: string; status: "activated" | "deactivated"; appUrl: string
}) {
  const isActive = data.status === "activated"
  const title = isActive ? "Account Activated" : "Account Deactivated"
  const statusLabel = isActive ? "Activated" : "Deactivated"

  await sendMail(to, `Account ${statusLabel} - ${data.name} | ${isActive ? "Information" : "Attention Required"}`,
    baseTemplate(title, `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.name},</p>
      <p style="color:#475569;margin:0 0 20px">Your account has been <strong style="color:${isActive ? "#16a34a" : "#dc2626"}">${statusLabel.toLowerCase()}</strong> in the system.</p>
      ${isActive
        ? `<p style="color:#475569;margin:0 0 20px">You can now log in and access the system.</p>${button("Login to Your Account", `${data.appUrl}/login`)}`
        : `<p style="color:#475569;margin:0 0 20px">You will no longer be able to access the system. Contact your administrator if you believe this was a mistake.</p>`
      }
    `))
}

export async function sendPIGeneratedEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; piDate: string; piAmount: string; appUrl: string; projectId?: string
}) {
  await sendMail(to, `Proforma Invoice Issued - ${data.projectName} | Action Required`,
    baseTemplate("Proforma Invoice Issued", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">A Proforma Invoice (PI) has been issued for the project below. Please review and take necessary action.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("PI Number", data.piNumber)}
        ${infoRow("PI Date", data.piDate)}
        ${infoRow("Total Amount", data.piAmount)}
      </table>
      <p style="color:#475569;margin:0 0 20px">Please review the PI and provide formal approval to enable further processing.</p>
      <p style="color:#64748b;font-size:12px;margin:0">Do not reply directly to this email.</p>
    `))
}

export async function sendProductionStartedEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; productionStartDate: string; appUrl: string; projectId?: string
}) {
  await sendMail(to, `Production Initiated - ${data.projectName} | Status Update`,
    baseTemplate("Production Initiated", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">Materials for the project below have moved to the Production Stage.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Order / PI Reference", data.piNumber)}
        ${infoRow("Production Start Date", data.productionStartDate)}
        ${infoRow("Current Status", "Under Production")}
      </table>
      <p style="color:#475569;margin:0 0 20px">You will be notified upon completion or if any exceptions arise.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>No action is required at this stage.</strong></p>
    `))
}

export async function sendShipmentDispatchedEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; dispatchDate: string; courier: string; deliveryAddress: string; appUrl: string; projectId?: string
}) {
  await sendMail(to, `Material Dispatched - ${data.projectName} | Shipment Details`,
    baseTemplate("Material Dispatched", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">Materials for the project below have been dispatched from the production facility.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Order / PI Reference", data.piNumber)}
        ${infoRow("Dispatch Date", data.dispatchDate)}
        ${infoRow("Courier / Transport Partner", data.courier)}
        ${infoRow("Delivery Address", data.deliveryAddress)}
      </table>
      ${button("Track Shipment", `${data.appUrl}/projects`)}
      <p style="color:#64748b;font-size:12px;margin-top:24px"><strong>Action Required:</strong> Please monitor shipment and arrange for receipt.</p>
    `))
}

export async function sendPendingPOReminderEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; piDate: string; piAmount: string; appUrl: string; projectId?: string
}) {
  await sendMail(to, `Pending PO - ${data.projectName} | Action Required`,
    baseTemplate("Pending Purchase Order Reminder", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">The Purchase Order (PO) for the project below is still pending as per system records.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Proforma Invoice (PI) Number", data.piNumber)}
        ${infoRow("PI Date", data.piDate)}
        ${infoRow("PI Amount", data.piAmount)}
      </table>
      <p style="color:#475569;margin:0 0 20px">Please share the PO at the earliest to avoid delays.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>Action Required:</strong> Submission of Purchase Order</p>
    `))
}

export async function sendOutstandingPaymentReminderEmail(to: string, data: {
  pocName: string; projectName: string; invoiceNumber: string; invoiceDate: string; outstandingAmount: string; appUrl: string; referenceType?: string; projectId?: string
}) {
  await sendMail(to, `Outstanding Payment Due - ${data.invoiceNumber} | Attention Required`,
    baseTemplate("Outstanding Payment Reminder", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">The following ${data.referenceType?.toLowerCase() || "invoice"} remains outstanding.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow(`${data.referenceType || "Invoice"} Number`, data.invoiceNumber)}
        ${infoRow(`${data.referenceType || "Invoice"} Date`, data.invoiceDate)}
        ${infoRow("Outstanding Amount", data.outstandingAmount)}
      </table>
      <p style="color:#475569;margin:0 0 20px">Please arrange for payment at the earliest.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>Action Required:</strong> Payment of outstanding dues</p>
    `))
}

export async function sendPIVerifiedEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; appUrl: string; projectId?: string
}) {
  await sendMail(to, `PI Verified - ${data.projectName} | Action Required`,
    baseTemplate("Proforma Invoice Verified", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">Your Proforma Invoice has been reviewed and verified by the Admin.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("PI Number", data.piNumber)}
        ${infoRow("Status", "Verified")}
      </table>
      <p style="color:#475569;margin:0 0 20px">Please share the verified PI with the client and obtain the Purchase Order (PO) to enable further processing.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>Action Required:</strong> Share PI with client and obtain Purchase Order.</p>
    `))
}

export async function sendPIRejectedEmail(to: string, data: {
  pocName: string; projectName: string; piNumber: string; reason?: string; appUrl: string; projectId?: string
}) {
  await sendMail(to, `PI Rejected - ${data.projectName} | Action Required`,
    baseTemplate("Proforma Invoice Rejected", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.pocName},</p>
      <p style="color:#475569;margin:0 0 20px">Your Proforma Invoice has been reviewed and rejected.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("PI Number", data.piNumber)}
        ${infoRow("Status", "Rejected")}
        ${data.reason ? infoRow("Reason for Rejection", data.reason) : ""}
      </table>
      <p style="color:#475569;margin:0 0 20px">Please review the reason and regenerate the PI with the necessary corrections.</p>
      <p style="color:#64748b;font-size:12px;margin:0"><strong>Action Required:</strong> Regenerate PI with corrections.</p>
    `))
}

export async function sendAdminNewProjectEmail(to: string, data: {
  adminName: string; projectName: string; projectId: string; pocName: string; clientName?: string; appUrl: string
}) {
  await sendMail(to, `Action Required: New Project Submitted - ${data.projectName} | Approval Pending`,
    baseTemplate("New Project Submitted for Approval", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.adminName},</p>
      <p style="color:#475569;margin:0 0 20px">A new project has been submitted and is pending your review and approval.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("Project ID", data.projectId)}
        ${infoRow("Submitted By", data.pocName)}
        ${data.clientName ? infoRow("On Behalf Of", data.clientName) : ""}
      </table>
      ${button("Review & Approve", `${data.appUrl}/approvals`)}
      <p style="color:#64748b;font-size:12px;margin-top:24px"><strong>Action Required:</strong> Review and approve or reject the project.</p>
    `))
}

export async function sendAdminPIPendingEmail(to: string, data: {
  adminName: string; projectName: string; piNumber: string; pocName: string; appUrl: string; projectId?: string
}) {
  await sendMail(to, `Action Required: PI Pending Verification - ${data.projectName} | Review Required`,
    baseTemplate("Proforma Invoice Pending Verification", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.adminName},</p>
      <p style="color:#475569;margin:0 0 20px">A Proforma Invoice has been generated and is pending your verification.</p>
      <table style="background:#f8fafc;border-radius:8px;width:100%;border-collapse:collapse;margin-bottom:20px">
        ${infoRow("Project Name", data.projectName)}
        ${infoRow("PI Number", data.piNumber)}
        ${infoRow("Generated By", data.pocName)}
      </table>
      ${button("Verify PI", `${data.appUrl}/projects`)}
      <p style="color:#64748b;font-size:12px;margin-top:24px"><strong>Action Required:</strong> Verify or reject the Proforma Invoice.</p>
    `))
}

export interface PendingReminderProject {
  id: string
  projectId: string
  name: string
  location: string
  deliveryDate: string | Date
  type: "PI" | "PO"
  detail: string
  grandTotal: number
}

export async function sendPendingPiPoReminderEmail(to: string, data: {
  name: string
  role: string
  type: "PI" | "PO"
  projects: PendingReminderProject[]
  appUrl: string
}) {
  const isPi = data.type === "PI"
  const title = isPi ? "Outstanding PI Action Items" : "Outstanding PO Action Items"
  const subject = isPi ? "Reminder: Outstanding PI Tasks - Action Required" : "Reminder: Outstanding PO Tasks - Action Required"
  const introText = isPi
    ? `This is a reminder that the following project(s) assigned to you have pending Proforma Invoice (PI) actions. Please generate or correct the PIs to enable further processing.`
    : `This is a reminder that the following project(s) assigned to you have pending Purchase Order (PO) actions. Please upload or obtain the POs to enable further processing.`

  const projectRows = data.projects.map((p) => {
    const formattedTotal = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(p.grandTotal)

    const detailDisplay = p.detail

    const dateStr = typeof p.deliveryDate === 'string' 
      ? new Date(p.deliveryDate).toLocaleDateString('en-IN')
      : p.deliveryDate.toLocaleDateString('en-IN')

    return `
      <tr style="border-bottom:1px solid #cbd5e1">
        <td style="padding:12px 8px;font-family:monospace;font-size:12px;font-weight:700;color:#003c71">${p.projectId}</td>
        <td style="padding:12px 8px;font-size:13px;color:#0f172a;font-weight:600">${p.name}</td>
        <td style="padding:12px 8px;font-size:13px;color:#475569">${p.location}</td>
        <td style="padding:12px 8px;font-size:12px;color:#9a3412;font-weight:600;background-color:#fff7ed">${detailDisplay}</td>
        <td style="padding:12px 8px;font-size:13px;font-family:monospace;color:#0f172a;font-weight:700;text-align:right">${formattedTotal}</td>
        <td style="padding:12px 8px;font-size:12px;color:#64748b;text-align:right">${dateStr}</td>
      </tr>
    `
  }).join("")

  const emailHtml = baseTemplate(title, `
    <p style="color:#475569;margin:0 0 20px">Dear ${data.name},</p>
    <p style="color:#475569;margin:0 0 20px">${introText}</p>
    
    <div style="overflow-x:auto;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse;text-align:left">
        <thead>
          <tr style="border-bottom:2px solid #cbd5e1;background-color:#f8fafc">
            <th style="padding:12px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">ID</th>
            <th style="padding:12px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">Project Name</th>
            <th style="padding:12px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">Location</th>
            <th style="padding:12px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">Pending Detail</th>
            <th style="padding:12px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;text-align:right">Total</th>
            <th style="padding:12px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;text-align:right">Delivery Date</th>
          </tr>
        </thead>
        <tbody>
          ${projectRows}
        </tbody>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px">
      ${button("View Pending Items", `${data.appUrl}/pending-pi-po`, "#003c71")}
    </div>
    
    <p style="color:#64748b;font-size:12px;margin:0"><strong>Action Required:</strong> Review the pending items in the Axis Print Management dashboard and upload/generate the required documents.</p>
  `)

  await sendMail(to, subject, emailHtml)
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
    `))
}

export async function sendTenantDeactivatedEmail(to: string, data: {
  name: string; companyName: string
}) {
  await sendMail(to, `Account Suspension Notice — Printflow`,
    baseTemplate("Account Suspension Notice", `
      <p style="color:#475569;margin:0 0 20px">Dear ${data.name},</p>
      <p style="color:#dc2626;margin:0 0 20px;font-weight:600">Your organization account (${data.companyName}) has been deactivated by the system administrator.</p>
      <p style="color:#475569;margin:0 0 20px">Your users will no longer be able to log in or access the system resources. Please contact Rishiraj Media support if you believe this is an error or to reactivate your subscription.</p>
    `))
}

export async function sendOrgAdminSummaryEmail(to: string, data: {
  adminName: string
  companyName: string
  pendingPi: any[]
  pendingPo: any[]
  appUrl: string
}) {
  const title = `Pending PI/PO Summary - ${data.companyName}`
  const subject = `Attention Required: Pending PI/PO Summary - ${data.companyName}`

  const piRows = data.pendingPi.length > 0 ? data.pendingPi.map((p) => {
    const formattedTotal = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(p.grandTotal)

    return `
      <tr style="border-bottom:1px solid #cbd5e1">
        <td style="padding:10px 8px;font-family:monospace;font-size:12px;font-weight:700;color:#003c71">${p.projectId}</td>
        <td style="padding:10px 8px;font-size:13px;color:#0f172a;font-weight:600">${p.name}</td>
        <td style="padding:10px 8px;font-size:12px;color:#475569">${p.pocName || "—"}</td>
        <td style="padding:10px 8px;font-size:12px;color:#475569">${p.clientName || "—"}</td>
        <td style="padding:10px 8px;font-size:12px;color:#9a3412;font-weight:600;background-color:#fff7ed">${p.detail}</td>
        <td style="padding:10px 8px;font-size:13px;font-family:monospace;color:#0f172a;font-weight:700;text-align:right">${formattedTotal}</td>
      </tr>
    `
  }).join("") : `<tr><td colspan="6" style="padding:16px;text-align:center;color:#64748b;font-size:13px">No pending Proforma Invoices</td></tr>`

  const poRows = data.pendingPo.length > 0 ? data.pendingPo.map((p) => {
    const formattedTotal = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(p.grandTotal)

    return `
      <tr style="border-bottom:1px solid #cbd5e1">
        <td style="padding:10px 8px;font-family:monospace;font-size:12px;font-weight:700;color:#003c71">${p.projectId}</td>
        <td style="padding:10px 8px;font-size:13px;color:#0f172a;font-weight:600">${p.name}</td>
        <td style="padding:10px 8px;font-size:12px;color:#475569">${p.pocName || "—"}</td>
        <td style="padding:10px 8px;font-size:12px;color:#475569">${p.clientName || "—"}</td>
        <td style="padding:10px 8px;font-size:12px;color:#047857;font-weight:600;background-color:#ecfdf5">${p.piNumber || "Verified"}</td>
        <td style="padding:10px 8px;font-size:13px;font-family:monospace;color:#0f172a;font-weight:700;text-align:right">${formattedTotal}</td>
      </tr>
    `
  }).join("") : `<tr><td colspan="6" style="padding:16px;text-align:center;color:#64748b;font-size:13px">No pending Purchase Orders</td></tr>`

  const emailHtml = baseTemplate(title, `
    <p style="color:#475569;margin:0 0 20px">Dear ${data.adminName},</p>
    <p style="color:#475569;margin:0 0 20px">Please find below a consolidated summary of outstanding Proforma Invoice (PI) and Purchase Order (PO) actions for your organization, <strong>${data.companyName}</strong>.</p>
    
    <h3 style="color:#0f172a;font-size:15px;margin:24px 0 12px;border-bottom:2px solid #003c71;padding-bottom:6px">Pending Proforma Invoices (PI)</h3>
    <div style="overflow-x:auto;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse;text-align:left">
        <thead>
          <tr style="border-bottom:2px solid #cbd5e1;background-color:#f8fafc">
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">ID</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">Project Name</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">POC</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">Client</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">Status</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${piRows}
        </tbody>
      </table>
    </div>

    <h3 style="color:#0f172a;font-size:15px;margin:24px 0 12px;border-bottom:2px solid #003c71;padding-bottom:6px">Pending Purchase Orders (PO)</h3>
    <div style="overflow-x:auto;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse;text-align:left">
        <thead>
          <tr style="border-bottom:2px solid #cbd5e1;background-color:#f8fafc">
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">ID</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">Project Name</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">POC</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">Client</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase">PI Number</th>
            <th style="padding:10px 8px;font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${poRows}
        </tbody>
      </table>
    </div>

    <div style="text-align:center;margin-bottom:24px">
      ${button("View Pending Items Dashboard", `${data.appUrl}/pending-pi-po`, "#003c71")}
    </div>
    
    <p style="color:#64748b;font-size:12px;margin:0">Please coordinate with the respective Points of Contact (POCs) or Client users to resolve these pending actions.</p>
  `)

  await sendMail(to, subject, emailHtml)
}
