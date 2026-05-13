import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProjectStatus, Prisma } from "@prisma/client"
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher"
import { createNotification } from "@/lib/notifications"
import { sendProductionStartedEmail, sendShipmentDispatchedEmail } from "@/lib/email"
import { formatCurrency } from "@/utils/formatters"
import { calculateTotal } from "@/lib/ratecard"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

function getCloudinaryPublicIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split("/").filter(Boolean)
    const uploadIndex = parts.indexOf("upload")
    if (uploadIndex === -1) return null

    const publicPathParts = parts.slice(uploadIndex + 1)
    if (publicPathParts[0]?.match(/^v\d+$/)) {
      publicPathParts.shift()
    }

    return decodeURIComponent(publicPathParts.join("/"))
  } catch {
    return null
  }
}

async function deleteCloudinaryAsset(url: string | null | undefined) {
  if (!url) return

  const publicId = getCloudinaryPublicIdFromUrl(url)
  if (!publicId) return

  const publicIdWithoutExtension = publicId.replace(/\.[^/.]+$/, "")
  const attempts = [
    { publicId, resource_type: "raw" as const },
    { publicId: publicIdWithoutExtension, resource_type: "raw" as const },
    { publicId: publicIdWithoutExtension, resource_type: "image" as const },
    { publicId, resource_type: "image" as const },
  ]

  for (const attempt of attempts) {
    try {
      const result = await cloudinary.uploader.destroy(attempt.publicId, {
        resource_type: attempt.resource_type,
      })
      if (result.result === "ok") {
        return
      }
    } catch {
      // Try the next resource/public ID shape.
    }
  }
}

async function priceCollaterals(collaterals: Array<{ itemName: string; quantity: number }>) {
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
    }
  }))

  return {
    collaterals: priced,
    subtotal: priced.reduce((sum, c) => sum + c.totalPrice, 0),
    totalGst: priced.reduce((sum, c) => sum + c.gstAmount, 0),
  }
}

// GET /api/projects/[id]
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        poc: { select: { id: true, name: true, email: true, phone: true, role: true } },
        client: { select: { id: true, name: true, email: true, phone: true, role: true } },
        collaterals: true,
        statusHistory: { orderBy: { timestamp: "desc" } },
        files: true,
        dispatch: true,
        approval: true,
      },
    })

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 })
    // Allow access if: admin, POC assigned, or client assigned
    const isAuthorized = session.user.role === "ADMIN" ||
      project.pocId === session.user.id ||
      project.clientId === session.user.id
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(project)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 })
  }
}

