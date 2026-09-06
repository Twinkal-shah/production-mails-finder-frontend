import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Stitch pill badge: 24px tall, 10px horizontal padding, full radius,
// 11px label at weight 600.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 h-6 rounded-full border px-2.5 text-[11px] font-semibold leading-none whitespace-nowrap transition-colors focus:outline-none focus:ring-[3px] focus:ring-brand/15",
  {
    variants: {
      variant: {
        default:
          "border-brand-border bg-brand-light text-brand dark:bg-brand/15 dark:border-brand/30",
        secondary:
          "border-gray-200 bg-[#F1F5F9] text-[#475569] dark:bg-white/5 dark:border-white/10 dark:text-gray-300",
        destructive:
          "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] dark:bg-[#DC2626]/15 dark:border-[#DC2626]/30 dark:text-[#F87171]",
        outline: "border-gray-200 text-[#475569] dark:border-white/10 dark:text-gray-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }