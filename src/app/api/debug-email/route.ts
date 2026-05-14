import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function GET() {
  try {
    const config = {
      MAIL_HOST: process.env.MAIL_HOST,
      MAIL_PORT: process.env.MAIL_PORT,
      MAIL_USERNAME: process.env.MAIL_USERNAME,
      MAIL_PASSWORD_SET: !!process.env.MAIL_PASSWORD,
      MAIL_PASSWORD_LENGTH: process.env.MAIL_PASSWORD?.length ?? 0,
      MAIL_FROM_ADDRESS: process.env.MAIL_FROM_ADDRESS,
      MAIL_FROM_NAME: process.env.MAIL_FROM_NAME,
      NODE_ENV: process.env.NODE_ENV,
    }

    console.log("[DEBUG-EMAIL] Starting debug test with config:", { ...config, MAIL_PASSWORD_SET: config.MAIL_PASSWORD_SET })

    // Step 1: Check env vars
    if (!config.MAIL_HOST || !config.MAIL_USERNAME || !config.MAIL_PASSWORD_SET) {
      return NextResponse.json({
        status: "ERROR",
        message: "SMTP env vars not loaded in Next.js runtime. Check your .env file and ensure it's in the root directory.",
        config,
      }, { status: 500 })
    }

    // Step 2: Try SMTP verify
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: parseInt(process.env.MAIL_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      },
      tls: { 
        rejectUnauthorized: false
      },
      debug: true,
      logger: true
    })

    console.log("[DEBUG-EMAIL] Verifying transporter...")
    try {
      await transporter.verify()
      console.log("[DEBUG-EMAIL] SMTP verified OK")
    } catch (verifyErr: any) {
      console.error("[DEBUG-EMAIL] SMTP verify failed:", verifyErr)
      return NextResponse.json({
        status: "SMTP_VERIFY_FAILED",
        message: verifyErr.message,
        code: verifyErr.code,
        stack: verifyErr.stack,
        config,
      }, { status: 500 })
    }

    // Step 3: Try sending a real email
    const testTo = "hussainyawar672@gmail.com"
    console.log(`[DEBUG-EMAIL] Attempting to send test email to ${testTo}...`)
    
    const from = config.MAIL_FROM_ADDRESS
      ? `${config.MAIL_FROM_NAME || "Printflow"} <${config.MAIL_FROM_ADDRESS}>`
      : `Printflow <${config.MAIL_USERNAME}>`

    const result = await transporter.sendMail({
      from,
      to: testTo,
      subject: "[NEXTJS DEBUG] SMTP Test from Next.js Runtime",
      html: `
        <h1>SMTP Runtime Test</h1>
        <p>This test email was sent from <strong>inside the Next.js API route</strong>.</p>
        <p>If you see this, SMTP is working correctly in the Next.js runtime.</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
        <hr>
        <h3>Config Used:</h3>
        <pre>${JSON.stringify(config, null, 2)}</pre>
      `,
    })

    console.log("[DEBUG-EMAIL] Email sent successfully:", result.messageId)
    return NextResponse.json({
      status: "SUCCESS",
      message: `Email sent to ${testTo}`,
      messageId: result.messageId,
      accepted: result.accepted,
      config,
    })

  } catch (globalErr: any) {
    console.error("[DEBUG-EMAIL] Global error in debug route:", globalErr)
    return NextResponse.json({
      status: "GLOBAL_ERROR",
      message: globalErr.message,
      stack: globalErr.stack,
    }, { status: 500 })
  }
}
