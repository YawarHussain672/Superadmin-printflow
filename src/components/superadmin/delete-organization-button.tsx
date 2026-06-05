"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface DeleteOrganizationButtonProps {
  clientId: string
  companyName: string
}

export function DeleteOrganizationButton({ clientId, companyName }: DeleteOrganizationButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete the organization "${companyName}"? This will delete all users, projects, and files associated with it.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/superadmin/clients/${clientId}`, {
        method: "DELETE"
      })

      if (res.ok) {
        toast.success(`Organization "${companyName}" deleted successfully.`)
        router.push("/superadmin/admins")
        router.refresh()
      } else {
        const errData = await res.json()
        toast.error(errData.error || "Failed to delete organization.")
      }
    } catch (err) {
      console.error(err)
      toast.error("Failed to delete organization.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button
      className="btn"
      onClick={handleDelete}
      disabled={isDeleting}
      style={{
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        border: "1px solid #ef4444",
        color: "white",
        background: "#ef4444",
        cursor: "pointer",
        borderRadius: "6px",
        fontSize: "14px",
        fontWeight: 500
      }}
    >
      {isDeleting ? (
        <span className="spinner-small"></span>
      ) : (
        <>
          <Trash2 size={18} />
          Delete Organization
        </>
      )}

      <style jsx>{`
        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  )
}
