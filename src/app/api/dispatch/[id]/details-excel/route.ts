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

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    let dispatch = await prisma.dispatch.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, projectId: true, name: true, location: true, status: true, pocId: true },
        },
      },
    })

    if (!dispatch) {
      dispatch = await prisma.dispatch.findFirst({
        where: {
          OR: [
            { projectId: id },
            { project: { projectId: { equals: id, mode: "insensitive" } } },
          ],
        },
        include: {
          project: {
            select: { id: true, projectId: true, name: true, location: true, status: true, pocId: true },
          },
        },
      })
    }

    if (!dispatch) {
      return NextResponse.json({ error: "Dispatch details not found for this row" }, { status: 404 })
    }

    const isAdmin = session.user.role === "ADMIN"
    const isOwner = dispatch.project.pocId === session.user.id
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const details = (dispatch.courierDetails || {}) as Record<string, string>
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Project Details")
    worksheet.columns = DISPATCH_DETAIL_COLUMNS.map((header) => ({
      header,
      key: header,
      width: Math.max(14, header.length + 2),
    }))

    const row: Record<string, string> = {}
    DISPATCH_DETAIL_COLUMNS.forEach((header) => {
      row[header] = details[header] || ""
    })

    if (!row["Project ID"]) row["Project ID"] = dispatch.project.projectId
    if (!row["DeliveryAgentCourier"]) row["DeliveryAgentCourier"] = dispatch.courier || ""
    if (!row["AwbNo"]) row["AwbNo"] = dispatch.trackingId || ""
    if (!row["DateOfPickup"] && dispatch.dispatchDate) row["DateOfPickup"] = dispatch.dispatchDate.toISOString().slice(0, 10)
    if (!row["RcDate"] && dispatch.expectedDelivery) row["RcDate"] = dispatch.expectedDelivery.toISOString().slice(0, 10)

    worksheet.addRow(row)
    const headerRow = worksheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003C71" } }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const safeProjectId = dispatch.project.projectId.replace(/[^a-zA-Z0-9-_]/g, "_")
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="dispatch-details-${safeProjectId}.xlsx"`,
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to export project details" }, { status: 500 })
  }
}
