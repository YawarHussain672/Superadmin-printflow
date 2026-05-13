"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Edit, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface EditDispatchDialogProps {
  projectId: string
  dispatch: {
    dispatchDate: string | null
    courier: string
    trackingId: string
    expectedDelivery: string | null
  }
}

export function EditDispatchDialog({ projectId, dispatch }: EditDispatchDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    dispatchDate: dispatch.dispatchDate ? new Date(dispatch.dispatchDate).toISOString().split("T")[0] : "",
    courier: dispatch.courier,
    trackingId: dispatch.trackingId,
    expectedDelivery: dispatch.expectedDelivery ? new Date(dispatch.expectedDelivery).toISOString().split("T")[0] : "",
  })

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dispatch/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispatchDate: form.dispatchDate || null,
          courier: form.courier,
          trackingId: form.trackingId,
          expectedDelivery: form.expectedDelivery || null,
        }),
      })

      if (res.ok) {
        toast.success("Dispatch information updated!")
        setOpen(false)
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Edit className="h-4 w-4 mr-1" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Dispatch Information</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Courier Partner</Label>
              <Input
                value={form.courier}
                onChange={(e) => setForm({ ...form, courier: e.target.value })}
                placeholder="Blue Dart"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tracking Number</Label>
              <Input
                value={form.trackingId}
                onChange={(e) => setForm({ ...form, trackingId: e.target.value })}
                placeholder="BD123456789"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dispatch Date</Label>
              <Input
                type="date"
                value={form.dispatchDate}
                onChange={(e) => setForm({ ...form, dispatchDate: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expected Delivery</Label>
              <Input
                type="date"
                value={form.expectedDelivery}
                onChange={(e) => setForm({ ...form, expectedDelivery: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} size="sm">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
