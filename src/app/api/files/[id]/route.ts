import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/audit"
import { deleteFromS3 } from "@/lib/s3"

// DELETE /api/files/[id] - Delete a file
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Get file record
    const fileRecord = await prisma.fileUpload.findUnique({
      where: { id },
      include: { project: true },
    })

    if (!fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    // Check permissions
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can delete project documents" }, { status: 403 })
    }

    // Delete from S3
    try {
      // Extract key from URL
      // URL format: https://bucket.s3.region.amazonaws.com/key
      const urlParts = fileRecord.url.split(".amazonaws.com/")
      if (urlParts.length > 1) {
        const key = decodeURIComponent(urlParts[1])
        await deleteFromS3(key)
      }
    } catch (s3Error) {
      console.error("S3 deletion failed:", s3Error)
    }

    // Delete from database
    await prisma.fileUpload.delete({
      where: { id },
    })

    await logActivity({
      userId: session.user.id,
      action: "FILE_DELETED",
      entityType: "project",
      entityId: fileRecord.projectId,
      details: { filename: fileRecord.filename, type: fileRecord.type },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 })
  }
}
