import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher"
import { notifyProjectDispatched } from "@/lib/notifications"
import ExcelJS from "exceljs"

type DispatchUploadRow = Record<string, string | number | Date | null | undefined>

function getCellValue(row: DispatchUploadRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && value !== "") {
      return String(value)
    }
  }
  return ""
}

// POST /api/dispatch/bulk - Upload Excel with dispatch details
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN" && session.user.role !== "POC") {
      return NextResponse.json({ error: "Only admins and POCs can bulk upload dispatch data" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    // Read Excel file with ExcelJS
    const arrayBuffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Buffer.from(arrayBuffer) as unknown as ExcelJS.Buffer)
    const sheet = workbook.worksheets[0]

    if (!sheet) {
      return NextResponse.json({ error: "Excel file has no worksheets" }, { status: 400 })
    }

    const data: Record<string, string | number | Date | null | undefined>[] = []
    const headerRow = sheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell((cell: ExcelJS.Cell) => {
      headers.push(cell.value?.toString() || "")
    })

    sheet.eachRow((row: ExcelJS.Row, rowNumber: number) => {
      if (rowNumber === 1) return // Skip header row
      const rowData: Record<string, string | number | Date | null | undefined> = {}
      row.eachCell((cell: ExcelJS.Cell, colNumber: number) => {
        const header = headers[colNumber - 1]
        if (header) {
          const val = cell.value
          // Convert ExcelJS CellValue to compatible type
          if (val === null || val === undefined) {
            rowData[header] = null
          } else if (typeof val === 'string' || typeof val === 'number' || val instanceof Date) {
            rowData[header] = val
          } else {
            rowData[header] = String(val)
          }
        }
      })
      data.push(rowData)
    })

    const results = {
      processed: 0,
      errors: [] as string[],
      updated: [] as string[],
    }

    // Process each row
    for (const row of data) {
      try {
        const projectIdStr = getCellValue(row, ["Project ID", "projectId"])
        const courier = getCellValue(row, ["DeliveryAgentCourier", "deliveryAgentCourier", "OBDeliveryAgent", "obDeliveryAgent", "City", "city"])
        const trackingId = getCellValue(row, ["AwbNo", "awbNo"])
        const dispatchDate = getCellValue(row, ["DateOfPickup", "dateOfPickup", "Date", "date"])
        const expectedDelivery = getCellValue(row, ["RcDate", "rcDate", "Event Date", "eventDate", "EventDate"])

        if (!projectIdStr || !courier || !trackingId) {
          results.errors.push(`Missing required fields (Project ID, Courier, AWB No) for row: ${JSON.stringify(row)}`)
          continue
        }

        // Find project by projectId string (like PROJ-001)
        const project = await prisma.project.findFirst({
          where: { projectId: projectIdStr },
          select: { id: true, projectId: true, name: true, status: true, piStatus: true, pocId: true, clientId: true },
        })

        if (!project) {
          results.errors.push(`Project not found: ${projectIdStr}`)
          continue
        }

        if (session.user.role === "POC" && project.pocId !== session.user.id) {
          results.errors.push(`Project ${projectIdStr} does not belong to your account`)
          continue
        }

        if (session.user.role === "POC" && project.piStatus !== "VERIFIED") {
          results.errors.push(`Project ${projectIdStr}: PI must be verified by admin before POC dispatch upload`)
          continue
        }

        if (project.status !== "PRINTING") {
          results.errors.push(`Project ${projectIdStr} must be in PRINTING status (current: ${project.status})`)
          continue
        }

        // Check if Challan is uploaded if we are transitioning to DISPATCHED
        const challanExists = await prisma.fileUpload.findFirst({
          where: { projectId: project.id, type: "CHALLAN" }
        })
        if (!challanExists) {
          results.errors.push(`Project ${projectIdStr}: Challan must be uploaded before dispatch`)
          continue
        }

        // Create dispatch record
        await prisma.dispatch.create({
          data: {
            projectId: project.id,
            courier,
            trackingId,
            dispatchDate: dispatchDate ? new Date(dispatchDate) : new Date(),
            expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
            status: "IN_TRANSIT",
          },
        })

        // Update project status to DISPATCHED
        await prisma.project.update({
          where: { id: project.id },
          data: {
            status: "DISPATCHED",
            statusHistory: {
              create: {
                status: "DISPATCHED",
                note: `Dispatched via ${courier}, Tracking: ${trackingId}`,
                changedById: session.user.id,
              },
            },
          },
        })

        // Send notification to POC and Client (if they exist)
        if (project.pocId) {
          await notifyProjectDispatched(
            project.id,
            project.pocId,
            project.clientId,
            project.name,
            project.projectId || project.id,
            courier,
            trackingId
          )
        }

        // Broadcast real-time updates
        await pusherServer.trigger(CHANNELS.PROJECTS, EVENTS.PROJECT_UPDATED, { id: project.id })

        results.processed++
        results.updated.push(projectIdStr)
      } catch (error) {
        results.errors.push(`Error processing row: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Broadcast dashboard update
    await pusherServer.trigger(CHANNELS.DASHBOARD, EVENTS.STATS_UPDATED, {})

    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} projects`,
      errors: results.errors,
      updated: results.updated,
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to process bulk dispatch" }, { status: 500 })
  }
}

// GET /api/dispatch/bulk/template - Download Excel template
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || (session.user.role !== "ADMIN" && session.user.role !== "POC")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Create template with ExcelJS matching demo format
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Dispatch Template")

    // Define columns matching demo Excel format
    worksheet.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Project ID", key: "projectId", width: 15 },
      { header: "OB Code", key: "obCode", width: 12 },
      { header: "City", key: "city", width: 15 },
      { header: "Location (Branch)", key: "location", width: 20 },
      { header: "Pin Code", key: "pinCode", width: 10 },
      { header: "Event Date", key: "eventDate", width: 12 },
      { header: "Manager Name", key: "managerName", width: 18 },
      { header: "Manager No.", key: "managerNo", width: 12 },
      { header: "Client Name", key: "clientName", width: 18 },
      { header: "Client Code", key: "clientCode", width: 12 },
      { header: "Client Phone", key: "clientPhone", width: 14 },
      { header: "Items", key: "items", width: 20 },
      { header: "Collaterals", key: "collaterals", width: 20 },
      { header: "Quantity", key: "quantity", width: 10 },
      { header: "Unit Price", key: "unitPrice", width: 12 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "GST Rate", key: "gstRate", width: 10 },
      { header: "GST Amount", key: "gstAmount", width: 12 },
      { header: "Total Amount", key: "totalAmount", width: 12 },
      { header: "POC Name", key: "pocName", width: 18 },
      { header: "Status", key: "status", width: 12 },
    ]

    // Style header row
    const headerRow = worksheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      }
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
      }
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      }
    })

    // Add sample row with demo data
    worksheet.addRow({
      date: "27-01-2025",
      projectId: "PROJ-001",
      obCode: "OB001",
      city: "Mumbai",
      location: "Andheri Branch",
      pinCode: "400053",
      eventDate: "30-01-2025",
      managerName: "John Doe",
      managerNo: "9876543210",
      clientName: "ABC Corp",
      clientCode: "CLI001",
      clientPhone: "9876543211",
      items: "Booklet, Medal",
      collaterals: "Certificate, Brochure",
      quantity: 50,
      unitPrice: 125,
      amount: 6250,
      gstRate: "18%",
      gstAmount: 1125,
      totalAmount: 7375,
      pocName: "Jane Smith",
      status: "Requested",
    })

    // Freeze header row
    worksheet.views = [
      {
        state: "frozen",
        xSplit: 0,
        ySplit: 1,
      },
    ]

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="dispatch-template.xlsx"',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 })
  }
}
