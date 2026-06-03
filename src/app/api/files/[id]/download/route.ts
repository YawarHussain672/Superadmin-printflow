import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPresignedUrl } from "@/lib/s3"

// GET /api/files/[id]/download - Proxy download from S3
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

    // Get file record
    const fileRecord = await prisma.fileUpload.findUnique({
      where: { id },
      include: { project: { select: { pocId: true, clientId: true } } },
    })

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // Check permissions - Admin, SuperAdmin, POC owner, or Client assigned to project
    const isAdmin = session.user.role === "ADMIN" || session.user.role === "SUPERADMIN"
    const isOwner = fileRecord.project?.pocId === session.user.id
    const isAssignedClient = fileRecord.project?.clientId === session.user.id

    if (!isAdmin && !isOwner && !isAssignedClient) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Sign the raw S3 URL so the private bucket allows access
    const signedUrl = await getPresignedUrl(fileRecord.url)
    const response = await fetch(signedUrl)
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch file from S3", details: `Status: ${response.status}`, url: fileRecord.url }, { status: 500 })
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    // Determine content type
    const contentType = response.headers.get("content-type") || "application/octet-stream"

    // Create headers for download
    const headers = new Headers()
    headers.set("Content-Type", contentType)
    // Use simple filename encoding to avoid browser compatibility issues
    const safeFilename = fileRecord.filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")
    headers.set("Content-Disposition", `attachment; filename="${safeFilename}"`)
    headers.set("Cache-Control", "public, max-age=3600")

    return new NextResponse(arrayBuffer, { headers })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: "Failed to download file", details: errorMessage }, { status: 500 })
  }
}
