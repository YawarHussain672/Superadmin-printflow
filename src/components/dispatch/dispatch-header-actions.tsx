"use client"

import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface UploadProject {
  id: string
  projectId: string
  name: string
  action: 'created' | 'updated'
}

interface UploadResult {
  message: string
  created: number
  updated: number
  skipped: number
  errors: string[]
  projects: UploadProject[]
}

export function DispatchHeaderActions() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  // Lock body scroll when modal is open
  useEffect(() => {
    if (uploadResult) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [uploadResult])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      toast.error("Only Excel (.xlsx, .xls) or CSV files are supported")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File must be under 5MB")
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/dispatch/upload", { method: "POST", body: formData })
      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        toast.error(res.statusText || "Upload failed")
        return
      }

      if (res.ok) {
        // Always show the upload result modal with summary
        setUploadResult({
          message: data.message,
          created: data.created,
          updated: data.updated,
          skipped: data.skipped,
          errors: data.errors || [],
          projects: data.projects || [],
        })
        toast.success(data.message)
        router.refresh()
      } else {
        const errorMsg = data.details || data.error || "Upload failed"
        toast.error(errorMsg)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error. Please try again.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")

      const res = await fetch("/api/export?type=dispatch")
      if (!res.ok) throw new Error("Failed to fetch data")
      const { data } = await res.json()

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
      const pageW = doc.internal.pageSize.getWidth()
      const date = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })

      // Header
      doc.setFillColor(0, 60, 113)
      doc.rect(0, 0, pageW, 22, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("AXIS MAX LIFE", 14, 10)
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text("Print Project Management System", 14, 16)
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.text("Dispatch & Tracking Report", pageW / 2, 13, { align: "center" })
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.text(`Generated: ${date}`, pageW - 14, 10, { align: "right" })
      doc.text(`Total Records: ${data.length}`, pageW - 14, 16, { align: "right" })

      const head = [["Project ID", "Project Name", "Location", "Courier", "Tracking ID", "Dispatch Date", "Expected Delivery", "Actual Delivery", "Status", "Notes"]]
      const body = data.map((d: {
        project: { projectId: string; name: string; location: string; status: string }
        courier: string; trackingId: string; dispatchDate?: string
        expectedDelivery?: string; actualDelivery?: string; status: string; notes?: string
      }) => [
          d.project.projectId,
          d.project.name.length > 28 ? d.project.name.slice(0, 28) + "…" : d.project.name,
          d.project.location,
          d.courier,
          d.trackingId,
          d.dispatchDate ? new Date(d.dispatchDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
          d.expectedDelivery ? new Date(d.expectedDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
          d.actualDelivery ? new Date(d.actualDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—",
          d.project.status,
          d.notes || "—",
        ])

      autoTable(doc, {
        head, body,
        startY: 28,
        styles: { fontSize: 7.5, cellPadding: 2.5, font: "helvetica", textColor: [30, 41, 59] },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 26, fontStyle: "bold", textColor: [0, 60, 113] },
          1: { cellWidth: 48 },
          2: { cellWidth: 24 },
          3: { cellWidth: 24 },
          4: { cellWidth: 32, fontStyle: "bold", textColor: [8, 145, 178] },
          5: { cellWidth: 26 },
          6: { cellWidth: 26 },
          7: { cellWidth: 26 },
          8: { cellWidth: 24 },
          9: { cellWidth: 36 },
        },
        margin: { left: 14, right: 14 },
      })

      // Footer
      const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        const pageH = doc.internal.pageSize.getHeight()
        doc.setFillColor(248, 250, 252)
        doc.rect(0, pageH - 10, pageW, 10, "F")
        doc.setFontSize(7)
        doc.setTextColor(148, 163, 184)
        doc.setFont("helvetica", "normal")
        doc.text("Axis Max Life Insurance — Confidential", 14, pageH - 4)
        doc.text(`Page ${i} of ${pageCount}`, pageW / 2, pageH - 4, { align: "center" })
        doc.text("axis-print-management.internal", pageW - 14, pageH - 4, { align: "right" })
      }

      doc.save(`Dispatch_Report_${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("Dispatch report downloaded!")
    } catch (err) {
      toast.error("Export failed. Please try again.")
    } finally {
      setExporting(false)
    }
  }


  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {/* Upload Excel */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="btn btn-secondary"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '6px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {uploading ? "Processing..." : "Upload Courier Excel"}
      </button>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />

      {/* Upload Result Modal */}
      {uploadResult && (
        <div
          onClick={() => setUploadResult(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            overflow: 'hidden'
          }}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div
              style={{
                background: uploadResult.errors.length > 0
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                padding: '20px 24px',
                color: '#ffffff'
              }}
            >
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, marginBottom: '4px' }}>
                {uploadResult.errors.length > 0 ? 'Upload Completed with Warnings' : 'Upload Successful'}
              </h2>
              <p style={{ fontSize: '14px', margin: 0, opacity: 0.9 }}>
                {uploadResult.message}
              </p>
            </div>

            {/* Stats */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a' }}>{uploadResult.created}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Created</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: '#eff6ff', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#2563eb' }}>{uploadResult.updated}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Updated</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: '#fef3c7', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#d97706' }}>{uploadResult.skipped}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Skipped</div>
                </div>
              </div>
            </div>

            {/* Errors List - only show if there are errors */}
            {uploadResult.errors.length > 0 && (
              <div style={{ padding: '20px 24px', flex: 1, overflow: 'auto' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
                  Error Details ({uploadResult.errors.length}):
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {uploadResult.errors.map((error, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '12px 16px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px'
                      }}
                    >
                      <svg width="16" height="16" fill="none" stroke="#dc2626" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span style={{ fontSize: '13px', color: '#991b1b', lineHeight: '1.5' }}>{error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setUploadResult(null)}
                style={{
                  padding: '10px 20px',
                  background: '#003c71',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Template */}
      <a
        href="/dispatch-template.xlsx"
        download="dispatch-template.xlsx"
        className="btn btn-secondary"
        style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '6px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Template
      </a>


      {/* Export PDF */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="btn btn-primary"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '6px' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {exporting ? "Exporting..." : "Export PDF"}
      </button>
    </div>
  )
}
