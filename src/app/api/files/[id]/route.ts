import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/audit"
import { v2 as cloudinary } from "cloudinary"

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

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

    // Delete from Cloudinary
    try {
      const publicId = fileRecord.url.split("/").slice(-1)[0].split(".")[0]
      if (publicId) {
        await cloudinary.uploader.destroy(`axis-print/${fileRecord.projectId}/${fileRecord.type.toLowerCase()}/${publicId}`)
      }
    } catch (cloudinaryError) {
      // Continue to delete from database even if Cloudinary fails
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
