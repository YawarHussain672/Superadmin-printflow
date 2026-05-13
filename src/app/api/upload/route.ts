import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { FileType } from "@prisma/client"
import { v2 as cloudinary } from "cloudinary"
import { logActivity } from "@/lib/audit"
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher"

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// POST /api/upload
// Body: FormData with fields: file (File), projectId (string), fileType (PO | CHALLAN | INVOICE)
export async function POST(request: NextRequest) {
  try {

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const projectId = formData.get("projectId") as string | null
    const fileType = formData.get("fileType") as string | null

    if (!file || !projectId || !fileType) {
      return NextResponse.json({ error: "file, projectId and fileType are required" }, { status: 400 })
    }

    if (!["PO", "CHALLAN", "INVOICE"].includes(fileType)) {
      return NextResponse.json({ error: "Invalid fileType" }, { status: 400 })
    }

    // Verify project exists and check access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { pocId: true, status: true, piStatus: true, approval: { select: { status: true } } },
    })
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const isAdmin = session.user.role === "ADMIN"
    const isOwner = project.pocId === session.user.id
    const projectApprovedByAdmin = project.approval?.status === "APPROVED" || !["REQUESTED", "CANCELLED"].includes(project.status)
    const pocCanUpload = isOwner && projectApprovedByAdmin && project.piStatus === "VERIFIED"

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "You can only upload files to your own projects" }, { status: 403 })
    }
    if (!isAdmin && !pocCanUpload) {
      return NextResponse.json({ error: "POCs can upload documents only after admin approves the project and verifies the PI" }, { status: 403 })
    }

    if (fileType === "PO" && !["APPROVED", "PRINTING", "DISPATCHED", "DELIVERED"].includes(project.status)) {
      return NextResponse.json({ error: "PO can only be uploaded after project approval" }, { status: 400 })
    }
    if (fileType === "CHALLAN" && !["DISPATCHED", "DELIVERED"].includes(project.status)) {
      return NextResponse.json({ error: "Challan can only be uploaded after dispatch" }, { status: 400 })
    }
    if (fileType === "INVOICE" && !["DISPATCHED", "DELIVERED"].includes(project.status)) {
      return NextResponse.json({ error: "Invoice can only be uploaded after dispatch" }, { status: 400 })
    }

    // Convert file to base64 for Cloudinary upload

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`

    // Upload to Cloudinary with public access
    const uploadResult = await cloudinary.uploader.upload(base64, {
      folder: `axis-print/${projectId}/${fileType.toLowerCase()}`,
      resource_type: "auto",
      public_id: `${fileType.toLowerCase()}_${Date.now()}`,
      type: "upload",
      access_mode: "public",
    })

    // Save to database
    const fileRecord = await prisma.fileUpload.create({
      data: {
        projectId,
        type: fileType as FileType,
        url: uploadResult.secure_url,
        filename: file.name,
        size: file.size,
        uploadedById: session.user.id,
      },
    })

    await logActivity({
      userId: session.user.id,
      action: `${fileType}_UPLOADED`,
      entityType: "project",
      entityId: projectId,
      details: { filename: file.name, size: file.size },
    })

    await pusherServer.trigger(CHANNELS.PROJECTS, EVENTS.PROJECT_UPDATED, { id: projectId })
    await pusherServer.trigger(CHANNELS.DASHBOARD, EVENTS.STATS_UPDATED, {})

    return NextResponse.json({
      id: fileRecord.id,
      url: uploadResult.secure_url,
      filename: file.name,
      size: file.size,
    }, { status: 201 })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
