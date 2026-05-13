import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/utils/cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white",
        secondary: "bg-slate-100 text-slate-700",
        destructive: "bg-red-50 text-red-700 ring-1 ring-red-100",
        outline: "border border-slate-200 text-slate-700",
        requested: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
        approved: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
        printing: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
        dispatched: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100",
        delivered: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
        pending: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
        rejected: "bg-red-50 text-red-700 ring-1 ring-red-100",
        draft: "bg-slate-50 text-slate-600 ring-1 ring-slate-100",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
