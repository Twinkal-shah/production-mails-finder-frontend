'use client'

import { AtSign, Check, Loader2, SearchCheck, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SingleVerifyResult {
  status: string
  reason?: string
  error?: string
  isCatchAllDomain?: boolean
  notice?: string
}

/** Checks the verifier runs on every lookup, per the Stitch design. */
const ACTIVE_PROTOCOLS = [
  'RFC 5321/5322 Check',
  'DNSBL Honeypot Scan',
  'MX Priority Lookup',
  'Greylist Protection',
]

/**
 * Stitch "Target Mailbox" input card.
 *
 * Input-only — the verification report is rendered by VerifyResultPanel in the
 * right-hand column. The submit behaviour is unchanged.
 */
export function SingleVerifyPanel({
  email,
  onEmailChange,
  onVerify,
  isVerifying,
  className,
}: {
  email: string
  onEmailChange: (value: string) => void
  onVerify: () => void
  isVerifying: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-[#1a1a1a] p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-card flex flex-col gap-5',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 flex items-center justify-center text-brand">
            <SearchCheck className="h-[18px] w-[18px]" />
          </div>
          <span className="font-bold text-sm text-ink dark:text-white">Target Mailbox</span>
        </div>
        <span className="text-[11px] font-medium text-ink-muted bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded-full font-mono-code shrink-0">
          1 credit / lookup
        </span>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!isVerifying && email) onVerify()
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="single-email" className="text-xs font-medium text-ink-muted">
            Enter target mailbox address
          </label>
          <div className="relative flex items-center">
            <AtSign className="h-[18px] w-[18px] text-ink-muted absolute left-3.5 pointer-events-none" />
            <input
              id="single-email"
              type="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              disabled={isVerifying}
              className="w-full h-11 pl-10 pr-3 bg-white dark:bg-white/5 text-sm text-ink dark:text-white placeholder:text-gray-400 rounded-lg border border-gray-200 dark:border-white/10 shadow-2xs outline-none transition-all focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-60"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-ink-muted gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Direct MX Port 25 Connection</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isVerifying || !email}
          className="w-full h-11 bg-brand hover:bg-brand-hover text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 shadow-2xs transition-all duration-150 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
        >
          {isVerifying ? (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
              <span>Verifying…</span>
            </>
          ) : (
            <>
              <ShieldCheck className="h-[18px] w-[18px]" />
              <span>Verify Deliverability</span>
            </>
          )}
        </button>
      </form>

      {/* Active protocols */}
      <div className="bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 p-3.5 rounded-lg flex flex-col gap-2">
        <span className="text-[11px] font-semibold text-ink dark:text-white uppercase tracking-wider">
          Active Protocols
        </span>
        <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted">
          {ACTIVE_PROTOCOLS.map((p) => (
            <div key={p} className="flex items-center gap-1.5 min-w-0">
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
