import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ProjectStatus } from "@prisma/client"
import ExcelJS from "exceljs"
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher"
import { logActivity } from "@/lib/audit"
import { notifyProjectDispatched } from "@/lib/notifications"

const DISPATCH_DETAIL_COLUMNS = [
  "Project ID", "ItemToBeSent", "DateOfPickup", "VendorName", "SNo", "PONo", "DepartmentCode",
  "PersonOrderedTheJob", "DestinationGOCode", "Consignee", "GOAddress", "GOAddress2", "GOAddress3",
  "GOCity", "GOState", "GOPinCode", "VolumetricWeight", "Quantity", "NoOfBoxes", "PerUnitWeight",
  "EstimatedTotalWeight", "OBDeliveryAgent", "DeliveryAgentCourier", "AwbNo", "OSPNote", "PktStatus",
  "RcRemarks", "RcDate", "RcName", "RcRelation", "RcPhoneNo", "DeliveryRemarks", "GeoLocation",
  "RtoDate", "RtoReason", "Address1", "Address2", "Address3", "City", "State", "PinCode", "OSPDID",
  "MWeight", "MCount", "MQuantity", "StatusReceivedDate",
] as const

/**
 * Expected Excel columns (case-insensitive):
 * Project ID | Courier | Tracking ID | Tracking URL | Dispatch Date | Expected Delivery | Notes
 *
 * POST /api/dispatch/upload
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "ADMIN" && session.user.role !== "POC") {
      return NextResponse.json({ error: "Only admins and POCs can upload dispatch data" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      return NextResponse.json({ error: "Only Excel (.xlsx, .xls) or CSV files are supported" }, { status: 400 })
    }

    // Parse Excel with ExcelJS
    const arrayBuffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Buffer.from(arrayBuffer) as unknown as ExcelJS.Buffer)
    const sheet = workbook.worksheets[0]

    if (!sheet) {
      return NextResponse.json({ error: "Excel file has no worksheets" }, { status: 400 })
    }

    const rows: Record<string, unknown>[] = []
    const headerRow = sheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell((cell: ExcelJS.Cell) => {
      headers.push(cell.value?.toString() || "")
    })

    sheet.eachRow((row: ExcelJS.Row, rowNumber: number) => {
      if (rowNumber === 1) return // Skip header row
      const rowData: Record<string, unknown> = {}
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
      rows.push(rowData)
    })

    if (rows.length === 0) {
      return NextResponse.json({ error: "Excel file is empty or has no data rows" }, { status: 400 })
    }

    // Normalize column names - more robust
    const normalize = (key: string) => {
      if (!key || typeof key !== 'string') return ''
      return key.toString().toLowerCase().replace(/[\s_.\-#]/g, "")
    }
    const normalizeProjectId = (value: string) =>
      value
        .normalize("NFKC")
        .replace(/[–—−]/g, "-")
        .replace(/\s+/g, "")
        .toUpperCase()

    const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[], projects: [] as { id: string; projectId: string; name: string; action: 'created' | 'updated' }[] }

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]

      // More robust value getter
      const get = (keys: string[]) => {
        for (const k of Object.keys(row)) {
          const normalizedKey = normalize(k)
          if (keys.includes(normalizedKey)) {
            const val = row[k]
            // Handle different value types
            if (val === null || val === undefined) return ""
            if (typeof val === 'string') return val.trim()
            if (typeof val === 'number') return val.toString()
            if (val instanceof Date) return val.toISOString()
            return String(val).trim()
          }
        }
        return ""
      }

      const rawProjectId = get(["projectid", "project_id", "projectno", "project#", "id"])
      const projectId = normalizeProjectId(rawProjectId)
      const courier = get(["courier", "couriername", "carrier", "couriercompany", "deliveryagentcourier", "obdeliveryagent", "deliveryagent"])
      const trackingId = get(["trackingid", "tracking_id", "awb", "awbno", "docketno", "trackingnumber"])
      const trackingUrl = get(["trackingurl", "tracking_url", "trackinglink", "url", "link"])
      const dispatchDateRaw = get(["dispatchdate", "dispatch_date", "shippeddate", "dispatchon", "shippedon", "dateofpickup", "pickupdate"])
      const expectedDeliveryRaw = get(["expecteddelivery", "expected_delivery", "edd", "deliverydate", "expecteddate", "deliveryon", "rcdate", "receiveddate"])
      const notes = get(["notes", "remarks", "comments", "note"])

      if (!projectId || !courier || !trackingId) {
        results.skipped++
        const missing = [!projectId && "Project ID", !courier && "Courier", !trackingId && "Tracking ID"].filter(Boolean).join(", ")
        if (projectId) {
          results.errors.push(`Row ${rowIndex + 1} (${projectId}): Missing ${missing}`)
        } else {
          results.errors.push(`Row ${rowIndex + 1}: Missing Project ID`)
        }
        continue
      }

      // Find project
      let project = await prisma.project.findFirst({
        where: { projectId: { equals: projectId, mode: "insensitive" } },
      })

      if (!project && projectId) {
        const tail = projectId.split("-").pop() || projectId
        const candidates = await prisma.project.findMany({
          where: { projectId: { contains: tail, mode: "insensitive" } },
          take: 50,
        })
        project = candidates.find((p) => normalizeProjectId(p.projectId) === projectId) || null
      }

      if (!project) {
        results.skipped++
        results.errors.push(`Project "${rawProjectId}" not found. Please check the Project ID exists and try again.`)
        continue
      }

      if (session.user.role === "POC" && project.pocId !== session.user.id) {
        results.skipped++
        results.errors.push(`Project ${projectId} does not belong to your account`)
        continue
      }

      if (session.user.role === "POC" && project.piStatus !== "VERIFIED") {
        results.skipped++
        results.errors.push(`Project ${projectId}: PI must be verified by admin before POC dispatch upload`)
        continue
      }

      if (project.status !== ProjectStatus.PRINTING && project.status !== ProjectStatus.DISPATCHED && project.status !== ProjectStatus.APPROVED) {
        results.skipped++
        results.errors.push(`Project ${projectId} must be APPROVED, PRINTING, or DISPATCHED before dispatch upload (current: ${project.status})`)
        continue
      }

      // Check if Challan is uploaded if we are transitioning to DISPATCHED
      if (project.status !== ProjectStatus.DISPATCHED) {
        const challanExists = await prisma.fileUpload.findFirst({
          where: { projectId: project.id, type: "CHALLAN" }
        })
        if (!challanExists) {
          results.skipped++
          results.errors.push(`Project ${projectId}: Challan must be uploaded before dispatch`)
          continue
        }
      }

      // Better date parsing
      const parseDate = (val: unknown): Date | undefined => {
        if (!val) return undefined
        const strVal = String(val)
        if (strVal === "") return undefined

        // Try standard date parsing
        const d = new Date(strVal)
        if (!isNaN(d.getTime())) return d

        // Try DD/MM/YYYY format
        const parts = strVal.split(/[/\-.]/)
        if (parts.length === 3) {
          const [p1, p2, p3] = parts.map(Number)
          // Try DD/MM/YYYY
          let tryDate = new Date(p3, p2 - 1, p1)
          if (!isNaN(tryDate.getTime())) return tryDate
          // Try MM/DD/YYYY
          tryDate = new Date(p3, p1 - 1, p2)
          if (!isNaN(tryDate.getTime())) return tryDate
        }

        return undefined
      }

      const dispatchDate = parseDate(dispatchDateRaw)
      const expectedDelivery = parseDate(expectedDeliveryRaw)
      const courierDetails = DISPATCH_DETAIL_COLUMNS.reduce<Record<string, string>>((acc, column) => {
        acc[column] = get([normalize(column)])
        return acc
      }, {})
      if (!courierDetails["Project ID"]) {
        courierDetails["Project ID"] = projectId
      }

      // Upsert dispatch
      const existing = await prisma.dispatch.findUnique({ where: { projectId: project.id } })

      if (existing) {
        await prisma.dispatch.update({
          where: { projectId: project.id },
          data: {
            courier,
            trackingId,
            trackingUrl: trackingUrl || null,
            dispatchDate,
            expectedDelivery,
            notes: notes || null,
            status: "in_transit",
            courierDetails,
          },
        })
        results.updated++
        results.projects.push({ id: project.id, projectId: project.projectId, name: project.name, action: 'updated' })
      } else {
        await prisma.dispatch.create({
          data: {
            projectId: project.id,
            courier,
            trackingId,
            trackingUrl: trackingUrl || null,
            dispatchDate,
            expectedDelivery,
            notes: notes || null,
            status: "in_transit",
            courierDetails,
          },
        })
        // Update project status to DISPATCHED
        await prisma.project.update({
          where: { id: project.id },
          data: {
            status: ProjectStatus.DISPATCHED,
            statusHistory: { create: { status: ProjectStatus.DISPATCHED, note: `Dispatched via ${courier} — ${trackingId}`, changedById: session.user.id } },
          },
        })

        const fullProject = await prisma.project.findUnique({
          where: { id: project.id },
          include: { poc: { select: { id: true, email: true, name: true } }, client: { select: { id: true } } },
        })
        if (fullProject?.poc) {
          await notifyProjectDispatched(project.id, fullProject.poc.id, fullProject.client?.id, fullProject.name, fullProject.projectId, courier, trackingId)
        }

        // Audit log
        await logActivity({
          userId: session.user.id,
          action: "DISPATCHED",
          entityType: "project",
          entityId: project.id,
          details: { courier, trackingId },
        })

        results.created++
        results.projects.push({ id: project.id, projectId: project.projectId, name: project.name, action: 'created' })
      }
    }

    // Notify all clients if anything changed
    if (results.created > 0 || results.updated > 0) {
      await pusherServer.trigger(CHANNELS.DISPATCH, EVENTS.DISPATCH_UPDATED, {})
      await pusherServer.trigger(CHANNELS.PROJECTS, EVENTS.PROJECT_UPDATED, {})
      await pusherServer.trigger(CHANNELS.DASHBOARD, EVENTS.STATS_UPDATED, {})
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${rows.length} rows: ${results.created} created, ${results.updated} updated, ${results.skipped} skipped`,
      ...results,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to process file"
    return NextResponse.json({
      error: "Failed to process dispatch upload",
      details: errorMessage
    }, { status: 500 })
  }
}
