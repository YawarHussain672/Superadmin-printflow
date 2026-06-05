import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPresignedUrl } from "@/lib/s3"

// GET /api/dispatch/[id]/pod/view - Securely proxy POD file from private S3
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
    const isSuperAdmin = session.user.role === "SUPERADMIN"
    const isOwner = dispatch.project.pocId === session.user.id

    if (!isAdmin && !isSuperAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Generate a presigned URL, then fetch the file server-side to avoid CORS issues
    const presignedUrl = await getPresignedUrl(dispatch.podUrl, 300)
    const s3Response = await fetch(presignedUrl)

    if (!s3Response.ok) {
      console.error("S3 fetch failed:", s3Response.status, dispatch.podUrl)
      return NextResponse.json(
        { error: "Failed to fetch POD from storage", details: `Status: ${s3Response.status}` },
        { status: 502 }
      )
    }

    // Determine file extension from URL for filename
    const urlPath = new URL(dispatch.podUrl).pathname
    const ext = urlPath.split(".").pop()?.toLowerCase() || "pdf"
    const contentType = s3Response.headers.get("content-type") || "application/octet-stream"

    return new NextResponse(s3Response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="POD_${dispatch.id}.${ext}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Error serving POD:", error)
    return NextResponse.json({ error: "Failed to serve POD" }, { status: 500 })
  }
}
