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

    console.log("[TEST EMAIL] Starting test email to:", email)
    console.log("[TEST EMAIL] RESEND_API_KEY exists:", !!process.env.RESEND_API_KEY)
    console.log("[TEST EMAIL] EMAIL_FROM:", process.env.EMAIL_FROM)
    console.log("[TEST EMAIL] APP_URL:", APP_URL)

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
        result 
      })
    } catch (emailError) {
      console.error("[TEST EMAIL] Failed:", emailError)
      return NextResponse.json({ 
        success: false, 
        error: "Email sending failed",
        details: emailError instanceof Error ? emailError.message : String(emailError)
      }, { status: 500 })
    }
  } catch (error) {
    console.error("[TEST EMAIL] Route error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
