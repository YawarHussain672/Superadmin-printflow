import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { basePrisma } from "@/lib/prisma"
import { deleteFromS3 } from "@/lib/s3"

function getS3KeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const urlParts = url.split(".amazonaws.com/")
    if (urlParts.length > 1) {
      return decodeURIComponent(urlParts[1])
    }
    return null
  } catch {
    return null
  }
}

async function deleteS3Asset(url: string | null | undefined) {
  const key = getS3KeyFromUrl(url)
  if (key) {
    try {
      await deleteFromS3(key)
    } catch (error) {
      console.error(`Failed to delete S3 asset with key ${key}:`, error)
    }
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const client = await basePrisma.client.findUnique({
      where: { id },
      include: {
        projects: {
          include: {
            files: true,
            dispatch: true
          }
        }
      }
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // 1. Gather all S3 assets to delete (logo, PIs, PODs, file uploads)
    const s3AssetsToDelete: string[] = []

    if (client.companyLogoUrl) {
      s3AssetsToDelete.push(client.companyLogoUrl)
    }

    for (const project of client.projects) {
      if (project.piPdfUrl) {
        s3AssetsToDelete.push(project.piPdfUrl)
      }
      if (project.dispatch?.podUrl) {
        s3AssetsToDelete.push(project.dispatch.podUrl)
      }
      for (const file of project.files) {
        s3AssetsToDelete.push(file.url)
      }
    }

    // 2. Perform database deletion in a transaction
    await basePrisma.$transaction(async (tx) => {
      // Delete child relations of Projects first
      const projectIds = client.projects.map(p => p.id)

      if (projectIds.length > 0) {
        await tx.collateral.deleteMany({
          where: { projectId: { in: projectIds } }
        })
        await tx.fileUpload.deleteMany({
          where: { projectId: { in: projectIds } }
        })
        await tx.dispatch.deleteMany({
          where: { projectId: { in: projectIds } }
        })
        await tx.approval.deleteMany({
          where: { projectId: { in: projectIds } }
        })
      }

      // Delete Client relations
      await tx.activity.deleteMany({
        where: { clientId: id }
      })
      await tx.notification.deleteMany({
        where: { clientId: id }
      })
      await tx.statusHistory.deleteMany({
        where: { clientId: id }
      })
      await tx.rateCard.deleteMany({
        where: { clientId: id }
      })

      // Delete projects
      if (projectIds.length > 0) {
        await tx.project.deleteMany({
          where: { id: { in: projectIds } }
        })
      }

      // Delete users associated with the client
      await tx.user.deleteMany({
        where: { clientId: id }
      })

      // Delete client organization itself
      await tx.client.delete({
        where: { id }
      })
    })

    // 3. Delete files from S3 asynchronously
    for (const assetUrl of s3AssetsToDelete) {
      if (assetUrl.includes("amazonaws.com")) {
        await deleteS3Asset(assetUrl)
      }
    }

    // Trigger Pusher Live Refresh Event
    try {
      const { pusherServer, CHANNELS, EVENTS } = await import("@/lib/pusher")
      await pusherServer.trigger(CHANNELS.DASHBOARD, EVENTS.STATS_UPDATED, {})
    } catch (pusherErr) {
      console.error("Failed to trigger Pusher update:", pusherErr)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete Client Error:", error)
    return NextResponse.json({ error: "Failed to delete client organization" }, { status: 500 })
  }
}
