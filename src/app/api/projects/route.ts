import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProjectStatus, UserRole, Prisma } from "@prisma/client"
import { z } from "zod"
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher"
import { logActivity } from "@/lib/audit"
import { notifyAdminsNewApproval, createNotification } from "@/lib/notifications"
import { sendEmail, sendPIGeneratedEmail } from "@/lib/email"
import { formatCurrency } from "@/utils/formatters"
import { calculateTotal } from "@/lib/ratecard"

const createProjectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters").max(200),
  description: z.string().max(1000).optional(),
  pocId: z.string().min(1, "POC is required"),
  clientId: z.string().optional().nullable(),
  location: z.string().min(1, "Location is required"),
  branch: z.string().optional(),
  state: z.string().optional(),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  instructions: z.string().max(1000).optional(),
  packingCharges: z.number().min(0).default(0),
  packingChargesGstRate: z.number().min(0).max(100).default(18),
  deliveryCharges: z.number().min(0).default(0),
  deliveryChargesGstRate: z.number().min(0).max(100).default(18),
  totalCost: z.number().min(0).optional(),
  recipientName: z.string().optional(),
  recipientContact: z.string().optional(),
  recipientBranch: z.string().optional(),
  leadsGenerated: z.number().int().min(0).nullable().optional(),
  leadsConverted: z.number().int().min(0).nullable().optional(),
  collaterals: z.array(z.object({
    itemName: z.string().min(1),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    unitPrice: z.number().min(0).optional(),
    totalPrice: z.number().min(0).optional(),
    specification: z.string().max(1000).optional().nullable(),
  })).min(1, "At least one collateral is required"),
})

async function priceCollaterals(collaterals: Array<{ itemName: string; quantity: number; specification?: string | null }>) {
  const priced = await Promise.all(collaterals.map(async (c) => {
    const calc = await calculateTotal(c.itemName, c.quantity)
    if (calc === null) {
      throw new Error(`No active rate card price found for ${c.itemName} at quantity ${c.quantity}`)
    }

    return {
      itemName: c.itemName,
      quantity: c.quantity,
      unitPrice: calc.unitPrice,
      totalPrice: calc.subtotal,
      gstRate: calc.gstRate,
      gstAmount: calc.gst,
      specification: c.specification || null,
    }
  }))

  return {
    collaterals: priced,
    subtotal: priced.reduce((sum, c) => sum + c.totalPrice, 0),
    totalGst: priced.reduce((sum, c) => sum + c.gstAmount, 0),
  }
}

