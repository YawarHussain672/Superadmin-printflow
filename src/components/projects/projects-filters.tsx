"use client"

import { useRouter, usePathname } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, X } from "lucide-react"
import { useCallback, useTransition } from "react"
import { useDebouncedCallback } from "use-debounce"

interface ProjectsFiltersProps {
  pocs: { id: string; name: string }[]
  locations: string[]
  currentParams: { status?: string; poc?: string; location?: string; search?: string }
}

const STATUSES = ["REQUESTED", "APPROVED", "PRINTING", "DISPATCHED", "DELIVERED", "CANCELLED"]

export function ProjectsFilters({ pocs, locations, currentParams }: ProjectsFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams()
    const current = { ...currentParams, [key]: value, page: "1" }
    Object.entries(current).forEach(([k, v]) => {
      if (v && v !== "all") params.set(k, v)
    })
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }, [currentParams, pathname, router])

  const handleSearch = useDebouncedCallback((value: string) => {
    updateParam("search", value)
  }, 400)

  const hasFilters = currentParams.status || currentParams.poc || currentParams.location || currentParams.search

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by ID, name, location, POC..."
          className="pl-10 bg-white"
          defaultValue={currentParams.search || ""}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <Select value={currentParams.poc || "all"} onValueChange={(v) => updateParam("poc", v)}>
        <SelectTrigger className="w-[180px] bg-white"><SelectValue placeholder="All POCs" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All POCs</SelectItem>
          {pocs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={currentParams.status || "all"} onValueChange={(v) => updateParam("status", v)}>
        <SelectTrigger className="w-[160px] bg-white"><SelectValue placeholder="All Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={currentParams.location || "all"} onValueChange={(v) => updateParam("location", v)}>
        <SelectTrigger className="w-[160px] bg-white"><SelectValue placeholder="All Locations" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Locations</SelectItem>
          {locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
        </SelectContent>
      </Select>

      {hasFilters && (
        <button
          onClick={() => router.push(pathname)}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}
    </div>
  )
}
