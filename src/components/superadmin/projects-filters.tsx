"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { useDebounce } from "use-debounce"

export function ProjectsFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [status, setStatus] = useState(searchParams.get("status") || "")
  const [debouncedSearch] = useDebounce(search, 300)

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (debouncedSearch) {
      params.set("search", debouncedSearch)
    } else {
      params.delete("search")
    }
    params.delete("page") // Reset to page 1
    router.push(`${pathname}?${params.toString()}`)
  }, [debouncedSearch])

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setStatus(val)
    const params = new URLSearchParams(searchParams.toString())
    if (val) {
      params.set("status", val)
    } else {
      params.delete("status")
    }
    params.delete("page") // Reset to page 1
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
      {/* Search Input */}
      <div style={{ width: "320px", position: "relative" }}>
        <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--gray-400)" }}>
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Search by ID, name, location, POC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px 10px 40px",
            border: "1px solid var(--gray-200)",
            borderRadius: "8px",
            fontSize: "14px",
            outline: "none",
            fontFamily: "var(--font-sans)",
          }}
        />
      </div>

      {/* Status Selector */}
      <div style={{ minWidth: "180px" }}>
        <select
          value={status}
          onChange={handleStatusChange}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid var(--gray-200)",
            borderRadius: "8px",
            fontSize: "14px",
            outline: "none",
            fontFamily: "var(--font-sans)",
            backgroundColor: "white",
            cursor: "pointer"
          }}
        >
          <option value="">All Statuses</option>
          <option value="REQUESTED">Requested</option>
          <option value="APPROVED">Approved</option>
          <option value="PRINTING">Printing</option>
          <option value="DISPATCHED">Dispatched</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>
    </div>
  )
}
