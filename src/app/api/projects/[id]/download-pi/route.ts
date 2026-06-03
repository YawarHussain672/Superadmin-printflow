import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPresignedUrl } from "@/lib/s3"

// GET /api/projects/[id]/download-pi?inline=true (view) or without (download)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const inline = request.nextUrl.searchParams.get("inline") === "true"

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        piPdfUrl: true,
        piNumber: true,
        pocId: true,
        clientId: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Only POC, CLIENT (own project), ADMIN, or SUPERADMIN can download
    const isAuthorized =
      session.user.role === "ADMIN" ||
      session.user.role === "SUPERADMIN" ||
      session.user.id === project.pocId ||
      session.user.id === project.clientId

    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!project.piPdfUrl) {
      return NextResponse.json({ error: "PI not generated yet" }, { status: 404 })
    }

    // Get a fresh presigned URL and fetch the file server-side (no CORS issues)
    const presignedUrl = await getPresignedUrl(project.piPdfUrl)
    const s3Response = await fetch(presignedUrl)

    if (!s3Response.ok) {
      return NextResponse.json({ error: "Failed to fetch PI from storage" }, { status: 502 })
    }

    const filename = `${project.piNumber || "PI"}.pdf`
    const disposition = inline
      ? `inline; filename="${filename}"`
      : `attachment; filename="${filename}"`

    return new NextResponse(s3Response.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("PI download error:", error)
    return NextResponse.json({ error: "Failed to download PI" }, { status: 500 })
  }
}
