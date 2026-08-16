'use client'

import { Wallet } from 'lucide-react'

/**
 * Page header: title, one-line purpose, and the current credit balance.
 * Purely presentational — the balance is read from the existing profile query.
 */
export function VerifyHeader({ credits }: { credits?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Verify emails
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
          Check deliverability before you send — one address or a whole list.
        </p>
      </div>

      {typeof credits === 'number' && (
        <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-[var(--primary)] px-3.5 py-1.5 text-sm font-medium text-foreground">
          <Wallet className="h-4 w-4 text-[var(--primary)]" />
          <span className="tabular-nums">{credits.toLocaleString()}</span>
          <span className="text-muted-foreground">credits</span>
        </div>
      )}
    </div>
  )
}
