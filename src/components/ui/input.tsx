import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Stitch input spec: 40px tall, white surface, 1px #E2E8F0 border,
        // 8px radius, brand focus ring at 15% opacity.
        "file:text-foreground placeholder:text-gray-400 selection:bg-brand selection:text-white flex h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-white dark:bg-white/5 dark:border-white/10 px-3 py-1 text-sm transition-[color,box-shadow,border-color] duration-200 ease-out outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-brand/15",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
