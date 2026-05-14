import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import ExcelJS from "exceljs"

const DISPATCH_DETAIL_COLUMNS = [
  "Project ID", "ItemToBeSent", "DateOfPickup", "VendorName", "SNo", "PONo", "DepartmentCode",
  "PersonOrderedTheJob", "DestinationGOCode", "Consignee", "GOAddress", "GOAddress2", "GOAddress3",
  "GOCity", "GOState", "GOPinCode", "VolumetricWeight", "Quantity", "NoOfBoxes", "PerUnitWeight",
  "EstimatedTotalWeight", "OBDeliveryAgent", "DeliveryAgentCourier", "AwbNo", "OSPNote", "PktStatus",
  "RcRemarks", "RcDate", "RcName", "RcRelation", "RcPhoneNo", "DeliveryRemarks", "GeoLocation",
  "RtoDate", "RtoReason", "Address1", "Address2", "Address3", "City", "State", "PinCode", "OSPDID",
  "MWeight", "MCount", "MQuantity", "StatusReceivedDate",
] as const

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = session.user.role === "ADMIN"
    const dispatches = await prisma.dispatch.findMany({
      where: !isAdmin ? { project: { pocId: session.user.id } } : {},
      include: {
        project: {
          select: { id: true, projectId: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    if (dispatches.length === 0) {
      return NextResponse.json({ error: "No dispatch records found to export" }, { status: 404 })
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Detailed Dispatch Report")

    // Define columns
    worksheet.columns = DISPATCH_DETAIL_COLUMNS.map((header) => ({
      header,
      key: header,
      width: Math.max(15, header.length + 2),
    }))

    // Add rows
    dispatches.forEach((dispatch) => {
      const details = (dispatch.courierDetails || {}) as Record<string, string>
      const row: Record<string, string> = {}
      
      DISPATCH_DETAIL_COLUMNS.forEach((header) => {
        row[header] = details[header] || ""
      })

      // Fallback values if missing in JSON but present in DB
      if (!row["Project ID"]) row["Project ID"] = dispatch.project.projectId
      if (!row["DeliveryAgentCourier"]) row["DeliveryAgentCourier"] = dispatch.courier || ""
      if (!row["AwbNo"]) row["AwbNo"] = dispatch.trackingId || ""
      if (!row["DateOfPickup"] && dispatch.dispatchDate) {
        row["DateOfPickup"] = dispatch.dispatchDate.toISOString().slice(0, 10)
      }
      if (!row["RcDate"] && dispatch.expectedDelivery) {
        row["RcDate"] = dispatch.expectedDelivery.toISOString().slice(0, 10)
      }

      worksheet.addRow(row)
    })

    // Style the header
    const headerRow = worksheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003C71" } }
      cell.alignment = { vertical: "middle", horizontal: "center" }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const fileName = `Detailed_Dispatch_Report_${new Date().toISOString().split("T")[0]}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    console.error("Detailed export error:", error)
    return NextResponse.json({ error: "Failed to generate detailed Excel report" }, { status: 500 })
  }
}
