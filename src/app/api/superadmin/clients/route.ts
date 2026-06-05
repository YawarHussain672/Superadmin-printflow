import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { basePrisma } from "@/lib/prisma"
import { uploadToS3, getPresignedUrl } from "@/lib/s3"
import { sendAdminWelcomeEmail } from "@/lib/email"
import bcrypt from "bcryptjs"
import { UserRole } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const companyName = formData.get("companyName") as string | null
    const clientEmail = formData.get("clientEmail") as string | null
    const password = formData.get("password") as string | null
    const location = formData.get("location") as string | null
    const branchLocation = formData.get("branchLocation") as string | null
    const state = formData.get("state") as string | null
    const logoFile = formData.get("logo") as File | null
    const clientPan = formData.get("clientPan") as string | null
    const clientGst = formData.get("clientGst") as string | null

    if (!companyName || !clientEmail || !password || !location || !state) {
      return NextResponse.json(
        { error: "companyName, clientEmail, password, location, and state are required." },
        { status: 400 }
      )
    }

    // Check email availability in both Client and User models
    const existingClient = await basePrisma.client.findUnique({
      where: { clientEmail }
    })
    const existingUser = await basePrisma.user.findUnique({
      where: { email: clientEmail }
    })

    if (existingClient || existingUser) {
      return NextResponse.json(
        { error: "Email is already in use by another client or user." },
        { status: 400 }
      )
    }

    // Upload logo to S3 if provided
    let companyLogoUrl: string | null = null
    if (logoFile && logoFile.size > 0) {
      try {
        const buffer = Buffer.from(await logoFile.arrayBuffer())
        const timestamp = Date.now()
        const s3Key = `client-logos/${timestamp}-${logoFile.name.replace(/\s+/g, "_")}`
        companyLogoUrl = await uploadToS3(buffer, s3Key, logoFile.type)
      } catch (uploadErr) {
        console.error("S3 Logo Upload Error:", uploadErr)
        return NextResponse.json(
          { error: "Failed to upload company logo." },
          { status: 500 }
        )
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const adminName = `${companyName} Admin`

    // Create client and admin user in a transaction
    const { client, user } = await basePrisma.$transaction(async (tx) => {
      const newClient = await tx.client.create({
        data: {
          companyName,
          clientEmail,
          passwordHash,
          passwordText: password,
          location,
          branchLocation: branchLocation || "Head Office",
          state,
          createdBy: session.user.id,
          companyLogoUrl,
        }
      })

      const newAdminUser = await tx.user.create({
        data: {
          email: clientEmail,
          name: adminName,
          password: passwordHash,
          role: UserRole.ADMIN,
          location,
          branch: branchLocation || "Head Office",
          active: true,
          clientId: newClient.id,
          clientPan: clientPan || null,
          clientGst: clientGst || null,
        }
      })

      return { client: newClient, user: newAdminUser }
    })

    // Write Activity / Audit Log
    try {
      const { logActivity } = await import("@/lib/audit")
      await logActivity({
        userId: session.user.id,
        action: "SUPERADMIN_CLIENT_CREATED",
        entityType: "client",
        entityId: client.id,
        details: { companyName: client.companyName }
      })
    } catch (auditErr) {
      console.error("Failed to log activity:", auditErr)
    }

    // Trigger Pusher Live Refresh Event
    try {
      const { pusherServer, CHANNELS, EVENTS } = await import("@/lib/pusher")
      await pusherServer.trigger(CHANNELS.DASHBOARD, EVENTS.STATS_UPDATED, {})
    } catch (pusherErr) {
      console.error("Failed to trigger Pusher update:", pusherErr)
    }

    // Send Admin Welcome Email
    try {
      const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
      await sendAdminWelcomeEmail(clientEmail, {
        name: adminName,
        email: clientEmail,
        passwordText: password,
        appUrl
      })
    } catch (emailErr) {
      console.error("Failed to send client admin welcome email:", emailErr)
      // We don't fail the request if just the email fails, but we log it
    }

    return NextResponse.json({
      success: true,
      clientId: client.id,
      userId: user.id
    }, { status: 201 })

  } catch (error) {
    console.error("Create Client Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "SUPERADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const state = searchParams.get("state") || ""

    // Find all clients matching search/filter
    const whereClause: any = {}
    if (search) {
      whereClause.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { clientEmail: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } }
      ]
    }
    if (state) {
      whereClause.state = state
    }

    const clients = await basePrisma.client.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        users: {
          select: { id: true }
        },
        projects: {
          select: { totalCost: true, status: true }
        }
      }
    })

    const signedClients = await Promise.all(
      clients.map(async (client) => {
        if (client.companyLogoUrl && client.companyLogoUrl.includes("amazonaws.com")) {
          return {
            ...client,
            companyLogoUrl: await getPresignedUrl(client.companyLogoUrl)
          }
        }
        return client
      })
    )

    return NextResponse.json({ clients: signedClients })
  } catch (error) {
    console.error("Get Clients Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
