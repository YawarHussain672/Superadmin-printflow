import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { sendWelcomeEmail } from "@/lib/email"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { email } = await request.json()
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 })
    }

    // Log current SMTP config (without the password)
    const smtpConfig = {
      host: process.env.MAIL_HOST || "(not set)",
      port: process.env.MAIL_PORT || "587 (default)",
      username: process.env.MAIL_USERNAME || "(not set)",
      passwordSet: !!process.env.MAIL_PASSWORD,
      from: process.env.MAIL_FROM_ADDRESS || "(not set)",
    }
    console.log("[TEST EMAIL] SMTP config:", smtpConfig)
    console.log("[TEST EMAIL] Sending to:", email)

    try {
      const result = await sendWelcomeEmail(email, {
        name: "Test User",
        email: email,
        password: "TestPass123",
        role: "ADMIN",
        appUrl: APP_URL,
      })

      console.log("[TEST EMAIL] Success:", result)
      return NextResponse.json({
        success: true,
        message: "Test email sent successfully",
        smtpConfig,
        messageId: (result as { messageId?: string })?.messageId,
      })
    } catch (emailError) {
      const err = emailError as NodeJS.ErrnoException & {
        code?: string
        responseCode?: number
        response?: string
        command?: string
      }
      console.error("[TEST EMAIL] Failed:", emailError)
      return NextResponse.json(
        {
          success: false,
          error: "Email sending failed",
          smtpConfig,
          details: {
            message: err.message,
            code: err.code,
            smtpResponse: err.response,
            smtpResponseCode: err.responseCode,
            command: err.command,
          },
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("[TEST EMAIL] Route error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
