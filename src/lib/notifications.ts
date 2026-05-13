import { prisma } from "./prisma"
import { pusherServer, CHANNELS, EVENTS } from "./pusher"
import { sendProjectApprovedEmail, sendProjectRejectedEmail, sendPIRejectedEmail, sendAdminNewProjectEmail, sendAdminPIPendingEmail } from "./email"

export async function createNotification(data: {
  userId: string
  title: string
  message: string
  type: string
  link?: string
}) {
  try {
    await prisma.notification.create({ data })
    // Trigger real-time update
    await pusherServer.trigger(CHANNELS.NOTIFICATIONS, EVENTS.NOTIFICATION_CREATED, { userId: data.userId })
  } catch (error) {
    // Silent fail - notification is not critical
  }
}

export async function notifyProjectApproved(projectId: string, pocId: string, projectName: string, projectIdStr: string) {
  await createNotification({
    userId: pocId,
    title: "Project Approved",
    message: `Your project "${projectName}" (${projectIdStr}) has been approved and will proceed to production.`,
    type: "approval",
    link: `/projects/${projectId}`,
  })
  // HTML email is sent directly from the approvals route via sendProjectApprovedEmail
}

export async function notifyProjectRejected(projectId: string, pocId: string, projectName: string, projectIdStr: string, reason?: string) {
  await createNotification({
    userId: pocId,
    title: "Project Rejected",
    message: `Your project "${projectName}" (${projectIdStr}) has been rejected.${reason ? ` Reason: ${reason}` : ""}`,
    type: "rejection",
    link: `/projects/${projectId}`,
  })
  // HTML email is sent directly from the approvals route via sendProjectRejectedEmail
}

export async function notifyProjectDispatched(projectId: string, pocId: string, clientId: string | null | undefined, projectName: string, projectIdStr: string, courier: string, trackingId: string) {
  // Notify POC
  await createNotification({
    userId: pocId,
    title: "Order Dispatched",
    message: `Your order "${projectName}" (${projectIdStr}) has been dispatched via ${courier}. Tracking: ${trackingId}`,
    type: "dispatch",
    link: `/projects/${projectId}`,
  })

  // Notify Client (if assigned)
  if (clientId) {
    await createNotification({
      userId: clientId,
      title: "Order Dispatched",
      message: `Your order "${projectName}" (${projectIdStr}) has been dispatched via ${courier}. Tracking: ${trackingId}`,
      type: "dispatch",
      link: `/projects/${projectId}`,
    })
  }
  // HTML email is sent directly from the projects route via sendShipmentDispatchedEmail
}

export async function notifyProjectDelivered(projectId: string, pocId: string, clientId: string | null | undefined, projectName: string, projectIdStr: string) {
  // Notify POC
  await createNotification({
    userId: pocId,
    title: "Order Delivered",
    message: `Your order "${projectName}" (${projectIdStr}) has been delivered successfully.`,
    type: "delivered",
    link: `/projects/${projectId}`,
  })

  // Notify Client (if assigned)
  if (clientId) {
    await createNotification({
      userId: clientId,
      title: "Order Delivered",
      message: `Your order "${projectName}" (${projectIdStr}) has been delivered successfully.`,
      type: "delivered",
      link: `/projects/${projectId}`,
    })
  }
  // No email for delivered — add sendDeliveredEmail here if needed in future
}

export async function notifyAdminsNewApproval(projectId: string, projectName: string, projectIdStr: string, pocName: string, clientName?: string) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true, email: true, name: true },
  })

  const message = clientName
    ? `${pocName} has submitted a new project "${projectName}" (${projectIdStr}) on behalf of ${clientName} for approval.`
    : `${pocName} has submitted a new project "${projectName}" (${projectIdStr}) for approval.`

  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

  await Promise.all(admins.map((admin) =>
    createNotification({
      userId: admin.id,
      title: "New Approval Request",
      message,
      type: "approval_request",
      link: `/approvals`,
    })
  ))

  await Promise.all(admins.filter(a => a.email).map((admin) =>
    sendAdminNewProjectEmail(admin.email!, {
      adminName: admin.name || "Admin",
      projectName,
      projectId: projectIdStr,
      pocName,
      clientName,
      appUrl,
    })
  ))
}

// Notify POC about PI rejected
export async function notifyPICStatus(
  projectId: string,
  pocId: string,
  piNumber: string | null,
  status: string,
  notes?: string,
  projectName?: string
) {
  const user = await prisma.user.findUnique({
    where: { id: pocId },
    select: { email: true, name: true },
  })

  const message = `Your PI ${piNumber} has been rejected.${notes ? ` Reason: ${notes}` : " Please regenerate with corrections."}`

  await createNotification({
    userId: pocId,
    title: "PI Rejected",
    message,
    type: "pi_rejected",
    link: `/projects/${projectId}`,
  })

  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

  if (user?.email && user?.name) {
    await sendPIRejectedEmail(user.email, {
      pocName: user.name,
      projectName: projectName || "Your Project",
      piNumber: piNumber || "",
      reason: notes,
      appUrl,
    })
  }
}

export async function notifyPOCPIVerified(
  projectId: string,
  projectName: string,
  piNumber: string,
  pocId: string
) {
  // In-app notification only — PI email is sent directly from verify-pi route
  await createNotification({
    userId: pocId,
    title: "PI Verified",
    message: `Your PI ${piNumber} for "${projectName}" has been verified. The PI has been sent to your email.`,
    type: "pi_verified",
    link: `/projects/${projectId}`,
  })
}

export async function notifyPOCPIRejected(
  projectId: string,
  projectName: string,
  piNumber: string,
  pocId: string,
  reason?: string
) {
  await notifyPICStatus(projectId, pocId, piNumber, "REJECTED", reason, projectName)
}




// Notify admins about new PI pending verification
export async function notifyAdminPIPending(
  projectId: string,
  projectName: string,
  piNumber: string,
  pocName: string
) {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true, email: true, name: true },
  })

  const message = `New PI ${piNumber} for project "${projectName}" generated by ${pocName} is pending verification.`
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

  await Promise.all(
    admins.map((admin) =>
      createNotification({
        userId: admin.id,
        title: "PI Pending Verification",
        message,
        type: "pi_pending",
        link: `/projects/${projectId}`,
      })
    )
  )

  await Promise.all(
    admins.filter((a) => a.email).map((admin) =>
      sendAdminPIPendingEmail(admin.email!, {
        adminName: admin.name || "Admin",
        projectName,
        piNumber,
        pocName,
        appUrl,
      })
    )
  )
}
