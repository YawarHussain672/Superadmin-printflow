"use client"

import { useState } from "react"
import { ToggleLeft, ToggleRight } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface StatusToggleButtonProps {
  clientId: string
  initialIsActive: boolean
}

export function StatusToggleButton({ clientId, initialIsActive }: StatusToggleButtonProps) {
  const router = useRouter()
  const [isActive, setIsActive] = useState(initialIsActive)
  const [isToggling, setIsToggling] = useState(false)

  const handleToggle = async () => {
    setIsToggling(true)
    const actionText = isActive ? "deactivate" : "activate"

    try {
      const res = await fetch(`/api/superadmin/clients/${clientId}/toggle`, {
        method: "POST"
      })

      if (res.ok) {
        const data = await res.json()
        setIsActive(data.isActive)
        toast.success(`Client account ${data.isActive ? "activated" : "deactivated"} successfully.`)
        router.refresh() // Refresh the server component to update status badges
      } else {
        const errData = await res.json()
        toast.error(errData.error || `Failed to ${actionText} client.`)
      }
    } catch (err) {
      console.error(err)
      toast.error(`Failed to ${actionText} client.`)
    } finally {
      setIsToggling(false)
    }
  }

  return (
    <button
      className={`btn ${isActive ? "btn-secondary" : "btn-primary"}`}
      onClick={handleToggle}
      disabled={isToggling}
      style={{
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        border: isActive ? "1px solid var(--color-error)" : undefined,
        color: isActive ? "var(--color-error)" : undefined,
        background: isActive ? "rgba(239, 68, 68, 0.05)" : undefined,
      }}
    >
      {isToggling ? (
        <span className="spinner-small"></span>
      ) : isActive ? (
        <>
          <ToggleLeft size={18} />
          Suspend Organization
        </>
      ) : (
        <>
          <ToggleRight size={18} />
          Activate Organization
        </>
      )}

      <style jsx>{`
        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0,0,0,0.1);
          border-top: 2px solid currentColor;
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
