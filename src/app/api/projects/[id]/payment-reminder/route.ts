import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendOutstandingPaymentReminderEmail } from "@/lib/email"
import { logActivity } from "@/lib/audit"
import { formatCurrency } from "@/utils/formatters"

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Only admins can send payment reminders
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can send payment reminders" }, { status: 403 })
    }

    // Get project with POC, Client, and invoice details
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        poc: true,
        client: true,
        files: {
          where: { type: "INVOICE" },
          orderBy: { uploadedAt: "desc" },
          take: 1
        }
      }
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Collect recipient emails (POC and Client if assigned)
    const recipients: string[] = []
    if (project.poc?.email) recipients.push(project.poc.email)
    if (project.client?.email && !recipients.includes(project.client.email)) {
      recipients.push(project.client.email)
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No recipient email address found" }, { status: 400 })
    }

    // Check if project is delivered (only send reminders for delivered projects)
    if (project.status !== "DELIVERED") {
      return NextResponse.json({ error: "Payment reminders can only be sent for delivered projects" }, { status: 400 })
    }

    // Get the latest invoice or fall back to PI information
    const latestInvoice = project.files[0]
    
    let invoiceNumber: string
    let invoiceDate: string
    let referenceType: string
    
    if (latestInvoice) {
      // Use actual invoice data
      invoiceNumber = latestInvoice.filename.replace(/\.[^/.]+$/, "") // Remove file extension
      invoiceDate = new Date(latestInvoice.uploadedAt).toLocaleDateString('en-IN')
      referenceType = "Invoice"
    } else if (project.piNumber && project.piGeneratedAt) {
      // Fall back to PI (Proforma Invoice) data
      invoiceNumber = project.piNumber
      invoiceDate = new Date(project.piGeneratedAt).toLocaleDateString('en-IN')
      referenceType = "Proforma Invoice"
    } else {
      // No invoice or PI available
      return NextResponse.json({ 
        error: "No invoice or proforma invoice found for this project. Please upload an invoice or generate a PI first." 
      }, { status: 400 })
    }

    const formattedAmount = formatCurrency(project.grandTotal || project.totalCost * 1.18)

    // Send the payment reminder email to recipients (POC & Client if present)
    for (const recipientEmail of recipients) {
      const recipientName = (recipientEmail === project.client?.email ? project.client.name : project.poc?.name) || "Customer"
      await sendOutstandingPaymentReminderEmail(recipientEmail, {
        pocName: recipientName,
        projectName: project.name,
        invoiceNumber: invoiceNumber,
        invoiceDate: invoiceDate,
        outstandingAmount: formattedAmount,
        appUrl: APP_URL,
        referenceType: referenceType,
        projectId: project.id,
      })
    }

    // Log the activity
    await logActivity({
      userId: session.user.id,
      action: "PAYMENT_REMINDER_SENT",
      entityType: "project",
      entityId: id,
      details: {
        recipients: recipients.join(", "),
        pocEmail: project.poc?.email,
        clientEmail: project.client?.email,
        referenceType: referenceType,
        invoiceNumber: invoiceNumber,
        outstandingAmount: project.grandTotal || project.totalCost * 1.18
      },
    })

    return NextResponse.json({ success: true, message: "Payment reminder sent successfully" })
  } catch (error) {
    console.error("Failed to send payment reminder:", error)
    return NextResponse.json({ error: "Failed to send payment reminder" }, { status: 500 })
  }
}