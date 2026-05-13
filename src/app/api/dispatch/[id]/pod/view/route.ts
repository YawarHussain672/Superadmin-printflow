import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/dispatch/[id]/pod/view - Proxy POD file from Cloudinary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Get dispatch with POD
    const dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: { project: { select: { pocId: true } } },
    })

    if (!dispatch || !dispatch.podUrl) {
      return NextResponse.json({ error: "POD not found" }, { status: 404 })
    }

    // Check permissions
    const isAdmin = session.user.role === "ADMIN"
    const isOwner = dispatch.project.pocId === session.user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch file from Cloudinary using original URL
    const response = await fetch(dispatch.podUrl)
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch POD from Cloudinary", details: `Status: ${response.status}`, url: dispatch.podUrl }, { status: 500 })
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    // Determine content type
    const contentType = response.headers.get("content-type") || "application/octet-stream"

    // Create headers for inline viewing
    const headers = new Headers()
    headers.set("Content-Type", contentType)
    headers.set("Content-Length", arrayBuffer.byteLength.toString())
    headers.set("Content-Disposition", `inline; filename="pod_${dispatch.id}.pdf"`)
    headers.set("Cache-Control", "public, max-age=3600")

    return new NextResponse(arrayBuffer, { headers })
  } catch (error) {
    return NextResponse.json({ error: "Failed to serve POD" }, { status: 500 })
  }
}
