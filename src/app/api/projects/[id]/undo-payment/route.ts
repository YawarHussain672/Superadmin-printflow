import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/audit"
import { deleteFromS3, getS3KeyFromUrl } from "@/lib/s3"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const project = await prisma.project.findUnique({
      where: { id },
      include: { poc: true }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const isAdmin = session.user.role === "ADMIN"
    const isPoc = session.user.role === "POC" && project.pocId === session.user.id

    if (!isAdmin && !isPoc) {
      return NextResponse.json({ error: "Permission denied. Only Admins or assigned POCs can undo payment capture." }, { status: 403 })
    }

    if (!project.paymentCaptured) {
      return NextResponse.json({ error: "Payment is not currently captured for this project" }, { status: 400 })
    }

    // Delete payment receipt file from S3 if exists
    if (project.paymentReceiptUrl) {
      try {
        const key = getS3KeyFromUrl(project.paymentReceiptUrl)
        if (key) {
          await deleteFromS3(key)
        }
      } catch (err) {
        console.error("Failed to delete payment receipt from S3:", err)
      }
    }

    // Reset payment fields in DB
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        paymentCaptured: false,
        paymentCapturedAt: null,
        paymentTxnId: null,
        paymentNotes: null,
        paymentCapturedBy: null,
        paymentReceiptUrl: null,
        paymentReceiptFilename: null,
      },
    })

    // Log activity for audit trail
    await logActivity({
      userId: session.user.id,
      action: "PAYMENT_UNDO",
      entityType: "project",
      entityId: id,
      details: {
        previousTxnId: project.paymentTxnId,
        undoneBy: session.user.name || session.user.email,
        projectName: project.name,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Payment capture undone successfully",
      project: updatedProject,
    })
  } catch (error) {
    console.error("Failed to undo payment capture:", error)
    return NextResponse.json({ error: "Failed to undo payment capture" }, { status: 500 })
  }
}
