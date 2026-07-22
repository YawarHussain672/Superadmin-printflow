import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getPresignedUrl } from "@/lib/s3"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const project = await prisma.project.findUnique({
      where: { id },
      select: { pocId: true, clientId: true, paymentReceiptUrl: true, paymentReceiptFilename: true },
    })

    if (!project || !project.paymentReceiptUrl) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 })
    }

    const isAdmin = session.user.role === "ADMIN"
    const isOwner = project.pocId === session.user.id
    const isClient = project.clientId === session.user.id

    if (!isAdmin && !isOwner && !isClient) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const signedUrl = await getPresignedUrl(project.paymentReceiptUrl)
    const response = await fetch(signedUrl)
    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch receipt file" }, { status: 500 })
    }

    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()
    const contentType = response.headers.get("content-type") || "application/octet-stream"

    const safeFilename = (project.paymentReceiptFilename || "Payment_Receipt").replace(/[^a-zA-Z0-9.\-_]/g, "_")

    const headers = new Headers()
    headers.set("Content-Type", contentType)
    headers.set("Content-Disposition", `inline; filename="${safeFilename}"`)
    headers.set("Cache-Control", "public, max-age=3600")

    return new NextResponse(arrayBuffer, { headers })
  } catch (error) {
    console.error("Failed to serve payment receipt:", error)
    return NextResponse.json({ error: "Failed to serve receipt" }, { status: 500 })
  }
}
