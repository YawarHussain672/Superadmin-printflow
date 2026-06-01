"use client"

import { useState } from "react"

export function MaterialCell({ materials }: { materials: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  if (!materials || materials.length === 0) return <span>—</span>
  
  // Group duplicate materials to make it extremely compact
  const counts: Record<string, number> = {}
  materials.forEach(m => {
    if (m) {
      counts[m] = (counts[m] || 0) + 1
    }
  })
  
  const uniqueMaterials = Object.entries(counts).map(([name, count]) => {
    return count > 1 ? `${name} (x${count})` : name
  })
  
  const hasMore = uniqueMaterials.length > 3
  const displayed = isExpanded ? uniqueMaterials : uniqueMaterials.slice(0, 3)
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '130px' }}>
      {displayed.map((text, idx) => (
        <div 
          key={idx} 
          style={{ 
            fontSize: '11px', 
            lineHeight: '1.3', 
            color: '#475569', // gray-700
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            backgroundColor: '#f1f5f9', // gray-100
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid #e2e8f0', // gray-200
            width: 'fit-content'
          }}
        >
          {text}
        </div>
      ))}

      
      {hasMore && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#00a8cc',
            fontSize: '11px',
            fontWeight: 700,
            cursor: 'pointer',
            padding: '2px 6px',
            marginTop: '2px',
            display: 'block',
            textAlign: 'left',
            width: 'fit-content'
          }}
        >
          {isExpanded ? "view less" : "view more"}
        </button>
      )}
    </div>
  )
}