// PUT /api/projects/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user exists in database
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    })
    if (!userExists) {
      return NextResponse.json({ error: "User session invalid", details: "Please log out and log in again" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, pocId, clientId, location, state, deliveryDate, instructions, collaterals, status, note, dispatch, packingCharges, packingChargesGstRate } = body

    // clientId: "" means "remove client" - treat as null (client is optional)

    // Fetch existing project to check ownership and status
    const existing = await prisma.project.findUnique({ where: { id }, select: { pocId: true, status: true, piStatus: true, approval: { select: { status: true } }, name: true, piNumber: true, projectId: true, location: true, packingCharges: true, packingChargesGstRate: true, poc: { select: { id: true, name: true, email: true } } } })
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const isAdmin = session.user.role === "ADMIN"
    const isClient = session.user.role === "CLIENT"
    const isOwner = existing.pocId === session.user.id
    const projectApprovedByAdmin = existing.approval?.status === "APPROVED" || !["REQUESTED", "CANCELLED"].includes(existing.status)
    const pocCanManageAfterApproval = isOwner && projectApprovedByAdmin && existing.piStatus === "VERIFIED"
    const isStatusUpdate = status !== undefined
    const isDispatchUpdate = dispatch !== undefined
    const isProjectDetailsUpdate = [
      name,
      pocId,
      clientId,
      location,
      state,
      deliveryDate,
      instructions,
      collaterals,
      packingCharges,
      packingChargesGstRate,
    ].some((value) => value !== undefined)

    // CLIENT cannot edit projects
    if (isClient) {
      return NextResponse.json({ error: "Clients cannot edit projects" }, { status: 403 })
    }

    // POC can only edit their own projects
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "You can only edit your own projects" }, { status: 403 })
    }

    // POC can only edit core project details while REQUESTED, but may update status/dispatch for own projects.
    if (!isAdmin && isProjectDetailsUpdate && existing.status !== "REQUESTED") {
      return NextResponse.json({ error: "Project cannot be edited once it has been submitted for approval" }, { status: 403 })
    }

    if ((isStatusUpdate || isDispatchUpdate) && !isAdmin && !isOwner) {
      return NextResponse.json({ error: "You can only update status or dispatch for your own projects" }, { status: 403 })
    }

    if ((isStatusUpdate || isDispatchUpdate) && !isAdmin && !pocCanManageAfterApproval) {
      return NextResponse.json({ error: "POCs can update status or dispatch only after admin approves the project and verifies the PI" }, { status: 403 })
    }

    // POC cannot modify collaterals after submission
    if (!isAdmin && collaterals !== undefined && existing.status !== "REQUESTED") {
      return NextResponse.json({ error: "Cannot modify collaterals after submission" }, { status: 403 })
    }

    const updateData: Prisma.ProjectUpdateInput = {}
    if (name !== undefined) updateData.name = name
    if (pocId !== undefined) {
      if (!isAdmin && pocId !== session.user.id) {
        return NextResponse.json({ error: "POCs cannot reassign project ownership" }, { status: 403 })
      }
      updateData.poc = { connect: { id: pocId } }
    }
    if (clientId !== undefined) {
      if (clientId === "" || clientId === null) {
        updateData.client = { disconnect: true }
      } else {
        updateData.client = { connect: { id: clientId } }
      }
    }
    if (location !== undefined) updateData.location = location
    if (state !== undefined) updateData.state = state
    if (deliveryDate !== undefined) updateData.deliveryDate = new Date(deliveryDate)
    if (instructions !== undefined) updateData.instructions = instructions
    if (packingCharges !== undefined) updateData.packingCharges = packingCharges
    if (packingChargesGstRate !== undefined) updateData.packingChargesGstRate = packingChargesGstRate
    if (status !== undefined) {
      const newStatus = status as ProjectStatus

      // Document requirements for status transitions
      if (newStatus === "PRINTING" && existing.status === "APPROVED") {
        // Check if PO is uploaded
        const poExists = await prisma.fileUpload.findFirst({
          where: { projectId: id, type: "PO" }
        })
        if (!poExists) {
          return NextResponse.json({ error: "PO document required before moving to PRINTING status" }, { status: 400 })
        }

        // Send Production Started email to POC
        if (existing.poc?.email) {
          await sendProductionStartedEmail(existing.poc.email, {
            pocName: existing.poc.name,
            projectName: existing.name,
            piNumber: existing.piNumber || existing.projectId,
            productionStartDate: new Date().toLocaleDateString('en-IN'),
            appUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
          })
        }
      }

      if (newStatus === "DISPATCHED" && existing.status === "PRINTING") {
        // Check if dispatch record exists
        const dispatchExists = await prisma.dispatch.findFirst({
          where: { projectId: id }
        })
        if (!dispatchExists) {
          return NextResponse.json({ error: "Dispatch details required before moving to DISPATCHED status" }, { status: 400 })
        }

        // Send Shipment Dispatched email to POC
        if (existing.poc?.email && dispatchExists) {
          await sendShipmentDispatchedEmail(existing.poc.email, {
            pocName: existing.poc.name,
            projectName: existing.name,
            piNumber: existing.piNumber || existing.projectId,
            dispatchDate: new Date().toLocaleDateString('en-IN'),
            courier: (dispatchExists as any).courier || "Courier Partner",
            deliveryAddress: existing.location || "Multiple / Address",
            appUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
          })
        }
      }

      if (newStatus === "DELIVERED" && existing.status === "DISPATCHED") {
        const [challanExists, invoiceExists, dispatch] = await Promise.all([
          prisma.fileUpload.findFirst({ where: { projectId: id, type: "CHALLAN" } }),
          prisma.fileUpload.findFirst({ where: { projectId: id, type: "INVOICE" } }),
          prisma.dispatch.findUnique({ where: { projectId: id }, select: { id: true, podUrl: true } }),
        ])

        if (!challanExists || !invoiceExists || !dispatch?.podUrl) {
          return NextResponse.json({
            error: "Challan, Invoice and POD are required before moving to DELIVERED status",
          }, { status: 400 })
        }

        await prisma.dispatch.update({
          where: { id: dispatch.id },
          data: { actualDelivery: new Date(), status: "delivered" },
        })
      }

      updateData.status = newStatus
      updateData.statusHistory = {
        create: { status: newStatus, note: note || `Status updated to ${newStatus}`, changedById: session.user.id },
      }
    }

    // Update collaterals if provided
    if (collaterals !== undefined) {
      let priced: Awaited<ReturnType<typeof priceCollaterals>>
      try {
        priced = await priceCollaterals(collaterals)
      } catch (error) {
        return NextResponse.json({
          error: error instanceof Error ? error.message : "Invalid collateral pricing",
        }, { status: 400 })
      }
      await prisma.collateral.deleteMany({ where: { projectId: id } })
      updateData.collaterals = {
        create: priced.collaterals.map((c) => ({
          itemName: c.itemName,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          totalPrice: c.totalPrice,
          gstRate: c.gstRate,
          gstAmount: c.gstAmount,
        })),
      }
      // Calculate total cost including items GST and packing charges with their GST
      const itemsGst = priced.totalGst
      const packingSubtotal = packingCharges || 0
      const packingGst = packingSubtotal * ((packingChargesGstRate || 18) / 100)
      
      updateData.totalCost = priced.subtotal + packingSubtotal
      updateData.grandTotal = priced.subtotal + itemsGst + packingSubtotal + packingGst
    } else if (packingCharges !== undefined || packingChargesGstRate !== undefined) {
      // Only packing charges updated - recalculate total cost
      const existingCollaterals = await prisma.collateral.findMany({ where: { projectId: id } })
      const subtotal = existingCollaterals.reduce((sum, c) => sum + c.totalPrice, 0)
      const itemsGst = existingCollaterals.reduce((sum, c) => sum + c.gstAmount, 0)
      const packingSubtotal = packingCharges !== undefined ? packingCharges : (existing.packingCharges || 0)
      const packingRate = packingChargesGstRate !== undefined ? packingChargesGstRate : (existing.packingChargesGstRate || 18)
      const packingGst = packingSubtotal * (packingRate / 100)
      
      updateData.totalCost = subtotal + packingSubtotal
      updateData.grandTotal = subtotal + itemsGst + packingSubtotal + packingGst
    }

    // Update dispatch if provided
    if (dispatch && (dispatch.courier || dispatch.trackingId)) {
      const existingDispatch = await prisma.dispatch.findFirst({ where: { projectId: id } })
      if (existingDispatch) {
        await prisma.dispatch.update({
          where: { id: existingDispatch.id },
          data: {
            ...(dispatch.courier !== undefined ? { courier: dispatch.courier } : {}),
            ...(dispatch.trackingId !== undefined ? { trackingId: dispatch.trackingId || null } : {}),
          },
        })
      } else {
        await prisma.dispatch.create({
          data: {
            projectId: id,
            courier: dispatch.courier || "",
            trackingId: dispatch.trackingId || null,
            dispatchDate: new Date(),
          },
        })
      }
    }

    const project = await prisma.project.update({ where: { id }, data: updateData })
    await pusherServer.trigger(CHANNELS.PROJECTS, EVENTS.PROJECT_UPDATED, { id })
    await pusherServer.trigger(CHANNELS.DASHBOARD, EVENTS.STATS_UPDATED, {})
    return NextResponse.json(project)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to update project"
    return NextResponse.json({ error: "Failed to update project", details: errorMessage }, { status: 500 })
  }
}

