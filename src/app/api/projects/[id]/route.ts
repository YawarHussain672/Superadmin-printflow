import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProjectStatus, Prisma } from "@prisma/client"
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher"
import { createNotification, notifyAdminPIPending } from "@/lib/notifications"
import { sendProductionStartedEmail, sendShipmentDispatchedEmail } from "@/lib/email"
import { formatCurrency } from "@/utils/formatters"
import { calculateTotal } from "@/lib/ratecard"
import { deleteFromS3, uploadToS3 } from "@/lib/s3"
import { generatePIPDF } from "@/lib/pi-generator"

function getS3KeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const urlParts = url.split(".amazonaws.com/")
    if (urlParts.length > 1) {
      return decodeURIComponent(urlParts[1])
    }
    return null
  } catch {
    return null
  }
}

async function deleteS3Asset(url: string | null | undefined) {
  const key = getS3KeyFromUrl(url)
  if (key) {
    try {
      await deleteFromS3(key)
    } catch (error) {
      console.error(`Failed to delete S3 asset with key ${key}:`, error)
    }
  }
}

async function priceCollaterals(
  projectId: string | undefined,
  collaterals: Array<{ itemName: string; quantity: number; unitPrice?: number; gstRate?: number; specification?: string | null }>,
  isAdmin: boolean = false
) {
  const priced = await Promise.all(collaterals.map(async (c) => {
    const rateCard = await prisma.rateCard.findFirst({
      where: { itemName: c.itemName, active: true },
      select: { gstRate: true },
    })
    const calc = await calculateTotal(c.itemName, c.quantity)
    let unitPrice: number
    let gstRate: number = c.gstRate ?? rateCard?.gstRate ?? calc?.gstRate ?? 18
    let totalPrice: number
    let gstAmount: number

    if (c.unitPrice !== undefined && typeof c.unitPrice === "number" && c.unitPrice >= 0) {
      unitPrice = c.unitPrice
      totalPrice = c.quantity * unitPrice
      gstAmount = totalPrice * (gstRate / 100)
    } else if (calc !== null) {
      unitPrice = calc.unitPrice
      gstRate = c.gstRate ?? calc.gstRate
      totalPrice = calc.subtotal
      gstAmount = totalPrice * (gstRate / 100)
    } else if (projectId) {
      // Fallback to existing collateral price on project update if rate card is missing
      const existingCollateral = await prisma.collateral.findFirst({
        where: {
          projectId,
          itemName: c.itemName,
        }
      })
      if (existingCollateral) {
        unitPrice = existingCollateral.unitPrice
        gstRate = c.gstRate ?? existingCollateral.gstRate ?? 18
        totalPrice = unitPrice * c.quantity
        gstAmount = totalPrice * (gstRate / 100)
      } else {
        throw new Error(`No active rate card price found for ${c.itemName} at quantity ${c.quantity}`)
      }
    } else {
      throw new Error(`No active rate card price found for ${c.itemName} at quantity ${c.quantity}`)
    }

    return {
      itemName: c.itemName,
      quantity: c.quantity,
      unitPrice,
      totalPrice,
      gstRate,
      gstAmount,
      specification: c.specification || null,
    }
  }))

  return {
    collaterals: priced,
    subtotal: priced.reduce((sum, c) => sum + c.totalPrice, 0),
    totalGst: priced.reduce((sum, c) => sum + c.gstAmount, 0),
  }
}

