import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma, basePrisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let targetClientId: string | null = null

    if (session.user.role === "SUPERADMIN") {
      const { searchParams } = new URL(request.url)
      targetClientId = searchParams.get("clientId")
      if (!targetClientId) {
        return NextResponse.json({ error: "clientId is required for SuperAdmin" }, { status: 400 })
      }
    } else {
      targetClientId = session.user.clientId || ""
    }

    // Query using basePrisma to explicitly query the correct tenant's settings
    const settings = await basePrisma.systemSetting.findMany({
      where: { clientId: targetClientId }
    })

    const config = {
      enabled: settings.find(s => s.key === "reminder_emails_enabled")?.value === "true",
      intervalDays: parseInt(settings.find(s => s.key === "reminder_emails_interval_days")?.value || "7"),
      lastRun: settings.find(s => s.key === "reminder_emails_last_run")?.value || null
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error("GET settings error:", error)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "SUPERADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { enabled, intervalDays, clientId } = body

    if (typeof enabled !== "boolean" || typeof intervalDays !== "number") {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
    }

    let targetClientId: string | null = null
    if (session.user.role === "SUPERADMIN") {
      if (!clientId) {
        return NextResponse.json({ error: "clientId is required for SuperAdmin" }, { status: 400 })
      }
      targetClientId = clientId
    } else {
      targetClientId = session.user.clientId || null
    }

    await basePrisma.$transaction([
      basePrisma.systemSetting.upsert({
        where: { clientId_key: { clientId: targetClientId || "", key: "reminder_emails_enabled" } },
        update: { value: enabled ? "true" : "false" },
        create: { key: "reminder_emails_enabled", value: enabled ? "true" : "false", clientId: targetClientId }
      }),
      basePrisma.systemSetting.upsert({
        where: { clientId_key: { clientId: targetClientId || "", key: "reminder_emails_interval_days" } },
        update: { value: String(intervalDays) },
        create: { key: "reminder_emails_interval_days", value: String(intervalDays), clientId: targetClientId }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("POST settings error:", error)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}
