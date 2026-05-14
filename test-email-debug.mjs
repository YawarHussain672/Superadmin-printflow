/**
 * test-email-debug.mjs
 * Run with: node test-email-debug.mjs
 * Tests SMTP + queries the DB for active admins to simulate notifyAdminsNewApproval
 */
import nodemailer from "nodemailer"
import { createRequire } from "module"

// ── Load .env manually ────────────────────────────────────────────────────────
import { readFileSync } from "fs"
import { resolve } from "path"

const envPath = resolve(process.cwd(), ".env")
console.log(`\n📂 Loading .env from: ${envPath}\n`)
try {
  const envFile = readFileSync(envPath, "utf-8")
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
  console.log("✅ .env loaded\n")
} catch (e) {
  console.error("❌ Could not load .env:", e.message)
  process.exit(1)
}

// ── Print SMTP config ─────────────────────────────────────────────────────────
console.log("═══ SMTP Configuration ═══════════════════════════════════════")
console.log(`  MAIL_HOST     : ${process.env.MAIL_HOST}`)
console.log(`  MAIL_PORT     : ${process.env.MAIL_PORT}`)
console.log(`  MAIL_USERNAME : ${process.env.MAIL_USERNAME}`)
console.log(`  MAIL_PASSWORD : ${"*".repeat((process.env.MAIL_PASSWORD || "").length)} (${(process.env.MAIL_PASSWORD || "").length} chars)`)
console.log(`  MAIL_FROM     : ${process.env.MAIL_FROM_ADDRESS}`)
console.log("═══════════════════════════════════════════════════════════════\n")

const host = process.env.MAIL_HOST
const port = parseInt(process.env.MAIL_PORT || "587")
const user = process.env.MAIL_USERNAME
const pass = process.env.MAIL_PASSWORD
const from = process.env.MAIL_FROM_ADDRESS
  ? `${process.env.MAIL_FROM_NAME || "Printflow"} <${process.env.MAIL_FROM_ADDRESS}>`
  : "Printflow <noreply@test.com>"

// ── Step 1: Verify SMTP ────────────────────────────────────────────────────────
console.log("🔌 Step 1: Testing SMTP connection (verify)...")
const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  requireTLS: port !== 465,
  auth: { user, pass },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
})

try {
  await transporter.verify()
  console.log("✅ SMTP connection verified successfully!\n")
} catch (err) {
  console.error("❌ SMTP verify failed:")
  console.error(`   Code: ${err.code}`)
  console.error(`   Response: ${err.response}`)
  console.error(`   Message: ${err.message}`)
  console.log("\n⚠️  Cannot send test email if SMTP is broken. Exiting.")
  process.exit(1)
}

// ── Step 2: Query DB for active admins ────────────────────────────────────────
console.log("🗄️  Step 2: Querying database for active admins...")
let admins = []
try {
  const { PrismaClient } = await import("@prisma/client")
  const prisma = new PrismaClient()
  admins = await prisma.user.findMany({
    where: { role: "ADMIN", active: true },
    select: { id: true, email: true, name: true, active: true },
  })
  await prisma.$disconnect()
  console.log(`\n📋 Found ${admins.length} active admin(s):`)
  if (admins.length === 0) {
    console.log("   ⚠️  NO ACTIVE ADMINS FOUND — this is why no email is sent!")
    console.log("   Check: is the admin account active in the database?\n")
  } else {
    admins.forEach((a, i) => {
      console.log(`   [${i + 1}] name="${a.name}" | email="${a.email}" | active=${a.active}`)
    })
  }
  console.log()
} catch (dbErr) {
  console.error("❌ Database query failed:", dbErr.message)
  console.log("   Continuing with a fallback test email to MAIL_FROM_ADDRESS...\n")
  admins = [{ id: "test", email: from.match(/<(.+)>/)?.[1] || user, name: "Test Admin", active: true }]
}

// ── Step 3: Send test email to each admin ────────────────────────────────────
console.log("📧 Step 3: Sending test emails...")
const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"

for (const admin of admins) {
  if (!admin.email) {
    console.log(`   ⚠️  Admin "${admin.name}" has no email — skipping`)
    continue
  }
  console.log(`   → Sending to: ${admin.email} (${admin.name})`)
  try {
    const result = await transporter.sendMail({
      from,
      to: admin.email,
      subject: `[TEST] Action Required: New Project Submitted – Test Project | Approval Pending`,
      html: `
        <p>Dear ${admin.name},</p>
        <p>This is a <strong>TEST EMAIL</strong> from the Printflow debug script.</p>
        <p>If you receive this, email notifications are working correctly.</p>
        <p>App URL: ${appUrl}</p>
        <hr>
        <p style="color:#999;font-size:12px">Sent at: ${new Date().toISOString()}</p>
      `,
    })
    console.log(`   ✅ Sent! messageId=${result.messageId}`)
    if (result.rejected?.length > 0) {
      console.warn(`   ⚠️  Rejected addresses: ${result.rejected.join(", ")}`)
    }
  } catch (err) {
    console.error(`   ❌ Failed to send to ${admin.email}:`)
    console.error(`      Code: ${err.code}`)
    console.error(`      Response: ${err.response}`)
    console.error(`      Message: ${err.message}`)
  }
}

console.log("\n═══ Debug complete ════════════════════════════════════════════\n")