// GET /api/projects/[id]
import { signProjectUrls } from "@/lib/project-utils";

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
        tenantClient: { select: { id: true, companyName: true, companyLogoUrl: true } },
        collaterals: true,
        statusHistory: { orderBy: { timestamp: "desc" } },
        files: true,
        dispatch: true,
        approval: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Allow access if: admin, superadmin, POC assigned, or client assigned
    const isAuthorized = session.user.role === "SUPERADMIN" ||
      session.user.role === "ADMIN" ||
      project.pocId === session.user.id ||
      project.clientId === session.user.id
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const signedProject = await signProjectUrls(project as any);
    return NextResponse.json(signedProject);
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
    const { name, pocId, clientId, location, branch, state, deliveryDate, instructions, collaterals, status, note, dispatch, packingCharges, packingChargesGstRate, deliveryCharges, deliveryChargesGstRate, piRejectionNote, recipientName, recipientContact, recipientBranch } = body

    // clientId: "" means "remove client" - treat as null (client is optional)

    // Fetch existing project to check ownership and status
    const existing = await prisma.project.findUnique({
      where: { id },
      select: {
        pocId: true,
        clientId: true,
        status: true,
        piStatus: true,
        approval: { select: { status: true } },
        name: true,
        piNumber: true,
        projectId: true,
        location: true,
        branch: true,
        state: true,
        deliveryDate: true,
        instructions: true,
        packingCharges: true,
        packingChargesGstRate: true,
        deliveryCharges: true,
        deliveryChargesGstRate: true,
        piRejectionNote: true,
        recipientName: true,
        recipientContact: true,
        recipientBranch: true,
        poc: { select: { id: true, name: true, email: true } },
        collaterals: true,
      }
    })
    if (!existing) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const isAdmin = session.user.role === "ADMIN"
    const isClient = session.user.role === "CLIENT"
    const isOwner = existing.pocId === session.user.id
    const projectApprovedByAdmin = existing.approval?.status === "APPROVED" || !["REQUESTED", "CANCELLED"].includes(existing.status)
    const pocCanManageAfterApproval = isOwner && projectApprovedByAdmin
    const isStatusChange = status !== undefined && status.toUpperCase() !== existing.status.toUpperCase()
    const isDispatchUpdate = dispatch !== undefined
    const isProjectDetailsUpdate = [
      name,
      pocId,
      clientId,
      location,
      branch,
      state,
      deliveryDate,
      instructions,
      collaterals,
      packingCharges,
      packingChargesGstRate,
      deliveryCharges,
      deliveryChargesGstRate,
      piRejectionNote,
      recipientName,
      recipientContact,
      recipientBranch,
    ].some((value) => value !== undefined)

    // Check if any details affecting PI have changed (only if project already has a PI number)
    let detailsChanged = false
    if (existing.piNumber) {
      const nameChanged = name !== undefined && name !== existing.name
      const pocIdChanged = pocId !== undefined && pocId !== existing.pocId
      const clientIdChanged = clientId !== undefined && clientId !== existing.clientId
      const locationChanged = location !== undefined && location !== existing.location
      const branchChanged = branch !== undefined && branch !== existing.branch
      const stateChanged = state !== undefined && state !== existing.state
      
      const existingDateStr = existing.deliveryDate ? new Date(existing.deliveryDate).toISOString().split('T')[0] : ""
      let newDateStr = ""
      if (deliveryDate) {
        try {
          newDateStr = new Date(deliveryDate).toISOString().split('T')[0]
        } catch {}
      }
      const deliveryDateChanged = deliveryDate !== undefined && newDateStr !== existingDateStr

      const instructionsChanged = instructions !== undefined && instructions !== existing.instructions
      const packingChargesChanged = packingCharges !== undefined && packingCharges !== existing.packingCharges
      const packingChargesGstRateChanged = packingChargesGstRate !== undefined && packingChargesGstRate !== existing.packingChargesGstRate
      const deliveryChargesChanged = deliveryCharges !== undefined && deliveryCharges !== existing.deliveryCharges
      const deliveryChargesGstRateChanged = deliveryChargesGstRate !== undefined && deliveryChargesGstRate !== existing.deliveryChargesGstRate
      const recipientNameChanged = recipientName !== undefined && recipientName !== existing.recipientName
      const recipientContactChanged = recipientContact !== undefined && recipientContact !== existing.recipientContact
      const recipientBranchChanged = recipientBranch !== undefined && recipientBranch !== existing.recipientBranch

      let collateralsChanged = false
      if (collaterals !== undefined) {
        const origCols = existing.collaterals.map(c => ({ itemName: c.itemName, quantity: c.quantity, specification: c.specification || "" }))
        const newCols = collaterals.map((c: any) => ({ itemName: c.itemName, quantity: c.quantity, specification: c.specification || "" }))
        
        const sortCollateral = (a: { itemName: string; quantity: number }, b: { itemName: string; quantity: number }) =>
          a.itemName.localeCompare(b.itemName) || a.quantity - b.quantity

        origCols.sort(sortCollateral)
        newCols.sort(sortCollateral)

        collateralsChanged = origCols.length !== newCols.length ||
          origCols.some((item, idx) => item.itemName !== newCols[idx].itemName || item.quantity !== newCols[idx].quantity || item.specification !== newCols[idx].specification)
      }

      detailsChanged = nameChanged || pocIdChanged || clientIdChanged || locationChanged || branchChanged || stateChanged ||
        deliveryDateChanged || instructionsChanged || packingChargesChanged || packingChargesGstRateChanged ||
        deliveryChargesChanged || deliveryChargesGstRateChanged ||
        recipientNameChanged || recipientContactChanged || recipientBranchChanged || collateralsChanged
    }

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

    if ((isStatusChange || isDispatchUpdate) && !isAdmin && !isOwner) {
      return NextResponse.json({ error: "You can only update status or dispatch for your own projects" }, { status: 403 })
    }

    if ((isStatusChange || isDispatchUpdate) && !isAdmin && !pocCanManageAfterApproval) {
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
      const poc = await prisma.user.findUnique({ where: { id: pocId } })
      if (!poc) {
        return NextResponse.json({ error: "Invalid POC selected" }, { status: 400 })
      }
      updateData.poc = { connect: { id: pocId } }
      updateData.pocName = poc.name
    }
    if (clientId !== undefined) {
      if (clientId === "" || clientId === null) {
        updateData.client = { disconnect: true }
        updateData.clientName = null
      } else {
        const client = await prisma.user.findUnique({ where: { id: clientId } })
        if (!client) {
          return NextResponse.json({ error: "Invalid Client selected" }, { status: 400 })
        }
        updateData.client = { connect: { id: clientId } }
        updateData.clientName = client.name
      }
    }
    if (location !== undefined) updateData.location = location
    if (branch !== undefined) updateData.branch = branch
    if (state !== undefined) updateData.state = state
    if (deliveryDate !== undefined) updateData.deliveryDate = new Date(deliveryDate)
    if (instructions !== undefined) updateData.instructions = instructions
    if (packingCharges !== undefined) updateData.packingCharges = packingCharges
    if (packingChargesGstRate !== undefined) updateData.packingChargesGstRate = packingChargesGstRate
    if (deliveryCharges !== undefined) updateData.deliveryCharges = deliveryCharges
    if (deliveryChargesGstRate !== undefined) updateData.deliveryChargesGstRate = deliveryChargesGstRate
    if (piRejectionNote !== undefined) updateData.piRejectionNote = piRejectionNote === "" ? null : piRejectionNote
    if (recipientName !== undefined) updateData.recipientName = recipientName === "" ? null : recipientName
    if (recipientContact !== undefined) updateData.recipientContact = recipientContact === "" ? null : recipientContact
    if (recipientBranch !== undefined) updateData.recipientBranch = recipientBranch === "" ? null : recipientBranch
    if (status !== undefined) {
      const newStatus = status as ProjectStatus

      // Only perform validation if status is actually changing
      if (newStatus !== existing.status) {
        // Document requirements for status transitions
        if (newStatus === "PRINTING") {
          if (existing.status !== "APPROVED") {
            return NextResponse.json({ error: "Project must be APPROVED before moving to PRINTING status" }, { status: 400 })
          }

          // Send Production Started email to POC
          if (existing.poc?.email) {
            try {
              await sendProductionStartedEmail(existing.poc.email, {
                pocName: existing.poc.name,
                projectName: existing.name,
                piNumber: existing.piNumber || existing.projectId,
                productionStartDate: new Date().toLocaleDateString('en-IN'),
                appUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
                projectId: id,
              })
            } catch (emailError) {
              console.error("[EMAIL ERROR] Failed to send production started email:", emailError)
            }
          }
        }

        if (newStatus === "DISPATCHED") {
          if (existing.status !== "PRINTING") {
            return NextResponse.json({ error: "Project must be in PRINTING status before moving to DISPATCHED status" }, { status: 400 })
          }

          // Check if dispatch record exists
          const dispatchExists = await prisma.dispatch.findFirst({
            where: { projectId: id }
          })
          if (!dispatchExists) {
            return NextResponse.json({ error: "Dispatch details required before moving to DISPATCHED status" }, { status: 400 })
          }

          // Send Shipment Dispatched email to POC
          if (existing.poc?.email && dispatchExists) {
            try {
              await sendShipmentDispatchedEmail(existing.poc.email, {
                pocName: existing.poc.name,
                projectName: existing.name,
                piNumber: existing.piNumber || existing.projectId,
                dispatchDate: new Date().toLocaleDateString('en-IN'),
                courier: (dispatchExists as any).courier || "Courier Partner",
                deliveryAddress: existing.location || "Multiple / Address",
                appUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
                projectId: id,
              })
            } catch (emailError) {
              console.error("[EMAIL ERROR] Failed to send shipment dispatched email:", emailError)
            }
          }
        }

        if (newStatus === "DELIVERED") {
          if (existing.status !== "DISPATCHED") {
            return NextResponse.json({ error: "Project must be in DISPATCHED status before moving to DELIVERED status" }, { status: 400 })
          }

          const dispatch = await prisma.dispatch.findUnique({ where: { projectId: id }, select: { id: true } })
          if (dispatch?.id) {
            await prisma.dispatch.update({
              where: { id: dispatch.id },
              data: { actualDelivery: new Date(), status: "delivered" },
            })
          }
        }
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
        priced = await priceCollaterals(id, collaterals, isAdmin)
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
          specification: c.specification,
        })),
      }
      // Calculate total cost including items GST, packing charges, and delivery charges with their GST
      const itemsGst = priced.totalGst
      const packingSubtotal = packingCharges !== undefined ? packingCharges : (existing.packingCharges || 0)
      const packingRate = packingChargesGstRate !== undefined ? packingChargesGstRate : (existing.packingChargesGstRate ?? 18)
      const packingGst = packingSubtotal * (packingRate / 100)
      
      const deliverySubtotal = deliveryCharges !== undefined ? deliveryCharges : (existing.deliveryCharges || 0)
      const deliveryRate = deliveryChargesGstRate !== undefined ? deliveryChargesGstRate : (existing.deliveryChargesGstRate ?? 18)
      const deliveryGst = deliverySubtotal * (deliveryRate / 100)

      updateData.totalCost = priced.subtotal + packingSubtotal + deliverySubtotal
      updateData.grandTotal = priced.subtotal + itemsGst + packingSubtotal + packingGst + deliverySubtotal + deliveryGst
    } else if (
      packingCharges !== undefined ||
      packingChargesGstRate !== undefined ||
      deliveryCharges !== undefined ||
      deliveryChargesGstRate !== undefined
    ) {
      // Only packing/delivery charges updated - recalculate total cost
      const existingCollaterals = await prisma.collateral.findMany({ where: { projectId: id } })
      const subtotal = existingCollaterals.reduce((sum, c) => sum + c.totalPrice, 0)
      const itemsGst = existingCollaterals.reduce((sum, c) => sum + c.gstAmount, 0)
      
      const packingSubtotal = packingCharges !== undefined ? packingCharges : (existing.packingCharges || 0)
      const packingRate = packingChargesGstRate !== undefined ? packingChargesGstRate : (existing.packingChargesGstRate ?? 18)
      const packingGst = packingSubtotal * (packingRate / 100)
      
      const deliverySubtotal = deliveryCharges !== undefined ? deliveryCharges : (existing.deliveryCharges || 0)
      const deliveryRate = deliveryChargesGstRate !== undefined ? deliveryChargesGstRate : (existing.deliveryChargesGstRate ?? 18)
      const deliveryGst = deliverySubtotal * (deliveryRate / 100)

      updateData.totalCost = subtotal + packingSubtotal + deliverySubtotal
      updateData.grandTotal = subtotal + itemsGst + packingSubtotal + packingGst + deliverySubtotal + deliveryGst
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

    // Auto-regenerate PI if details changed and PI was already generated
    if (existing.piNumber && detailsChanged) {
      try {
        const freshProject = await prisma.project.findUnique({
          where: { id },
          include: {
            collaterals: true,
            poc: {
              select: { name: true, email: true, location: true },
            },
            client: {
              select: { name: true, email: true, location: true, phone: true, clientPan: true, clientGst: true },
            },
          },
        })

        if (freshProject) {
          const generatedAt = new Date()
          const pdfBuffer = await generatePIPDF({
            projectId: freshProject.projectId,
            name: freshProject.name,
            piNumber: freshProject.piNumber!,
            location: freshProject.location,
            state: freshProject.state,
            totalCost: freshProject.totalCost,
            packingCharges: freshProject.packingCharges,
            packingChargesGstRate: freshProject.packingChargesGstRate,
            deliveryCharges: freshProject.deliveryCharges,
            deliveryChargesGstRate: freshProject.deliveryChargesGstRate,
            pocName: freshProject.poc?.name || freshProject.pocName || undefined,
            pocEmail: freshProject.poc?.email || undefined,
            clientName: freshProject.client?.name || freshProject.clientName || undefined,
            clientEmail: freshProject.client?.email || undefined,
            clientLocation: freshProject.client?.location || undefined,
            clientPan: freshProject.client?.clientPan || undefined,
            clientGst: freshProject.client?.clientGst || undefined,
            deliveryAddress: `${freshProject.location}${freshProject.state ? `, ${freshProject.state}` : ""}`,
            recipientName: freshProject.recipientName,
            recipientContact: freshProject.recipientContact,
            recipientBranch: freshProject.recipientBranch,
            collaterals: freshProject.collaterals,
            generatedAt: generatedAt,
            clientId: freshProject.tenantClientId,
          })

          const s3Path = `projects/${id}/pi/${freshProject.piNumber}.pdf`
          const s3Url = await uploadToS3(pdfBuffer, s3Path, "application/pdf")

          // Update project with PI details and reset verification status
          const finalProject = await prisma.project.update({
            where: { id },
            data: {
              piStatus: "PENDING",
              piPdfUrl: s3Url,
              piGeneratedAt: generatedAt,
            },
          })

          // Cleanup previous PI if it exists and is different
          if (freshProject.piPdfUrl && freshProject.piPdfUrl !== s3Url) {
            await deleteS3Asset(freshProject.piPdfUrl)
          }

          await notifyAdminPIPending(
            freshProject.id,
            freshProject.name,
            freshProject.piNumber!,
            freshProject.poc?.name || freshProject.pocName || "Unknown"
          )

          await pusherServer.trigger(CHANNELS.PROJECTS, EVENTS.PROJECT_UPDATED, { id })
          await pusherServer.trigger(CHANNELS.DASHBOARD, EVENTS.STATS_UPDATED, {})
          return NextResponse.json(finalProject)
        }
      } catch (piError) {
        console.error("Auto PI regeneration failed:", piError)
      }
    }

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

    // Get all files associated with this project to delete from S3
    const files = await prisma.fileUpload.findMany({
      where: { projectId: id },
    })

    // Delete generated PI, POD, and uploaded documents from S3.
    await deleteS3Asset(existing.piPdfUrl)
    await deleteS3Asset(existing.dispatch?.podUrl)

    for (const file of files) {
      await deleteS3Asset(file.url)
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
