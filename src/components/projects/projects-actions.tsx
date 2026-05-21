"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, Pencil, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { EditProjectDialog } from "./edit-project-dialog"

// Global event for project deleted (syncs with projects-page-client)
const PROJECT_DELETED_EVENT = "project-deleted"

interface Project {
  id: string
  name: string
  projectId: string
  pocId: string
  clientId: string
  location: string
  state: string
  branch: string
  deliveryDate: string | null
  instructions: string | null
  status: string
  collaterals: { id: string; itemName: string; quantity: number; unitPrice: number; totalPrice: number }[]
  dispatch?: {
    courier: string
    trackingId: string
  } | null
  piNumber?: string | null
}

interface ProjectsActionsProps {
  projectId: string
  project?: Project
  isAdmin?: boolean
}

export function ProjectsActions({ projectId, project: initialProject, isAdmin = false }: ProjectsActionsProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [project, setProject] = useState<Project | null>(initialProject || null)
  const [isLoadingProject, setIsLoadingProject] = useState(false)

  const handleEditClick = async () => {
    if (!project) {
      // Fetch project data if not provided
      setIsLoadingProject(true)
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (res.ok) {
          const data = await res.json()
          setProject(data)
          setEditDialogOpen(true)
        } else {
          toast.error("Failed to load project data")
        }
      } catch {
        toast.error("Network error")
      } finally {
        setIsLoadingProject(false)
      }
    } else {
      setEditDialogOpen(true)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Project deleted")
        // Notify all components that a project was deleted
        window.dispatchEvent(new CustomEvent(PROJECT_DELETED_EVENT))
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to delete project")
      }
    } catch {
      toast.error("Network error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-0.5">
        <Link href={`/projects/${projectId}`}>
          <button className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <Eye className="h-4 w-4" />
          </button>
        </Link>
        <button
          onClick={handleEditClick}
          disabled={isLoadingProject}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
        >
          {isLoadingProject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Edit Project Dialog */}
      {project && (
        <EditProjectDialog
          project={project}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          isAdmin={isAdmin}
          onSuccess={async (shouldRegeneratePI) => {
            router.refresh()
            if (shouldRegeneratePI && project?.id) {
              toast.success("PI regenerated automatically after project update.")
            }
          }}
        />
      )}
    </>
  )
}
