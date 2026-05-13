import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generatePIPDF } from "@/lib/pi-generator"
import { notifyAdminPIPending } from "@/lib/notifications"
import { v2 as cloudinary } from "cloudinary"

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

function getCloudinaryPublicIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split("/").filter(Boolean)
    const uploadIndex = parts.indexOf("upload")
    if (uploadIndex === -1) return null

    const publicPathParts = parts.slice(uploadIndex + 1)
    if (publicPathParts[0]?.match(/^v\d+$/)) {
      publicPathParts.shift()
    }

    return decodeURIComponent(publicPathParts.join("/"))
  } catch {
    return null
  }
}

async function deleteCloudinaryRawAsset(url: string | null | undefined) {
  if (!url) return

  const publicId = getCloudinaryPublicIdFromUrl(url)
  if (!publicId) return

  const publicIdWithoutExtension = publicId.replace(/\.[^/.]+$/, "")
  for (const attempt of [publicId, publicIdWithoutExtension]) {
    try {
      const result = await cloudinary.uploader.destroy(attempt, { resource_type: "raw" })
      if (result.result === "ok") return
    } catch {
      // Try the next public ID shape.
    }
  }
}

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
          select: { name: true, email: true, location: true, phone: true },
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
      clientPan: project.client?.phone, // TODO: Add clientPan field to User model
      clientGst: "", // TODO: Add clientGst field to User model
      deliveryAddress: `${project.location}${project.state ? `, ${project.state}` : ""}`,
      collaterals: project.collaterals,
      generatedAt: generatedAt,
    })

    // Upload to Cloudinary
    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: `axis-management/projects/${id}/pi`,
          public_id: `${piNumber}`,
          format: "pdf",
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error("Upload failed"))
          } else {
            resolve(result as { secure_url: string })
          }
        }
      ).end(pdfBuffer)
    })

    // Update project with PI details
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        piNumber: piNumber,
        piStatus: "PENDING",
        piPdfUrl: uploadResult.secure_url,
        piGeneratedAt: generatedAt,
      },
    })

    // Send admin notification (PI pending verification) — no email to POC at this stage
    if (previousPiPdfUrl && previousPiPdfUrl !== uploadResult.secure_url) {
      await deleteCloudinaryRawAsset(previousPiPdfUrl)
    }

    await notifyAdminPIPending(
      project.id,
      project.name,
      piNumber,
      project.poc?.name || "Unknown"
    )

    return NextResponse.json({
      success: true,
      project: {
        piNumber: piNumber,
        piStatus: "PENDING",
        piPdfUrl: uploadResult.secure_url,
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
