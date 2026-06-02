import { NextRequest, NextResponse, after } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyPOCPIVerified, notifyPOCPIRejected } from "@/lib/notifications"
import { sendPIGeneratedEmail } from "@/lib/email"
import { formatCurrency } from "@/utils/formatters"
import { deleteFromS3 } from "@/lib/s3"

// POST /api/projects/[id]/verify-pi
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { action, notes } = await request.json()

    if (!action || !["verify", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    // Fetch project to get PI details
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        poc: { select: { id: true, name: true, email: true } },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (!project.piNumber || project.piStatus !== "PENDING") {
      return NextResponse.json(
        { error: "No pending PI to verify/reject" },
        { status: 400 }
      )
    }

    // Store PI number for activity log before potentially clearing it
    const piNumberForLog = project.piNumber

    // If rejected, delete from S3
    if (action === "reject" && project.piPdfUrl) {
      try {
        const urlParts = project.piPdfUrl.split(".amazonaws.com/")
        if (urlParts.length > 1) {
          const key = decodeURIComponent(urlParts[1])
          await deleteFromS3(key)
        }
      } catch (s3Error) {
        console.error("S3 deletion failed:", s3Error)
      }
    }

    // Update project
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        piStatus: action === "verify" ? "VERIFIED" : "REJECTED",
        piVerifiedBy: session.user.id,
        piVerifiedAt: new Date(),
        // Clear PI details if rejected
        ...(action === "reject" && {
          piPdfUrl: null,
          piNumber: null,
          piGeneratedAt: null,
        }),
      },
    })

    // Log activity
    await prisma.activity.create({
      data: {
        userId: session.user.id,
        action: action === "verify" ? "VERIFY_PI" : "REJECT_PI",
        entityType: "PROJECT",
        entityId: id,
        details: {
          piNumber: piNumberForLog,
          status: updatedProject.piStatus,
          notes: notes || undefined,
        },
      },
    })

    // Notifications + email (async after response)
    after(async () => {
      try {
        if (action === "verify") {
          // Send PI Generated email to POC now that it's verified
          if (project.poc?.email) {
            await sendPIGeneratedEmail(project.poc.email, {
              pocName: project.poc.name,
              projectName: project.name,
              piNumber: piNumberForLog,
              piDate: new Date().toLocaleDateString("en-IN"),
              piAmount: formatCurrency(project.grandTotal),
              appUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
              projectId: project.id,
            })
          }
          await notifyPOCPIVerified(
            project.id,
            project.name,
            piNumberForLog,
            project.pocId || ""
          )
        } else {
          await notifyPOCPIRejected(
            project.id,
            project.name,
            piNumberForLog,
            project.pocId || "",
            notes || "No reason provided"
          )
        }
      } catch (error) {
        console.error("Failed to send PI notification/email in after():", error)
      }
    })

    return NextResponse.json({
      success: true,
      status: updatedProject.piStatus,
      message: action === "verify" ? "PI verified successfully" : "PI rejected and deleted successfully",
      project: updatedProject,
    })
  } catch (error) {
    console.error("PI Verification error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// GET /api/projects/[id]/verify-pi - Get PI details
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

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        poc: { select: { name: true, email: true } },
        client: { select: { name: true, email: true } },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Only authorized users can view PI
    const isAuthorized =
      session.user.role === "ADMIN" ||
      session.user.id === project.pocId ||
      session.user.id === project.clientId

    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    return NextResponse.json({
      project: {
        piNumber: project.piNumber,
        piStatus: project.piStatus,
        piPdfUrl: project.piPdfUrl,
        piGeneratedAt: project.piGeneratedAt,
        piVerifiedAt: project.piVerifiedAt,
      },
    })
  } catch (error) {
    console.error("PI Fetch error:", error)
    return NextResponse.json(
      { error: "Failed to fetch PI details" },
      { status: 500 }
    )
  }
}