// DELETE /api/projects/[id]
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    const existing = await prisma.project.findUnique({
      where: { id },
      select: {
        pocId: true,
        status: true,
        name: true,
        projectId: true,
        piPdfUrl: true,
        dispatch: { select: { podUrl: true } },
      }
    })
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const isAdmin = session.user.role === "ADMIN"
    const isClient = session.user.role === "CLIENT"

    // CLIENT cannot delete projects
    if (isClient) {
      return NextResponse.json({ error: "Clients cannot delete projects" }, { status: 403 })
    }

    // Admin can delete any project; POCs can delete their own projects.
    if (!isAdmin) {
      if (existing.pocId !== session.user.id) {
        return NextResponse.json({ error: "You can only delete your own projects" }, { status: 403 })
      }
    }

    // Get all files associated with this project to delete from Cloudinary
    const files = await prisma.fileUpload.findMany({
      where: { projectId: id },
    })

    // Delete generated PI, POD, and uploaded documents from Cloudinary.
    await deleteCloudinaryAsset(existing.piPdfUrl)
    await deleteCloudinaryAsset(existing.dispatch?.podUrl)

    for (const file of files) {
      await deleteCloudinaryAsset(file.url)
    }

    // Delete related activities
    await prisma.activity.deleteMany({
      where: { entityId: id },
    })

    // Delete related notifications
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { message: { contains: id } },
          { title: { contains: id } },
          ...(existing.projectId ? [
            { message: { contains: existing.projectId } },
            { title: { contains: existing.projectId } },
          ] : []),
        ],
      },
    })

    // Also check for projectIdStr pattern (PROJ-XXX)
    const projectDisplayId = existing.projectId || "";

    const deletedNotifications = await prisma.notification.deleteMany({
      where: {
        OR: [
          { message: { contains: id } },
          { title: { contains: id } },
          ...(projectDisplayId ? [
            { message: { contains: projectDisplayId } },
            { title: { contains: projectDisplayId } },
          ] : []),
        ],
      },
    });

    await prisma.project.delete({ where: { id } })

    // Create deletion notification for the POC (if POC still exists)
    if (existing.pocId) {
      await createNotification({
        userId: existing.pocId,
        title: "Project Deleted",
        message: `Project "${existing.name}" (${existing.projectId || id}) has been deleted by ${session.user.name || (isAdmin ? "Admin" : "POC")}`,
        type: "PROJECT_DELETED",
      })
    }

    await pusherServer.trigger(CHANNELS.PROJECTS, EVENTS.PROJECT_DELETED, { id })
    await pusherServer.trigger(CHANNELS.DASHBOARD, EVENTS.STATS_UPDATED, {})
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
