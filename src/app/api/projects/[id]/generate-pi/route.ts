import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generatePIPDF } from "@/lib/pi-generator"
import { notifyAdminPIPending } from "@/lib/notifications"
import { uploadToS3, deleteFromS3 as deleteS3Asset, getPresignedUrl } from "@/lib/s3"

// Generate unique PI number
async function generatePINumber(): Promise<string> {
  const year = new Date().getFullYear()

  // Find the last PI number for this year
  const lastProject = await prisma.project.findFirst({
    where: {
      piNumber: {
        startsWith: `PI-${year}`,
      },
    },
    orderBy: {
      piGeneratedAt: "desc",
    },
  })

  let sequence = 1000
  if (lastProject?.piNumber) {
    const parts = lastProject.piNumber.split("-")
    const lastSeq = parseInt(parts[2])
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1
    }
  }

  return `PI-${year}-${sequence}`
}

// POST /api/projects/[id]/generate-pi
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Fetch project with all details
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        collaterals: true,
        poc: {
          select: { name: true, email: true, location: true },
        },
        client: {
          select: { name: true, email: true, location: true, phone: true, clientPan: true, clientGst: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Only POC, CLIENT (own project), or ADMIN can generate PI
    const isAuthorized =
      session.user.role === "ADMIN" ||
      session.user.id === project.pocId ||
      session.user.id === project.clientId

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Generate new PI number
    const previousPiPdfUrl = project.piPdfUrl
    const piNumber = await generatePINumber()
    const generatedAt = new Date()

    // Generate PDF
    const pdfBuffer = await generatePIPDF({
      projectId: project.projectId,
      name: project.name,
      piNumber: piNumber,
      location: project.location,
      state: project.state,
      totalCost: project.totalCost,
      packingCharges: project.packingCharges,
      packingChargesGstRate: project.packingChargesGstRate,
      pocName: project.poc?.name,
      pocEmail: project.poc?.email,
      clientName: project.client?.name,
      clientEmail: project.client?.email,
      clientLocation: project.client?.location,
      clientPan: project.client?.clientPan,
      clientGst: project.client?.clientGst,
      deliveryAddress: `${project.location}${project.state ? `, ${project.state}` : ""}`,
      recipientName: project.recipientName,
      recipientContact: project.recipientContact,
      recipientBranch: project.recipientBranch,
      collaterals: project.collaterals,
      generatedAt: generatedAt,
    })

    // Upload to S3
    const s3Path = `projects/${id}/pi/${piNumber}.pdf`
    const s3Url = await uploadToS3(pdfBuffer, s3Path, "application/pdf")

    // Update project with PI details
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        piNumber: piNumber,
        piStatus: "PENDING",
        piPdfUrl: s3Url,
        piGeneratedAt: generatedAt,
      },
    })

    // Cleanup previous PI if it exists
    if (previousPiPdfUrl && previousPiPdfUrl !== s3Url) {
      await deleteS3Asset(previousPiPdfUrl)
    }

    await notifyAdminPIPending(
      project.id,
      project.name,
      piNumber,
      project.poc?.name || "Unknown"
    )

    // Sign the URL so the client can view/download from the private bucket
    const signedPiPdfUrl = await getPresignedUrl(s3Url)

    return NextResponse.json({
      success: true,
      project: {
        piNumber: piNumber,
        piStatus: "PENDING",
        piPdfUrl: signedPiPdfUrl,
        piGeneratedAt: generatedAt,
      },
      message: "PI generated successfully. Pending admin verification.",
    })
  } catch (error) {
    console.error("PI Generation error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to generate PI"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
