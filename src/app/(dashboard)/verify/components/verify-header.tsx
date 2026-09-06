'use client'

import { ShieldCheck } from 'lucide-react'

/**
 * Page title block, styled to the Stitch "Email Deliverability Verifier" screen.
 * `children` is the mode switcher, which sits on the right of the title row.
 *
 * The credit balance is intentionally not repeated here — it already lives in
 * the app header. The `credits` prop is kept so the call site is unchanged.
 */
export function VerifyHeader({
  credits: _credits,
  children,
}: {
  credits?: number
  children?: React.ReactNode
}) {
  return (
    <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-gray-200/60 dark:border-white/10">
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 text-brand text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="h-4 w-4" />
          <span>Algorithmic Validation Engine</span>
        </div>
        <h1 className="text-2xl font-bold text-ink dark:text-white tracking-tight">
          Email Deliverability Verifier
        </h1>
        <p className="text-sm text-ink-muted dark:text-gray-400 max-w-2xl font-normal leading-relaxed">
          Test any mailbox against RFC standards, DNS multi-hop MX routing, direct SMTP socket
          handshakes, and bounce probability scores with 99.4% precision.
        </p>
      </div>
      {children}
    </section>
  )
}
