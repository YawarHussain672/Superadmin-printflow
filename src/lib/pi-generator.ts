import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import sharp from "sharp"

interface CollateralItem {
  itemName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  specification?: string | null
  hsnCode?: string | null
  gstRate?: number | null
}

interface ProjectData {
  projectId: string
  name: string
  piNumber: string
  location: string
  state?: string | null
  totalCost: number
  packingCharges: number
  packingChargesGstRate: number
  pocName?: string | null
  pocEmail?: string | null
  clientName?: string | null
  clientEmail?: string | null
  clientLocation?: string | null
  clientPan?: string | null
  clientGst?: string | null
  deliveryAddress?: string | null
  recipientName?: string | null
  recipientContact?: string | null
  recipientBranch?: string | null
  collaterals: CollateralItem[]
  generatedAt: Date
}

export async function generatePIPDF(project: ProjectData): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const rightAlignX = pageWidth - 12

  // Default font for the whole document to match Times New Roman in HTML
  doc.setFont("times", "normal")

  // === HEADER SECTION ===

  // Add logo in top left (purple color) - smaller size
  try {
    const fs = await import('fs')
    const path = await import('path')
    const svgPath = path.join(process.cwd(), 'rm-white-logo3.svg')
    const pngPath = path.join(process.cwd(), 'rm-white-logo3.png')

    // Delete cached PNG if it exists to ensure we use the updated purple SVG
    if (fs.existsSync(pngPath)) {
      fs.unlinkSync(pngPath)
    }

    // Convert SVG to PNG with proper background handling
    if (fs.existsSync(svgPath)) {
      await sharp(svgPath)
        .resize(120, 60, { fit: 'inside', withoutEnlargement: true })
        .recomb([
          [0.5, 0, 0.5],
          [0, 0, 0],
          [0.5, 0, 0.5]
        ])
        .png()
        .toFile(pngPath)

      const logoData = fs.readFileSync(pngPath)
      const base64Image = logoData.toString('base64')
      doc.addImage(base64Image, 'PNG', 10, 3.9, 30, 15)
    }
  } catch (error) {
    // If logo processing fails, use purple text fallback
    doc.setFontSize(10)
    doc.setTextColor(128, 0, 128)
    doc.setFont("times", "bold")
    doc.text("RISHIRAJ MEDIA", 12, 15)
    doc.setTextColor(0, 0, 0)
  }

  // Title: PROFORMA INVOICE (centered, bold, serif)
  doc.setFontSize(18)
  doc.setFont("times", "bold")
  doc.text("PROFORMA INVOICE", pageWidth / 2, 15, { align: "center" })

  // Top main line
  doc.setLineWidth(0.5)
  doc.line(10, 20, pageWidth - 10, 20)

  // === DETAILS SECTION ===
  const detailsY = 24
  const boxHeight = 42
  const colWidth = (pageWidth - 20) / 2

  // Customer Box (Left)
  doc.setFont("times", "bold")
  doc.setFontSize(10)
  doc.text("Customer", 12, detailsY + 6)

  doc.setFont("times", "normal")
  doc.setFontSize(9)
  let custY = detailsY + 13
  doc.setFont("times", "bold")
  doc.text("Axis Max Life Insurance Ltd.", 12, custY)
  doc.setFont("times", "normal")
  custY += 4.5
  doc.text("3rd Floor, Operations Centre,", 12, custY)
  custY += 4.5
  doc.text("90-A, Udyog Vihar, Sector 18,", 12, custY)
  custY += 4.5
  doc.text("Gurugram-122015, Haryana, INDIA", 12, custY)
  custY += 4.5
  doc.text("PAN/IT NO:AACCM3201E", 12, custY)
  custY += 4.5
  doc.text("GST No.06AACCM3201E1Z7", 12, custY)

  // Proforma Details Box (Right)
  const rightBoxX = 10 + colWidth
  doc.setFont("times", "bold")
  doc.setFontSize(10)
  doc.text("Proforma Details", rightBoxX + 2, detailsY + 6)

  doc.setFont("times", "normal")
  doc.setFontSize(9)
  const labelX = rightBoxX + 2
  const valueX = rightBoxX + 35

  doc.text("No.", labelX, detailsY + 13)
  doc.text(project.piNumber, valueX, detailsY + 13)

  doc.text("Date:-", labelX, detailsY + 18)
  doc.text(project.generatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }), valueX, detailsY + 18)

  doc.text("Revise Date", labelX, detailsY + 23)

  doc.text("Job Name :-", labelX, detailsY + 28)
  doc.setFont("times", "bold")
  doc.text(project.name, valueX, detailsY + 28)
  // Underline for Job Name
  const jobNameWidth = doc.getTextWidth(project.name)
  doc.setLineWidth(0.1)
  doc.line(valueX, detailsY + 29, valueX + jobNameWidth, detailsY + 29)

  doc.setFont("times", "normal")
  doc.text("Contact Person:-", labelX, detailsY + 33)
  doc.text(project.pocName || "", valueX, detailsY + 33)

  // Draw Boxes for Details
  doc.setLineWidth(0.1)
  // Customer Rect
  doc.rect(10, detailsY, colWidth, boxHeight)
  doc.line(10, detailsY + 8, 10 + colWidth, detailsY + 8) // Header line

  // Proforma Rect
  doc.rect(10 + colWidth, detailsY, colWidth, boxHeight)
  doc.line(10 + colWidth, detailsY + 8, 10 + colWidth * 2, detailsY + 8) // Header line

  // === SECOND ROW BOXES ===
  const secondRowY = detailsY + boxHeight + 2
  const secondRowHeight = 24

  // Delivery Address
  doc.setFont("times", "bold")
  doc.setFontSize(10)
  doc.text("Delivery Address", 12, secondRowY + 6)
  doc.setFont("times", "normal")

  const deliveryLines: string[] = []
  if (project.recipientName) {
    deliveryLines.push(`Name: ${project.recipientName.trim()}`)
  }
  if (project.recipientContact) {
    deliveryLines.push(`Contact: ${project.recipientContact.trim()}`)
  }
  if (project.recipientBranch) {
    const addrLines = doc.splitTextToSize(project.recipientBranch.trim(), colWidth - 4)
    deliveryLines.push(...addrLines)
  }

  if (deliveryLines.length === 0) {
    const fallbackAddr = project.deliveryAddress || `${project.location || ""}${project.state ? `, ${project.state}` : ""}`
    if (fallbackAddr.trim()) {
      const addrLines = doc.splitTextToSize(fallbackAddr.trim(), colWidth - 4)
      deliveryLines.push(...addrLines)
    }
  }

  let fontSize = 8.5
  let lineSpacing = 4.0

  if (deliveryLines.length > 4) {
    fontSize = 7.0
    lineSpacing = 2.9
  } else if (deliveryLines.length === 4) {
    fontSize = 7.5
    lineSpacing = 3.3
  } else if (deliveryLines.length === 3) {
    fontSize = 8.0
    lineSpacing = 3.8
  }

  doc.setFontSize(fontSize)
  deliveryLines.forEach((line: string, index: number) => {
    const lineY = secondRowY + 11.5 + index * lineSpacing
    if (lineY < secondRowY + 23.5) {
      doc.text(line, 12, lineY)
    }
  })

  doc.rect(10, secondRowY, colWidth, secondRowHeight)
  doc.line(10, secondRowY + 8, 10 + colWidth, secondRowY + 8)

  // Terms of Delivery
  doc.setFont("times", "bold")
  doc.setFontSize(10)
  doc.text("Terms of Delivery", rightBoxX + 2, secondRowY + 6)
  doc.setFont("times", "normal")
  doc.setFontSize(9)
  doc.text(`POC: ${project.pocName || "N/A"}`, rightBoxX + 2, secondRowY + 12)
  doc.rect(10 + colWidth, secondRowY, colWidth, secondRowHeight)
  doc.line(10 + colWidth, secondRowY + 8, 10 + colWidth * 2, secondRowY + 8)

  // === TABLE SECTION ===
  const tableY = secondRowY + secondRowHeight + 4

  // Add a clarifying note before the table
  doc.setFont("times", "normal")
  doc.setFontSize(8)
  const noteY = tableY + 3
  doc.text("Note: Line item costs are shown exclusive of GST; GST is calculated separately in the totals section.", 12, noteY)

  const tableStartY = noteY + 6

  const tableData: (string | number)[][] = []
  let sNo = 1

  for (const item of project.collaterals) {
    const gstRate = item.gstRate ?? 18
    const displayName = item.specification && item.specification.trim()
      ? `${item.itemName} (${item.specification.trim()})`
      : item.itemName
    tableData.push([
      sNo++,
      displayName,
      `${gstRate}%`,
      item.quantity,
      "Nos",
      item.unitPrice.toFixed(2),
      item.totalPrice.toFixed(2),
    ])
  }

  if (project.packingCharges > 0) {
    const packingRate = project.packingChargesGstRate ?? 18
    tableData.push([
      sNo++,
      "Packaging Charges",
      `${packingRate}%`,
      1,
      "Nos",
      project.packingCharges.toFixed(2),
      project.packingCharges.toFixed(2),
    ])
  }

  // Calculate totals using per-item GST rates
  const itemsSubtotal = project.collaterals.reduce((sum, c) => sum + c.totalPrice, 0)
  const packingSubtotal = project.packingCharges
  const subtotal = itemsSubtotal + packingSubtotal
  const collateralsGst = project.collaterals.reduce((sum, c) => {
    const rate = c.gstRate ?? 18
    return sum + (c.totalPrice * (rate / 100))
  }, 0)
  const packingRate = project.packingChargesGstRate ?? 18
  const packingGst = packingSubtotal * (packingRate / 100)
  const totalGst = collateralsGst + packingGst
  const grandTotal = subtotal + totalGst

  // Draw Main Table
  autoTable(doc, {
    startY: tableStartY,
    head: [["S.NO", "# Description", "GST%", "Qty.", "Unit", "Rate.", "Cost (INR) (Excl. GST)"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [243, 244, 246], // Gray-100
      textColor: [0, 0, 0],
      font: "times",
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
    bodyStyles: {
      font: "times",
      fontSize: 9,
      textColor: [0, 0, 0],
      lineWidth: 0.1,
      lineColor: [0, 0, 0],
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 80 },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 14, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 25, halign: "right" },
      6: { cellWidth: 31, halign: "right" },
    },
    margin: { left: 10, right: 10 },
  })

  let finalY = (doc as any).lastAutoTable.finalY

  // Add Spacer Row if needed (simulating the 350px spacer in HTML)
  // We check if there's enough space to add a large spacer or just move to a certain point
  const minTableBottom = tableY + 120 // Minimum height for the items section
  if (finalY < minTableBottom) {
    // Draw empty vertical lines to extend the table look
    doc.setLineWidth(0.1)
    const startX = 10
    const widths = [12, 80, 14, 14, 14, 25, 31]
    let currentX = startX
    for (let i = 0; i <= widths.length; i++) {
      doc.line(currentX, finalY, currentX, minTableBottom)
      if (i < widths.length) currentX += widths[i]
    }
    // Bottom line of the extended section
    doc.line(10, minTableBottom, pageWidth - 10, minTableBottom)
    finalY = minTableBottom
  }

  // === TOTALS SECTION ===
  const totalsY = finalY
  const totalsLabelX = pageWidth - 10 - 31 - 25 - 14 - 14 - 14 // Start of last few columns
  const totalsBoxWidth = pageWidth - 10 - totalsLabelX
  const rowHeight = 8

  doc.setFont("times", "bold")
  // Header
  doc.rect(totalsLabelX, totalsY, totalsBoxWidth, rowHeight)
  doc.text("Description", totalsLabelX + 2, totalsY + 5.5)
  doc.text("Amount (INR)", pageWidth - 12, totalsY + 5.5, { align: "right" })

  // Subtotal before GST
  doc.setFont("times", "normal")
  doc.rect(totalsLabelX, totalsY + rowHeight, totalsBoxWidth, rowHeight)
  doc.text("Subtotal (Before GST)", totalsLabelX + 2, totalsY + rowHeight + 5.5)
  doc.text(subtotal.toFixed(2), pageWidth - 12, totalsY + rowHeight + 5.5, { align: "right" })

  // IGST
  doc.rect(totalsLabelX, totalsY + rowHeight * 2, totalsBoxWidth, rowHeight)
  doc.setFont("times", "bold")
  doc.text("IGST Total", totalsLabelX + 2, totalsY + rowHeight * 2 + 5.5)
  doc.text(totalGst.toFixed(2), pageWidth - 12, totalsY + rowHeight * 2 + 5.5, { align: "right" })

  // Grand Total
  doc.setFont("times", "bold")
  doc.rect(totalsLabelX, totalsY + rowHeight * 3, totalsBoxWidth, rowHeight)
  doc.text("Grand Total (Incl. GST)", totalsLabelX + 2, totalsY + rowHeight * 3 + 5.5)
  doc.text(grandTotal.toFixed(2), pageWidth - 12, totalsY + rowHeight * 3 + 5.5, { align: "right" })

  // Vertical line to separate Total labels from values in the totals box
  doc.line(pageWidth - 10 - 31, totalsY, pageWidth - 10 - 31, totalsY + rowHeight * 4)

  // === TERMS SECTION ===
  const termsY = totalsY + rowHeight * 4 + 6
  doc.setFont("times", "bold")
  doc.setFontSize(10)
  doc.text("Terms:", 12, termsY + 6)

  doc.setFont("times", "normal")
  doc.setFontSize(8.5)
  const terms = [
    "1. Work Order in favour of RISHIRAJ MEDIA, New Delhi.",
    "2- Interest @ 24% per annum will be charged if the bill is not paid on due date.",
    "3- All dispute subject to jurisdiction of Delhi courts only.",
    "4- All cheques should be made in favour of RISHIRAJ MEDIA.",
    "5- All payments should be supported with payments advise.",
  ]

  let currentTermY = termsY + 12
  for (const term of terms) {
    doc.text(term, 12, currentTermY)
    currentTermY += 4.5
  }

  // Terms box - tall enough to contain all 5 lines
  doc.rect(10, termsY, pageWidth - 20, 36)

  // === SIGNATURE / FOOTER SECTION ===
  const footerY = termsY + 40
  doc.setFontSize(8)
  doc.setFont("times", "italic")
  doc.setTextColor(100, 100, 100)
  doc.text(
    "This is a computer-generated invoice and does not require a physical signature.",
    pageWidth / 2,
    footerY,
    { align: "center" }
  )
  doc.setTextColor(0, 0, 0)

  const pdfBuffer = doc.output("arraybuffer")
  return Buffer.from(pdfBuffer)
}
