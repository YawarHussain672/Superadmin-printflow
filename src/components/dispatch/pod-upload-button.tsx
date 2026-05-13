"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, Loader2, Download, CheckCircle } from "lucide-react"
import { toast } from "sonner"

interface PodUploadButtonProps {
  dispatchId: string
  podUrl: string | null
}

export function PodUploadButton({ dispatchId, podUrl }: PodUploadButtonProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB")
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`/api/dispatch/${dispatchId}/pod`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        toast.success("POD uploaded successfully!")
        router.refresh()
      } else {
        const text = await res.text()
        let errorMessage = "Upload failed"
        try {
          const data = JSON.parse(text)
          errorMessage = data.error || "Upload failed"
        } catch {
          errorMessage = res.statusText || "Upload failed"
        }
        toast.error(errorMessage)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  if (podUrl) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-green-600 font-semibold text-sm">
          <CheckCircle className="h-4 w-4" />
          Available
        </span>
        <button
          onClick={async () => {
            try {
              const res = await fetch(`/api/dispatch/${dispatchId}/pod/view`)
              if (!res.ok) throw new Error("Download failed")
              const blob = await res.blob()
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `POD_${dispatchId}.pdf`
              document.body.appendChild(a)
              a.click()
              window.URL.revokeObjectURL(url)
              document.body.removeChild(a)
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Download failed")
            }
          }}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm"
          title="Download POD"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="h-7 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        {uploading ? "Uploading..." : "Upload POD"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleUpload}
      />
    </>
  )
}
