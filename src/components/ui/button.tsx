import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Stitch button spec: 40px default / 36px compact, 8px radius, solid brand
// primary, hairline outline secondary, soft-tint destructive, active scale 0.99.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.99] motion-reduce:transition-none motion-reduce:transform-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-brand/15 focus-visible:border-brand aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-brand text-white shadow-2xs hover:bg-brand-hover",
        destructive:
          "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] shadow-2xs hover:bg-[#FEE2E2] dark:bg-[#DC2626]/15 dark:text-[#F87171] dark:border-[#DC2626]/30",
        outline:
          "border border-gray-200 bg-white text-ink shadow-2xs hover:bg-gray-50 hover:border-gray-300 dark:bg-transparent dark:text-white dark:border-white/10 dark:hover:bg-white/5",
        secondary:
          "bg-secondary text-secondary-foreground shadow-2xs hover:bg-secondary/80",
        ghost:
          "text-[#475569] hover:bg-[#F1F5F9] hover:text-ink dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-9 gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-11 px-6 has-[>svg]:px-4",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
