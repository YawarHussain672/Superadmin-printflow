import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadToS3 } from "@/lib/s3"
import { logActivity } from "@/lib/audit"
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher"

// POST /api/dispatch/[id]/pod — upload Proof of Delivery
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: "Only PDF and images are allowed for POD" }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File must be under 10MB" }, { status: 400 })
    }

    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      select: { id: true, projectId: true, project: { select: { pocId: true, status: true, piStatus: true } } },
    })
    if (!dispatch) return NextResponse.json({ error: "Dispatch not found" }, { status: 404 })

    const isAdmin = session.user.role === "ADMIN"
    const isOwner = dispatch.project.pocId === session.user.id
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "You can only upload POD for your own projects" }, { status: 403 })
    }
    if (!isAdmin && dispatch.project.piStatus !== "VERIFIED") {
      return NextResponse.json({ error: "POCs can upload POD only after admin approves the project and verifies the PI" }, { status: 403 })
    }

    // Upload to S3
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const key = `axis-print/${dispatch.projectId}/pod/pod_${Date.now()}_${file.name.replace(/\s+/g, "_")}`
    const s3Url = await uploadToS3(buffer, key, file.type)

    // Save POD URL to dispatch
    await prisma.dispatch.update({
      where: { id },
      data: { podUrl: s3Url },
    })

    await logActivity({
      userId: session.user.id,
      action: "POD_UPLOADED",
      entityType: "dispatch",
      entityId: id,
      details: { url: s3Url },
    })

    await pusherServer.trigger(CHANNELS.DISPATCH, EVENTS.DISPATCH_UPDATED, { id })
    await pusherServer.trigger(CHANNELS.PROJECTS, EVENTS.PROJECT_UPDATED, { projectId: dispatch.projectId })

    return NextResponse.json({ url: s3Url })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
