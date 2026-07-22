import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/audit"
import { uploadToS3 } from "@/lib/s3"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const contentType = request.headers.get("content-type") || ""

    let transactionId: string | null = null
    let notes: string | null = null
    let file: File | null = null

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      transactionId = (formData.get("transactionId") as string) || null
      notes = (formData.get("notes") as string) || null
      file = (formData.get("file") as File) || null
    } else {
      const body = await request.json().catch(() => ({}))
      transactionId = body.transactionId || null
      notes = body.notes || null
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: { poc: true, client: true }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const isAdmin = session.user.role === "ADMIN"
    const isPoc = session.user.role === "POC" && project.pocId === session.user.id

    if (!isAdmin && !isPoc) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 })
    }

    let receiptUrl: string | null = null
    let receiptFilename: string | null = null

    if (file && file.size > 0 && typeof file.arrayBuffer === "function") {
      const buffer = await file.arrayBuffer()
      const timestamp = Date.now()
      const safeFilename = file.name.replace(/\s+/g, "_")
      const key = `axis-print/${id}/payment_receipt/${timestamp}-${safeFilename}`
      receiptUrl = await uploadToS3(buffer, key, file.type)
      receiptFilename = file.name
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        paymentCaptured: true,
        paymentCapturedAt: new Date(),
        paymentTxnId: transactionId ? String(transactionId).trim() : null,
        paymentNotes: notes ? String(notes).trim() : null,
        paymentCapturedBy: session.user.id,
        ...(receiptUrl ? { paymentReceiptUrl: receiptUrl, paymentReceiptFilename: receiptFilename } : {}),
      },
    })

    await logActivity({
      userId: session.user.id,
      action: "PAYMENT_CAPTURED",
      entityType: "project",
      entityId: id,
      details: {
        transactionId: updatedProject.paymentTxnId,
        grandTotal: updatedProject.grandTotal || updatedProject.totalCost * 1.18,
        capturedBy: session.user.name || session.user.email,
        hasReceipt: !!receiptUrl,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Payment captured successfully",
      project: updatedProject,
    })
  } catch (error) {
    console.error("Failed to capture payment:", error)
    return NextResponse.json({ error: "Failed to capture payment" }, { status: 500 })
  }
}
