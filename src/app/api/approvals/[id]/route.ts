import { NextRequest, NextResponse, after } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProjectStatus } from "@prisma/client"
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher"
import { sendProjectApprovedEmail, sendProjectRejectedEmail, sendPendingPOReminderEmail } from "@/lib/email"
import { logActivity } from "@/lib/audit"
import { formatCurrency } from "@/utils/formatters"
import { notifyProjectApproved, notifyProjectRejected } from "@/lib/notifications"

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized", details: "Please log in again" }, { status: 401 })
    }

    const { id } = await params

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { action, notes } = body
    const notesText = typeof notes === "string" ? notes.trim() : ""

    if (!action || !["approve", "reject", "reminder"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Verify the user exists in database
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    })

    if (!userExists) {
      return NextResponse.json({ error: "User session invalid", details: "Please log out and log in again" }, { status: 401 })
    }

    // Get approval with project details
    let approval
    try {
      approval = await prisma.approval.findUnique({
        where: { id },
        include: {
          project: { include: { poc: true, files: true } },
        },
      })
    } catch (dbError) {
      return NextResponse.json({ error: "Database error", details: dbError instanceof Error ? dbError.message : String(dbError) }, { status: 500 })
    }

    if (!approval) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 })
    }

    if (action === "approve" || action === "reject" || action === "reminder") {
      if (session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Only admins can manage approvals" }, { status: 403 })
      }
    }

    if (action === "approve") {
      try {
        await prisma.$transaction([
          prisma.approval.update({
            where: { id },
            data: { status: "APPROVED", approvedById: session.user.id, approvedAt: new Date(), notes: notesText || undefined },
          }),
          prisma.project.update({
            where: { id: approval.projectId },
            data: {
              status: ProjectStatus.APPROVED,
              statusHistory: {
                create: { status: ProjectStatus.APPROVED, note: notesText || "Approved", changedById: session.user.id },
              },
            },
          }),
        ])
      } catch (txError) {
        return NextResponse.json({ error: "Database transaction failed", details: txError instanceof Error ? txError.message : String(txError) }, { status: 500 })
      }

      // Send approval email + in-app notification to POC (if POC still exists)
      if (approval.project.poc) {
        try {
          await sendProjectApprovedEmail(approval.project.poc.email, {
            pocName: approval.project.poc.name,
            projectName: approval.project.name,
            projectId: approval.project.projectId,
            location: approval.project.location,
            totalCost: formatCurrency(approval.project.grandTotal),
            appUrl: APP_URL,
          })
        } catch (emailError) {
          console.error("[EMAIL ERROR] Failed to send project approved email:", emailError)
        }

        // In-app notification
        await notifyProjectApproved(approval.projectId, approval.project.poc.id, approval.project.name, approval.project.projectId)
      }

      // Audit log
      await logActivity({
        userId: session.user.id,
        action: "APPROVED",
        entityType: "approval",
        entityId: id,
        details: { projectId: approval.projectId, notes: notesText || undefined },
      })

    } else if (action === "reject") {
      if (!notesText) {
        return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 })
      }

      try {
        await prisma.$transaction([
          prisma.approval.update({
            where: { id },
            data: { status: "REJECTED", approvedById: session.user.id, rejectedAt: new Date(), notes: notesText },
          }),
          prisma.project.update({
            where: { id: approval.projectId },
            data: {
              status: ProjectStatus.CANCELLED,
              statusHistory: {
                create: { status: ProjectStatus.CANCELLED, note: notesText, changedById: session.user.id },
              },
            },
          }),
        ])
      } catch (txError) {
        return NextResponse.json({ error: "Database transaction failed", details: txError instanceof Error ? txError.message : String(txError) }, { status: 500 })
      }

      // Audit log
      await logActivity({
        userId: session.user.id,
        action: "REJECTED",
        entityType: "approval",
        entityId: id,
        details: { projectId: approval.projectId, notes: notesText },
      })

    } else if (action === "reminder") {
      const updated = await prisma.approval.update({
        where: { id },
        data: { reminderCount: { increment: 1 } },
      })

      // Audit log
      await logActivity({
        userId: session.user.id,
        action: "REMINDER_SENT",
        entityType: "approval",
        entityId: id,
        details: { projectId: approval.projectId, reminderCount: updated.reminderCount, sentTo: approval.project.poc?.email },
      })
    }

    after(async () => {
      try {
        if (action === "approve") {
          if (approval.project.poc) {
            try {
              await sendProjectApprovedEmail(approval.project.poc.email, {
                pocName: approval.project.poc.name,
                projectName: approval.project.name,
                projectId: approval.project.projectId,
                location: approval.project.location,
                totalCost: formatCurrency(approval.project.grandTotal),
                appUrl: APP_URL,
              })
            } catch (emailError) {
              console.error("[EMAIL ERROR] Failed to send project approved email:", emailError)
            }

            try {
              await notifyProjectApproved(
                approval.projectId,
                approval.project.poc.id,
                approval.project.name,
                approval.project.projectId
              )
            } catch (notifError) {
              console.error("Failed to send project approved notification:", notifError)
            }
          }
        } else if (action === "reject") {
          if (approval.project.poc) {
            try {
              await sendProjectRejectedEmail(approval.project.poc.email, {
                pocName: approval.project.poc.name,
                projectName: approval.project.name,
                projectId: approval.project.projectId,
                reason: notesText,
                appUrl: APP_URL,
              })
            } catch (emailError) {
              console.error("[EMAIL ERROR] Failed to send project rejected email:", emailError)
            }

            try {
              await notifyProjectRejected(
                approval.projectId,
                approval.project.poc.id,
                approval.project.name,
                approval.project.projectId,
                notesText
              )
            } catch (notifError) {
              console.error("Failed to send project rejected notification:", notifError)
            }
          }
        } else if (action === "reminder") {
          if (approval.project.poc?.email) {
            try {
              await sendPendingPOReminderEmail(approval.project.poc.email, {
                pocName: approval.project.poc.name,
                projectName: approval.project.name,
                piNumber: approval.project.piNumber || approval.project.projectId,
                piDate: new Date(approval.project.createdAt).toLocaleDateString('en-IN'),
                piAmount: formatCurrency(approval.project.grandTotal),
                appUrl: APP_URL,
                projectId: approval.project.id,
              })
            } catch (emailError) {
              console.error("[EMAIL ERROR] Failed to send PO reminder email:", emailError)
            }
          }
        }

        // Trigger pusher notifications
        try {
          await pusherServer.trigger(CHANNELS.APPROVALS, EVENTS.APPROVAL_UPDATED, { id })
        } catch (pusherError) {
          console.error("Failed to trigger Pusher APPROVALS:", pusherError)
        }
        try {
          await pusherServer.trigger(CHANNELS.PROJECTS, EVENTS.PROJECT_UPDATED, { projectId: approval.projectId })
        } catch (pusherError) {
          console.error("Failed to trigger Pusher PROJECTS:", pusherError)
        }
        try {
          await pusherServer.trigger(CHANNELS.DASHBOARD, EVENTS.STATS_UPDATED, {})
        } catch (pusherError) {
          console.error("Failed to trigger Pusher DASHBOARD:", pusherError)
        }
      } catch (afterError) {
        console.error("Failed processing tasks in after() hook:", afterError)
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to process approval", details: errorMessage }, { status: 500 })
  }
}