import { signProjectsUrls } from "@/lib/project-utils"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const poc = searchParams.get("poc")
    const location = searchParams.get("location")
    const search = searchParams.get("search")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50"))

    const where: Prisma.ProjectWhereInput = {}
    if (status && status !== "all") where.status = status as ProjectStatus
    if (poc && poc !== "all") where.pocId = poc
    if (location && location !== "all") where.location = location

    // CLIENT can only see their own projects (assigned to them as client)
    if (session.user.role === "CLIENT") {
      where.clientId = session.user.id
    }

    // POC can see:
    // 1. Their own projects (pocId = their id)
    // 2. Client projects they created (approval.requestedById = their id AND clientId is set)
    if (session.user.role === "POC") {
      where.OR = [
        { pocId: session.user.id },
        {
          AND: [
            { clientId: { not: null } },
            { approval: { requestedById: session.user.id } }
          ]
        }
      ]
    }
    if (search) {
      where.OR = [
        { projectId: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { poc: { name: { contains: search, mode: "insensitive" } } },
        { dispatch: { trackingId: { contains: search, mode: "insensitive" } } },
      ]
    }

    const [projects, total, pocsList, locationGroups] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          poc: { select: { id: true, name: true, email: true, role: true } },
          client: { select: { id: true, name: true, email: true, role: true } },
          collaterals: true,
          dispatch: { select: { trackingId: true, courier: true } },
          _count: { select: { collaterals: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.project.count({ where }),
      prisma.user.findMany({ where: { role: UserRole.POC, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.project.groupBy({ by: ["location"], orderBy: { location: "asc" } }),
    ])

    const signedProjects = await signProjectsUrls(projects as any);

    return NextResponse.json({
      projects: signedProjects,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      pocs: pocsList,
      locations: locationGroups.map((l) => l.location),
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Verify the session user exists in database (handles stale sessions after DB reset)
    const sessionUser = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!sessionUser) {
      return NextResponse.json({ error: "Session expired. Please log out and log back in." }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createProjectSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, description, pocId, clientId, location, branch, state, deliveryDate, instructions, packingCharges, packingChargesGstRate, deliveryCharges, deliveryChargesGstRate, collaterals, totalCost, recipientName, recipientContact, recipientBranch, leadsGenerated, leadsConverted } = parsed.data

    // POC is required
    if (!pocId) {
      return NextResponse.json({ error: "POC is required" }, { status: 400 })
    }

    // Validate delivery date is in the future
    const delivery = new Date(deliveryDate)
    if (delivery <= new Date()) {
      return NextResponse.json({ error: "Delivery date must be in the future" }, { status: 400 })
    }

    // CLIENTs cannot create projects
    if (session.user.role === "CLIENT") {
      return NextResponse.json({ error: "Clients cannot create projects" }, { status: 403 })
    }

    let pocName: string | null = null
    let clientName: string | null = null

    // Validate POC if provided
    if (pocId) {
      const poc = await prisma.user.findUnique({ where: { id: pocId } })
      if (!poc || !poc.active || poc.role !== "POC") {
        return NextResponse.json({ error: "Invalid POC selected" }, { status: 400 })
      }
      pocName = poc.name
    }

    // Validate Client if provided
    if (clientId) {
      const client = await prisma.user.findUnique({ where: { id: clientId } })
      if (!client || !client.active || client.role !== "CLIENT") {
        return NextResponse.json({ error: "Invalid Client selected" }, { status: 400 })
      }
      clientName = client.name
    }

    // POCs can create projects for themselves OR for clients
    if (session.user.role === "POC") {
      // If creating for a client, validate that the clientId is provided
      if (clientId) {
        const client = await prisma.user.findUnique({ where: { id: clientId } })
        if (!client || client.role !== "CLIENT") {
          return NextResponse.json({ error: "POCs can only assign projects to Clients" }, { status: 403 })
        }
      }
      // If not creating for client, POC must be creating for themselves
      if (!clientId && pocId !== session.user.id) {
        return NextResponse.json({ error: "POCs can only create projects for themselves or assign to Clients" }, { status: 403 })
      }
    }

    let priced: Awaited<ReturnType<typeof priceCollaterals>>
    try {
      priced = await priceCollaterals(collaterals)
    } catch (error) {
      const pricingError = error instanceof Error ? error.message : "Invalid collateral pricing"
      return NextResponse.json({
        error: pricingError,
      }, { status: 400 })
    }

    const year = new Date().getFullYear()
    const random = Math.floor(Math.random() * 900) + 100
    const projectId = `PRJ-${year}-${random}`

    // Calculate totals
    const collateralsSubtotal = priced.subtotal
    const collateralsGst = priced.totalGst
    const packingSubtotal = packingCharges || 0
    const packingGst = packingSubtotal * (packingChargesGstRate / 100)
    const deliverySubtotal = deliveryCharges || 0
    const deliveryGst = deliverySubtotal * (deliveryChargesGstRate / 100)

    const totalSubtotal = collateralsSubtotal + packingSubtotal + deliverySubtotal
    const totalGrandTotal = collateralsSubtotal + collateralsGst + packingSubtotal + packingGst + deliverySubtotal + deliveryGst

    const project = await prisma.project.create({
      data: {
        projectId,
        name,
        description,
        pocId,
        pocName,
        clientId,
        clientName,
        location,
        branch,
        state,
        deliveryDate: delivery,
        instructions,
        packingCharges: packingSubtotal,
        packingChargesGstRate: packingChargesGstRate,
        deliveryCharges: deliverySubtotal,
        deliveryChargesGstRate: deliveryChargesGstRate,
        totalCost: totalSubtotal,
        grandTotal: totalGrandTotal,
        recipientName,
        recipientContact,
        recipientBranch,
        leadsGenerated,
        leadsConverted,
        collaterals: {
          create: priced.collaterals.map((c) => ({
            itemName: c.itemName,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
            totalPrice: c.totalPrice,
            gstRate: c.gstRate,
            gstAmount: c.gstAmount,
            specification: c.specification,
          })),
        },
        statusHistory: {
          create: { status: ProjectStatus.REQUESTED, note: "Project created", changedById: session.user.id },
        },
      },
      include: {
        poc: { select: { id: true, name: true, email: true, role: true } },
        client: { select: { id: true, name: true, email: true, role: true } },
        collaterals: true,
      },
    })

    await prisma.approval.create({
      data: { projectId: project.id, requestedById: session.user.id, status: "PENDING" },
    })

    // Post-creation notifications — each step is independently wrapped so one failure
    // cannot silently block admin email dispatch.
    console.log(`[PROJECT CREATED] Running post-creation notifications for ${project.projectId}`)

    // Step A: Pusher real-time triggers
    try {
      await pusherServer.trigger(CHANNELS.PROJECTS, EVENTS.PROJECT_CREATED, { id: project.id })
      await pusherServer.trigger(CHANNELS.DASHBOARD, EVENTS.STATS_UPDATED, {})
      await pusherServer.trigger(CHANNELS.APPROVALS, EVENTS.APPROVAL_UPDATED, {})
      console.log(`[PROJECT CREATED] Pusher triggers sent for ${project.projectId}`)
    } catch (pusherError) {
      console.error(`[PROJECT CREATED] Pusher trigger failed (non-critical):`, pusherError)
    }

    // Step B: Activity log
    try {
      await logActivity({
        userId: session.user.id,
        action: "PROJECT_CREATED",
        entityType: "project",
        entityId: project.id,
        details: { projectId: project.projectId, name: project.name, location, clientSubtotal: totalCost, totalCost: project.totalCost, pocId, clientId },
      })
      console.log(`[PROJECT CREATED] Activity logged for ${project.projectId}`)
    } catch (auditError) {
      console.error(`[PROJECT CREATED] Activity log failed (non-critical):`, auditError)
    }

    // Step C: Notify all admins via DB notification + email
    try {
      const pocName = project.poc?.name || project.pocName || "A user"
      const clientName = project.client?.name || project.clientName || undefined
      console.log(`[PROJECT CREATED] Sending admin notifications → pocName="${pocName}" clientName="${clientName}"`)
      await notifyAdminsNewApproval(project.id, project.name, project.projectId, pocName, clientName)
      console.log(`[PROJECT CREATED] Admin notifications completed for ${project.projectId}`)
    } catch (notifyError) {
      console.error(`[PROJECT CREATED] Admin notification/email failed:`, notifyError)
    }

    // Step D: Notify the assigned user (POC or CLIENT)
    try {
      const assignedUserId = pocId || clientId
      if (assignedUserId) {
        await createNotification({
          userId: assignedUserId,
          title: "New Project Assigned",
          message: `A new project "${project.name}" (${project.projectId}) has been created and assigned to you. Status: PENDING APPROVAL.`,
          type: "project_assigned",
          link: `/projects/${project.id}`,
        })
        console.log(`[PROJECT CREATED] Assigned-user notification sent → userId=${assignedUserId}`)
      }
    } catch (assignError) {
      console.error(`[PROJECT CREATED] Assigned-user notification failed:`, assignError)
    }

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({
      error: "Failed to create project",
      debug: process.env.NODE_ENV === "development" ? errorMessage : undefined
    }, { status: 500 })
  }
}
