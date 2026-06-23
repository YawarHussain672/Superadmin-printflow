import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { basePrisma as prisma } from "@/lib/prisma" // Use basePrisma to query across tenants for cron, but we explicitly scope filters
import { sendPendingPiPoReminderEmail, PendingReminderProject } from "@/lib/email"

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"

export async function POST(request: NextRequest) {
  try {
    let force = false
    let targetProjectId: string | undefined = undefined
    let targetUserId: string | undefined = undefined
    let targetUserEmail: string | undefined = undefined
    let targetPocEmail: string | undefined = undefined
    let targetClientId: string | undefined = undefined
    let isCron = false

    let reminderType: "PI" | "PO" | "BOTH" = "BOTH"

    // Check auth/headers to determine caller
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    let session = null
    if (authHeader && cronSecret && authHeader === `Bearer ${cronSecret}`) {
      isCron = true
    } else {
      // Check session
      session = await getServerSession(authOptions)
      if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    // Parse body if present
    try {
      const body = await request.json()
      if (body) {
        force = !!body.force
        targetProjectId = body.projectId
        targetUserId = body.userId
        targetUserEmail = body.userEmail
        targetPocEmail = body.pocEmail
        if (body.reminderType === "PI" || body.reminderType === "PO" || body.reminderType === "BOTH") {
          reminderType = body.reminderType
        }
        if (body.clientId) {
          targetClientId = body.clientId
        }
      }
    } catch {
      // Ignore if no body
    }

    // Determine target clients/tenants
    let clientsToProcess: { id: string; companyName: string }[] = []
    if (isCron) {
      if (targetProjectId) {
        const project = await prisma.project.findUnique({
          where: { id: targetProjectId },
          select: { tenantClientId: true }
        })
        if (project?.tenantClientId) {
          const client = await prisma.client.findUnique({
            where: { id: project.tenantClientId },
            select: { id: true, companyName: true }
          })
          if (client) clientsToProcess.push(client)
        }
      } else if (targetPocEmail) {
        const user = await prisma.user.findUnique({
          where: { email: targetPocEmail },
          select: { clientId: true }
        })
        if (user?.clientId) {
          const client = await prisma.client.findUnique({
            where: { id: user.clientId },
            select: { id: true, companyName: true }
          })
          if (client) clientsToProcess.push(client)
        }
      } else {
        // Run globally for all active clients
        clientsToProcess = await prisma.client.findMany({
          where: { isActive: true },
          select: { id: true, companyName: true }
        })
      }
    } else if (session?.user.role === "SUPERADMIN") {
      // Superadmin can filter to a specific organization or process all
      if (targetClientId) {
        const client = await prisma.client.findUnique({
          where: { id: targetClientId },
          select: { id: true, companyName: true }
        })
        if (client) clientsToProcess.push(client)
      } else {
        clientsToProcess = await prisma.client.findMany({
          where: { isActive: true },
          select: { id: true, companyName: true }
        })
      }
    } else if (session?.user.clientId) {
      // Scoped only to the logged-in administrator's client
      const client = await prisma.client.findUnique({
        where: { id: session.user.clientId },
        select: { id: true, companyName: true }
      })
      if (client) clientsToProcess.push(client)
    }

    let totalEmailsSent = 0
    const errors: string[] = []
    const now = new Date()

    // Process reminders per client
    for (const client of clientsToProcess) {
      const settings = await prisma.systemSetting.findMany({
        where: { clientId: client.id }
      })

      const isEnabled = settings.find(s => s.key === "reminder_emails_enabled")?.value === "true"
      
      // If automated cron and not enabled for this client, skip
      if (isCron && !isEnabled && !force && !targetProjectId && !targetUserId && !targetUserEmail && !targetPocEmail) {
        continue
      }

      const intervalDays = parseInt(
        settings.find(s => s.key === "reminder_emails_interval_days")?.value || "7"
      )
      const thresholdDate = new Date(now.getTime() - intervalDays * 24 * 60 * 60 * 1000)

      // Query pending projects for this client
      const pendingPiProjects = reminderType === "PO" ? [] : await prisma.project.findMany({
        where: {
          tenantClientId: client.id,
          status: { not: "CANCELLED" },
          OR: [
            { piStatus: "PENDING" },
            { piStatus: "REJECTED" },
            { piStatus: null, piNumber: null },
          ],
          ...(targetProjectId ? { id: targetProjectId } : {}),
          ...(targetPocEmail ? { poc: { email: targetPocEmail } } : {})
        },
        include: {
          poc: true,
          client: true,
          files: true
        }
      })

      const pendingPoProjects = reminderType === "PI" ? [] : await prisma.project.findMany({
        where: {
          tenantClientId: client.id,
          piStatus: "VERIFIED",
          files: { none: { type: "PO" } },
          ...(targetProjectId ? { id: targetProjectId } : {}),
          ...(targetPocEmail ? { poc: { email: targetPocEmail } } : {})
        },
        include: {
          poc: true,
          client: true,
          files: true
        }
      })

      // Map of "userEmail_type" -> { name, email, role, type, projects: PendingReminderProject[] }
      const userReminderMap = new Map<string, {
        name: string
        email: string
        role: string
        type: "PI" | "PO"
        projects: PendingReminderProject[]
      }>()

      const addProjectToUser = (user: any, p: any, type: "PI" | "PO", detail: string) => {
        if (!user?.email) return
        
        if (targetUserId && user.id !== targetUserId) return
        if (targetUserEmail && user.email.toLowerCase() !== targetUserEmail.toLowerCase()) return

        const key = `${user.email.toLowerCase()}_${type}`

        if (!userReminderMap.has(key)) {
          userReminderMap.set(key, {
            name: user.name,
            email: user.email,
            role: user.role,
            type,
            projects: []
          })
        }

        const userRecord = userReminderMap.get(key)!
        if (userRecord.projects.some(proj => proj.id === p.id)) return

        userRecord.projects.push({
          id: p.id,
          projectId: p.projectId,
          name: p.name,
          location: p.location,
          deliveryDate: p.deliveryDate,
          type,
          detail,
          grandTotal: p.grandTotal || p.totalCost
        })
      }

      // Get all active tenant admins for this client/tenant organization
      const tenantAdmins = await prisma.user.findMany({
        where: {
          clientId: client.id,
          role: "ADMIN",
          active: true
        }
      })

      // Process pending PIs
      for (const p of pendingPiProjects) {
        let detail = "PI Not Generated"
        if (p.piStatus === "PENDING") {
          detail = "Pending Admin Verification"
        } else if (p.piStatus === "REJECTED") {
          detail = "PI Rejected (Requires Action)"
        }
        
        if (p.poc) {
          addProjectToUser(p.poc, p, "PI", detail)
        }
        
        // Add to all tenant admins
        for (const admin of tenantAdmins) {
          addProjectToUser(admin, p, "PI", detail)
        }
      }

      // Process pending POs
      for (const p of pendingPoProjects) {
        const detail = "Pending PO Upload (Requires Action)"
        
        if (p.poc) {
          addProjectToUser(p.poc, p, "PO", detail)
        }
        if (p.client) {
          addProjectToUser(p.client, p, "PO", detail)
        }
        
        // Add to all tenant admins
        for (const admin of tenantAdmins) {
          addProjectToUser(admin, p, "PO", detail)
        }
      }

      const userEligibility = new Map<string, boolean>()

      for (const [_, record] of userReminderMap.entries()) {
        if (record.projects.length === 0) continue

        const email = record.email

        if (!userEligibility.has(email)) {
          const dbUser = await prisma.user.findUnique({
            where: { email }
          })
          if (!dbUser) {
            userEligibility.set(email, false)
          } else {
            const eligible = force || !!targetProjectId || !!targetUserId || !!targetUserEmail || !!targetPocEmail ||
              !dbUser.lastPiPoReminderSentAt ||
              dbUser.lastPiPoReminderSentAt < thresholdDate
            userEligibility.set(email, eligible)
          }
        }

        const isEligible = userEligibility.get(email) || false

        if (isEligible) {
          try {
            await sendPendingPiPoReminderEmail(email, {
              name: record.name,
              role: record.role,
              type: record.type,
              projects: record.projects,
              appUrl: APP_URL
            })

            await prisma.user.update({
              where: { email },
              data: { lastPiPoReminderSentAt: now }
            })

            totalEmailsSent++
          } catch (mailError: any) {
            console.error(`Error sending reminder email to ${email}:`, mailError)
            errors.push(`${email}: ${mailError.message}`)
          }
        }
      }

      // Update tenant-specific setting for last run
      await prisma.systemSetting.upsert({
        where: { clientId_key: { clientId: client.id, key: "reminder_emails_last_run" } },
        update: { value: now.toISOString() },
        create: { clientId: client.id, key: "reminder_emails_last_run", value: now.toISOString() }
      })
    }

    return NextResponse.json({
      success: true,
      emailsSent: totalEmailsSent,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully processed reminders. Sent ${totalEmailsSent} email(s).`
    })

  } catch (error: any) {
    console.error("Reminders execution error:", error)
    return NextResponse.json({ error: "Failed to process reminders", details: error.message }, { status: 500 })
  }
}
