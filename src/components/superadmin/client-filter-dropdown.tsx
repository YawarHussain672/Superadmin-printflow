"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

interface ClientFilterDropdownProps {
  clients: { id: string; companyName: string }[]
  placeholder?: string
}

export function ClientFilterDropdown({ clients, placeholder = "Filter by Admin (All)" }: ClientFilterDropdownProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentClientId = searchParams.get("clientId") || ""

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("clientId", value)
    } else {
      params.delete("clientId")
    }
    params.delete("page") // Reset page when filtering
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={currentClientId}
      onChange={handleChange}
      className="form-select"
      style={{
        minWidth: "220px",
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
      <option value="">{placeholder}</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.companyName}
        </option>
      ))}
    </select>
  )
}
