import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/files/[id]/view - Proxy file from Cloudinary for viewing/downloading
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
    const { searchParams } = new URL(request.url)
    const download = searchParams.get("download") === "true"

    // Get file record
    const fileRecord = await prisma.fileUpload.findUnique({
      where: { id },
      include: { project: { select: { pocId: true } } },
    })

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // Check permissions
    const isAdmin = session.user.role === "ADMIN"
    const isOwner = fileRecord.project.pocId === session.user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch file from Cloudinary using original URL
    const response = await fetch(fileRecord.url)
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch file from Cloudinary", details: `Status: ${response.status}`, url: fileRecord.url }, { status: 500 })
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    // Determine content type
    const contentType = response.headers.get("content-type") || "application/octet-stream"

    // Create headers
    const headers = new Headers()
    headers.set("Content-Type", contentType)

    if (download) {
      // Force download with safe filename
      const safeFilename = fileRecord.filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")
      headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`)
    } else {
      // Inline display (for viewing in browser) with safe filename
      const safeFilename = fileRecord.filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")
      headers.set("Content-Disposition", `inline; filename="${safeFilename}"`)
    }

    // Add cache headers
    headers.set("Cache-Control", "public, max-age=3600")

    return new NextResponse(arrayBuffer, { headers })
  } catch (error) {
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 })
  }
}
