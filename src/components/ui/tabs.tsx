"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Stitch segmented control: tinted track, 1px hairline, 12px radius.
      "inline-flex items-center justify-center gap-1 rounded-xl bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 p-1 text-ink-muted w-fit",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Active tab lifts to a white surface with brand text, per Stitch.
      "inline-flex items-center gap-2 justify-center whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-brand/15 disabled:pointer-events-none disabled:opacity-50 text-ink-muted hover:text-ink dark:hover:text-white data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-brand dark:data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:shadow-2xs",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }