'use client'

import { Coins } from 'lucide-react'
import { useUserProfile } from '@/hooks/useCreditsData'
import { spendableTodayOf } from '@/lib/plans'
import { cn } from '@/lib/utils'

/**
 * Remaining credits for the day, shown once a bulk list has parsed cleanly
 * and before the user starts processing.
 *
 * Read-only. The figure comes from `useUserProfile` — the same react-query
 * entry (`['userProfile']`) that `DashboardLayout` already mounts on every
 * dashboard route, so this is a cache read and issues no request of its own.
 * Nothing here spends, reserves or recalculates credits; the number is
 * whatever `spendableTodayOf` reports from the existing profile payload.
 *
 * Finding and verification are funded from one shared balance, so both flows
 * render this identically.
 */
export function BulkCreditsNotice({ className }: { className?: string }) {
  const { data: profile, isLoading } = useUserProfile()

  // No valid figure — render nothing rather than a misleading zero.
  if (isLoading || !profile) return null
  const remaining = spendableTodayOf(profile)
  if (remaining === null) return null

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3 dark:bg-white/[0.03]',
        className
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand dark:bg-brand/15"
      >
        <Coins className="h-3.5 w-3.5" />
      </span>
      <p className="text-sm font-semibold text-foreground">
        <span className="tabular-nums">{remaining.toLocaleString()}</span> credits remaining today
      </p>
    </div>
  )
}
