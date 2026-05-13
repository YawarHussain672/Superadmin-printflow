"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"

// SVG Icons
const UploadIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
)

const FileIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const DownloadIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const LoaderIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" className="animate-spin">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

interface FileUploadButtonProps {
  projectId: string
  fileType: "PO" | "CHALLAN" | "INVOICE"
  label: string
  existingFiles: { id: string; filename: string; url: string; size?: number | null; uploadedAt?: string | null }[]
  isAdmin?: boolean
  canUpload?: boolean
  canDelete?: boolean
}

export function FileUploadButton({ projectId, fileType, label, existingFiles, isAdmin, canUpload, canDelete }: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const showUpload = canUpload ?? isAdmin
  const showDelete = canDelete ?? isAdmin

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp",
      "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF, images, and Excel files are allowed")
      return
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB")
      return
    }

    setUploading(true)
    setProgress(10)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("projectId", projectId)
      formData.append("fileType", fileType)

      setProgress(40)

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      setProgress(90)

      if (!res.ok) {
        const text = await res.text()
        let errorMessage = "Upload failed"
        try {
          const err = JSON.parse(text)
          errorMessage = err.error || "Upload failed"
        } catch {
          // If not JSON, use status text or first part of HTML
          errorMessage = res.statusText || "Upload failed"
        }
        throw new Error(errorMessage)
      }

      setProgress(100)
      toast.success(`${label} uploaded successfully!`)
      // Force page refresh to get updated file list from server
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      setProgress(0)
      // Reset input so same file can be re-uploaded
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="doc-section" style={{ background: 'var(--gray-50)', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ fontWeight: 700, fontSize: '14px', color: 'var(--gray-900)' }}>{label}</h4>
        {showUpload && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="doc-upload-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: 'var(--axis-primary)',
                color: 'white',
                fontSize: '13px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                opacity: uploading ? 0.6 : 1,
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.background = '#002a52' }}
              onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.background = 'var(--axis-primary)' }}
            >
              {uploading ? <LoaderIcon /> : <UploadIcon />}
              {uploading ? "Uploading..." : `Upload ${fileType}`}
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      {/* Progress bar */}
      {uploading && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ height: '6px', background: 'var(--gray-200)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: 'var(--axis-primary)',
                borderRadius: '3px',
                transition: 'width 0.3s',
                width: `${progress}%`
              }}
            />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '4px' }}>{progress}% uploaded</p>
        </div>
      )}

      {/* Existing files */}
      {existingFiles.length > 0 ? (
        <div>
          {existingFiles.map((f) => (
            <div
              key={f.id}
              className="doc-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'var(--gray-0)',
                borderRadius: '6px',
                border: '1px solid var(--gray-200)',
                marginTop: '8px'
              }}
            >
              <div className="doc-info" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="doc-icon" style={{
                  width: '36px',
                  height: '36px',
                  background: 'var(--axis-primary)',
                  color: 'white',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '12px'
                }}>
                  PDF
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--gray-900)' }}>{f.filename}</div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
                    Uploaded: {new Date(f.uploadedAt || '').toLocaleDateString()} • {f.size ? `${(f.size / 1024).toFixed(0)} KB` : ''}
                  </div>
                </div>
              </div>
              <div className="doc-actions" style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={async () => {
                    try {
                      toast.loading("Downloading...", { id: `download-${f.id}` })
                      const res = await fetch(`/api/files/${f.id}/download`)

                      if (!res.ok) {
                        const errorText = await res.text()
                        throw new Error(errorText || "Download failed")
                      }

                      const contentType = res.headers.get("content-type")
                      if (contentType && contentType.includes("application/json")) {
                        const errorData = await res.json()
                        throw new Error(errorData.error || "Download failed")
                      }

                      const blob = await res.blob()
                      const url = window.URL.createObjectURL(blob)

                      const a = document.createElement("a")
                      a.href = url
                      a.download = f.filename
                      a.style.display = "none"
                      document.body.appendChild(a)
                      a.click()

                      setTimeout(() => {
                        window.URL.revokeObjectURL(url)
                        document.body.removeChild(a)
                      }, 100)

                      toast.success("Downloaded!", { id: `download-${f.id}` })
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Download failed", { id: `download-${f.id}` })
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                  title="Download file"
                >
                  <DownloadIcon />
                </button>
                {showDelete && (
                  <button
                    onClick={async () => {
                      if (!confirm("Are you sure you want to delete this file?")) return
                      setDeleting(f.id)
                      try {
                        const res = await fetch(`/api/files/${f.id}`, { method: "DELETE" })
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}))
                          throw new Error(data.error || "Delete failed")
                        }
                        toast.success("File deleted")
                        window.location.reload()
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to delete file")
                      } finally {
                        setDeleting(null)
                      }
                    }}
                    disabled={deleting === f.id}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--color-error)' }}
                    title="Delete"
                  >
                    {deleting === f.id ? <LoaderIcon /> : <TrashIcon />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--gray-500)', fontSize: '13px' }}>
          No documents uploaded
        </p>
      )}
    </div>
  )
}
