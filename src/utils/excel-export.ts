import ExcelJS from "exceljs"

export interface ExcelColumn {
  header: string
  key: string
  width?: number
}

export interface ExportExcelOptions {
  filename: string
  sheetName?: string
  columns: ExcelColumn[]
  data: Record<string, any>[]
}

export async function exportToExcel({
  filename,
  sheetName = "Report",
  columns,
  data,
}: ExportExcelOptions) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName)

  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(16, col.header.length + 4),
  }))

  data.forEach((item) => {
    worksheet.addRow(item)
  })

  // Style header row with Axis primary brand theme (#003c71)
  const headerRow = worksheet.getRow(1)
  headerRow.height = 26
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003C71" } }
    cell.alignment = { vertical: "middle", horizontal: "left" }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
