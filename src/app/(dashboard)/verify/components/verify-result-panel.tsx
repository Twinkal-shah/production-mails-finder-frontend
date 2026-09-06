'use client'

import { useState } from 'react'
import { Check, Copy, Minus, X, Loader2, ShieldCheck, MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { humanizeVerificationReason } from '@/lib/api-error'

export interface VerifyResultView {
  status: string
  reason?: string
  error?: string
  isCatchAllDomain?: boolean
  notice?: string
}

const NOT_REPORTED = 'Not reported'

/* ----------------------------- field readers ----------------------------- */

function readString(raw: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!raw) return undefined
  for (const k of keys) {
    const v = raw[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (Array.isArray(v) && v.length && typeof v[0] === 'string') return (v[0] as string).trim()
  }
  return undefined
}
function readBool(raw: Record<string, unknown> | null, keys: string[]): boolean | undefined {
  if (!raw) return undefined
  for (const k of keys) {
    const v = raw[k]
    if (typeof v === 'boolean') return v
  }
  return undefined
}
function readNumber(raw: Record<string, unknown> | null, keys: string[]): number | undefined {
  if (!raw) return undefined
  for (const k of keys) {
    const v = raw[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

/**
 * humanizeVerificationReason returns the raw text when it has no rule for a
 * code, which surfaces machine tokens like "accepted_email". Fall back to a
 * plain sentence in that case rather than showing the token to the user.
 */
function readableReason(reason: string | undefined, fallback: string): string {
  if (!reason) return fallback
  const humanized = humanizeVerificationReason(reason, fallback)
  const looksMachine = /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(humanized.trim())
  return looksMachine ? fallback : humanized
}

type CheckState = 'pass' | 'fail' | 'unknown'

function DiagnosticItem({
  state,
  title,
  detail,
}: {
  state: CheckState
  title: string
  detail: string
}) {
  const tone =
    state === 'pass'
      ? {
          wrap: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/15 dark:border-emerald-500/30',
          icon: <Check className="h-3 w-3" />,
          detailCls: 'text-emerald-700 dark:text-emerald-400 font-semibold',
        }
      : state === 'fail'
        ? {
            wrap: 'bg-red-50 text-[#DC2626] border-red-200 dark:bg-red-500/15 dark:border-red-500/30',
            icon: <X className="h-3 w-3" />,
            detailCls: 'text-[#DC2626] dark:text-red-400 font-semibold',
          }
        : {
            wrap: 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/5 dark:border-white/10',
            icon: <Minus className="h-3 w-3" />,
            detailCls: 'text-gray-400',
          }

  return (
    <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-start gap-2.5">
      <div
        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${tone.wrap}`}
      >
        {tone.icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-semibold text-ink dark:text-white">{title}</span>
        <span className={`font-mono-code text-[11px] truncate ${tone.detailCls}`}>{detail}</span>
      </div>
    </div>
  )
}

/** Circular deliverability gauge, matching the Stitch dial. */
function ScoreDial({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-3 bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3.5 py-2 rounded-xl self-start sm:self-auto shrink-0">
      <div className="relative w-12 h-12 flex items-center justify-center">
        <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E2E8F0" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="#B71D40"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0, Math.min(100, score))}, 100`}
          />
        </svg>
        <span className="absolute font-mono-code font-bold text-xs text-ink dark:text-white">
          {score}
        </span>
      </div>
      <div className="flex flex-col">
        <span className="font-bold text-sm text-ink dark:text-white leading-tight">{score} / 100</span>
        <span className="text-[11px] text-gray-400">Deliverability</span>
      </div>
    </div>
  )
}

export function VerifyResultPanel({
  email,
  result,
  raw,
  isVerifying,
}: {
  email: string
  result: VerifyResultView | null
  raw: Record<string, unknown> | null
  isVerifying: boolean
}) {
  const [copied, setCopied] = useState(false)

  /* ------------------------------ empty states ------------------------------ */
  if (isVerifying) {
    return (
      <div className="w-full min-h-[420px] bg-white dark:bg-[#1a1a1a] p-10 rounded-xl border border-gray-200 dark:border-white/10 shadow-card flex flex-col items-center justify-center text-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
        <p className="text-sm font-medium text-ink dark:text-white">Probing mailbox…</p>
        <p className="text-xs text-gray-400">Running syntax, MX and SMTP checks.</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="w-full min-h-[420px] bg-white dark:bg-[#1a1a1a] p-12 rounded-xl border border-gray-200 dark:border-white/10 shadow-card flex flex-col items-center justify-center text-center gap-2">
        <span className="h-12 w-12 rounded-full bg-[#F1F5F9] dark:bg-white/5 text-gray-400 flex items-center justify-center">
          <MailCheck className="h-6 w-6" />
        </span>
        <p className="text-sm font-semibold text-ink dark:text-white">No verification run yet</p>
        <p className="text-xs text-gray-400 max-w-xs">
          Enter a mailbox address and run a check — the full diagnostics report appears here.
        </p>
      </div>
    )
  }

  /* -------------------------------- real data -------------------------------- */
  const status = (result.status || '').toLowerCase()
  const isValid = status === 'valid'
  const isCatchAll = result.isCatchAllDomain === true || status === 'catch_all' || status === 'catchall'
  const isRisky = status === 'risky' || isCatchAll
  const isInvalid = status === 'invalid'

  const mx = readString(raw, ['mx', 'mx_record', 'mx_host', 'mx_server'])
  const disposable = readBool(raw, ['disposable', 'is_disposable', 'is_disposable_email'])
  const honeypot = readBool(raw, ['honeypot', 'spam_trap', 'is_spam_trap', 'trap'])
  const catchAllFlag = readBool(raw, ['catch_all', 'is_catch_all_domain']) ?? isCatchAll
  const timeExec = readNumber(raw, ['time_exec', 'duration_ms', 'elapsed_ms'])
  const rawScore = readNumber(raw, ['confidence_score', 'score', 'quality_score'])
  const score =
    typeof rawScore === 'number' ? (rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore)) : null

  const syntaxOk = !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const reasonText = readableReason(result.reason, '')

  const checks: Array<{ state: CheckState; title: string; detail: string }> = [
    {
      state: syntaxOk ? 'pass' : 'fail',
      title: 'RFC Syntax Check',
      detail: syntaxOk ? 'Valid standard compliant' : 'Malformed address',
    },
    {
      state: mx ? 'pass' : 'unknown',
      title: 'Domain & MX Records',
      detail: mx || NOT_REPORTED,
    },
    {
      state: isValid ? 'pass' : isInvalid ? 'fail' : 'unknown',
      title: 'SMTP Handshake',
      detail: isValid
        ? '250 OK Mailbox Exists'
        : isInvalid
          ? reasonText || 'Rejected by mail server'
          : reasonText || NOT_REPORTED,
    },
    {
      state: catchAllFlag === undefined ? 'unknown' : catchAllFlag ? 'fail' : 'pass',
      title: 'Catch-all Domain',
      detail:
        catchAllFlag === undefined
          ? NOT_REPORTED
          : catchAllFlag
            ? 'Yes (Accepts All)'
            : 'No (Explicit Destination)',
    },
    {
      state: disposable === undefined ? 'unknown' : disposable ? 'fail' : 'pass',
      title: 'Disposable Provider',
      detail:
        disposable === undefined ? NOT_REPORTED : disposable ? 'Yes (Temporary inbox)' : 'No (Corporate Domain)',
    },
    {
      state: honeypot === undefined ? 'unknown' : honeypot ? 'fail' : 'pass',
      title: 'Honeypot & Trap Check',
      detail: honeypot === undefined ? NOT_REPORTED : honeypot ? 'Trap detected' : 'Clean (0 list incidents)',
    },
  ]

  const passedCount = checks.filter((c) => c.state === 'pass').length

  const badge = isValid
    ? {
        cls: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
        dot: 'bg-emerald-500',
        label: 'Deliverable (Safe to Send)',
      }
    : isRisky
      ? {
          cls: 'bg-[#FFFBEB] border-[#FDE68A] text-[#D97706] dark:bg-[#D97706]/15 dark:border-[#D97706]/30 dark:text-[#FBBF24]',
          dot: 'bg-[#D97706]',
          label: isCatchAll ? 'Catch-all (Unconfirmed)' : 'Risky (Send with caution)',
        }
      : isInvalid
        ? {
            cls: 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626] dark:bg-[#DC2626]/15 dark:border-[#DC2626]/30 dark:text-red-400',
            dot: 'bg-[#DC2626]',
            label: 'Undeliverable (Do Not Send)',
          }
        : {
            cls: 'bg-[#F1F5F9] border-gray-200 text-[#475569] dark:bg-white/5 dark:border-white/10 dark:text-gray-300',
            dot: 'bg-[#94A3B8]',
            label: 'Unknown (Inconclusive)',
          }

  return (
    <div className="w-full bg-white dark:bg-[#1a1a1a] p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-card flex flex-col gap-6">
      {/* Result header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-white/10">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-lg sm:text-xl font-bold text-ink dark:text-white break-all font-mono-code">
              {email}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold shrink-0 ${badge.cls}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
              {badge.label}
            </span>
            <button
              type="button"
              title="Copy result"
              onClick={() => {
                navigator.clipboard?.writeText(email)
                setCopied(true)
                toast.success('Email copied to clipboard')
                window.setTimeout(() => setCopied(false), 1500)
              }}
              className="text-gray-400 hover:text-brand transition-colors shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <span className="text-xs text-gray-400">
            {typeof timeExec === 'number'
              ? `Validated via direct SMTP probe in ${Math.round(timeExec)}ms`
              : 'Validated via direct SMTP probe'}
          </span>
        </div>

        {score !== null && <ScoreDial score={score} />}
      </div>

      {/* Catch-all notice */}
      {isCatchAll && (
        <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] dark:bg-[#D97706]/10 dark:border-[#D97706]/30 p-3">
          <p className="text-[13px] leading-5 text-[#92400E] dark:text-[#FBBF24]">
            {result.notice ||
              "This domain accepts any email address, so we can't confirm if this specific address is real. Treat with caution before sending."}
          </p>
        </div>
      )}

      {/* Technical diagnostics */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-ink-muted tracking-wider uppercase">
            Technical Diagnostics Checklist
          </span>
          <span className="text-[11px] font-mono-code text-emerald-600 font-medium shrink-0">
            {passedCount}/{checks.length} Passed
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {checks.map((c) => (
            <DiagnosticItem key={c.title} {...c} />
          ))}
        </div>
      </div>

      {/* Plain-language summary */}
      <div className="verification-result flex items-start gap-2.5 rounded-lg bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 p-3.5">
        <ShieldCheck className="h-4 w-4 text-brand mt-0.5 shrink-0" />
        <p className="text-[13px] leading-5 text-gray-600 dark:text-gray-300">
          {readableReason(
            result.reason,
            isValid
              ? 'Email is valid and deliverable.'
              : isCatchAll
                ? 'Domain accepts all emails — deliverability cannot be confirmed.'
                : isRisky
                  ? 'Email appears risky (catch-all or uncertain).'
                  : isInvalid
                    ? 'Email does not exist or cannot receive messages.'
                    : 'Verification completed. Status is unknown.'
          )}
        </p>
      </div>
    </div>
  )
}
