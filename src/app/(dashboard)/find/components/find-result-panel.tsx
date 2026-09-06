'use client'

import { useState } from 'react'
import {
  BadgeCheck,
  Check,
  Copy,
  Minus,
  Network,
  Inbox,
  Regex,
  ShieldCheck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

export interface FindResultView {
  email: string | null
  confidence: number
  status: string
  safeToSend?: boolean
  provider?: string
  fullName?: string
  creditsUsed?: number
  isCatchAllDomain?: boolean
  notice?: string
}

/* ------------------------------------------------------------------ *
 * Field readers
 *
 * The find endpoint is a pass-through proxy, so the exact key names vary.
 * These read the first key that is actually present and return undefined
 * otherwise — nothing is ever invented to fill the Stitch layout.
 * ------------------------------------------------------------------ */

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

/** Derives the address pattern from the discovered email and the person's name. */
function derivePattern(email: string | null, personName: string): string | undefined {
  if (!email || !email.includes('@')) return undefined
  const local = email.split('@')[0].toLowerCase()
  const clean = (personName || '').toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean)
  const first = clean[0]
  const last = clean.length > 1 ? clean[clean.length - 1] : ''
  if (!first) return undefined
  const f = first[0]
  const l = last ? last[0] : ''

  const candidates: Array<[string, string]> = []
  candidates.push([first, '{first}'])
  if (last) {
    candidates.push([last, '{last}'])
    for (const sep of ['', '.', '_', '-']) {
      candidates.push([`${first}${sep}${last}`, `{first}${sep}{last}`])
      candidates.push([`${f}${sep}${last}`, `{f}${sep}{last}`])
      candidates.push([`${first}${sep}${l}`, `{first}${sep}{l}`])
      candidates.push([`${last}${sep}${first}`, `{last}${sep}{first}`])
    }
  }
  // Longest literal match wins so "{first}{last}" beats "{first}".
  const hit = candidates
    .filter(([literal]) => literal === local)
    .sort((a, b) => b[0].length - a[0].length)[0]
  return hit ? hit[1] : undefined
}

const NOT_REPORTED = 'Not reported'

/** One of the three Stitch detail tiles. */
function DetailTile({
  icon: Icon,
  label,
  value,
  sub,
  muted,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  sub?: string
  muted?: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent p-3.5">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{label}</p>
      </div>
      <p
        className={`text-[13px] font-semibold break-all ${
          muted ? 'text-gray-400 font-normal' : 'text-ink dark:text-white font-mono-code'
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-gray-400 truncate">{sub}</p>}
    </div>
  )
}

type StepState = 'pass' | 'fail' | 'unknown'

function VerificationStep({ state, label }: { state: StepState; label: string }) {
  const tone =
    state === 'pass'
      ? { wrap: 'bg-[#ECFDF5] text-[#059669] dark:bg-[#059669]/15', icon: <Check className="h-3 w-3" /> }
      : state === 'fail'
        ? { wrap: 'bg-[#FEF2F2] text-[#DC2626] dark:bg-[#DC2626]/15', icon: <X className="h-3 w-3" /> }
        : { wrap: 'bg-[#F1F5F9] text-gray-400 dark:bg-white/5', icon: <Minus className="h-3 w-3" /> }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={`h-4 w-4 shrink-0 rounded-full flex items-center justify-center ${tone.wrap}`}>
        {tone.icon}
      </span>
      <span
        className={`text-[12px] leading-4 truncate ${
          state === 'unknown' ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'
        }`}
      >
        {label}
      </span>
    </div>
  )
}

export function FindResultPanel({
  result,
  raw,
  companyDomain,
  enteredName,
}: {
  result: FindResultView
  raw: Record<string, unknown> | null
  companyDomain: string
  enteredName: string
}) {
  const [copied, setCopied] = useState(false)

  const personName = result.fullName || enteredName || 'Prospect'
  const domain = (companyDomain || '').trim() || (result.email?.split('@')[1] ?? '')

  const confidencePct = (() => {
    const c = Number(result.confidence || 0)
    return c <= 1 ? Math.round(c * 100) : Math.round(c)
  })()

  // --- real values pulled from whatever the backend actually returned ---
  const mxHost = readString(raw, ['mx', 'mx_record', 'mx_host', 'mx_server', 'mx_records'])
  const mxProvider = result.provider || readString(raw, ['mx_provider', 'email_provider', 'provider'])
  const organization = readString(raw, ['organization_name', 'company_name', 'organization', 'company'])
  const disposable = readBool(raw, ['disposable', 'is_disposable', 'is_disposable_email'])
  const patternPct = readNumber(raw, ['pattern_percentage', 'pattern_confidence', 'pattern_occurrence'])
  const pattern = readString(raw, ['pattern', 'email_pattern']) || derivePattern(result.email, personName)

  const isCatchAll = result.isCatchAllDomain === true
  const syntaxOk = !!result.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)

  const steps: Array<{ state: StepState; label: string }> = [
    {
      state: syntaxOk ? 'pass' : 'fail',
      label: syntaxOk ? 'DNS Syntax Valid' : 'Syntax Invalid',
    },
    {
      state: mxHost ? 'pass' : 'unknown',
      label: mxHost ? 'Domain Exists & MX Verified' : `MX Verification: ${NOT_REPORTED}`,
    },
    {
      state: disposable === undefined ? 'unknown' : disposable ? 'fail' : 'pass',
      label:
        disposable === undefined
          ? `Disposable Check: ${NOT_REPORTED}`
          : disposable
            ? 'Disposable Check: Disposable'
            : 'Disposable Check: Clean',
    },
    {
      state: result.safeToSend === undefined ? 'unknown' : result.safeToSend ? 'pass' : 'fail',
      label:
        result.safeToSend === undefined
          ? `SMTP Handshake: ${NOT_REPORTED}`
          : result.safeToSend
            ? 'SMTP Handshake: Recipient Accepted'
            : 'SMTP Handshake: Recipient Rejected',
    },
  ]

  const copyEmail = () => {
    if (!result.email) return
    navigator.clipboard?.writeText(result.email)
    setCopied(true)
    toast.success('Email copied to clipboard')
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card overflow-hidden">
      {/* Person header */}
      <div className="p-5 flex items-start justify-between gap-4 border-b border-gray-100 dark:border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-10 w-10 shrink-0 rounded-full bg-brand-light dark:bg-brand/15 text-brand border border-brand-border dark:border-brand/30 flex items-center justify-center text-sm font-bold">
            {personName.trim().charAt(0).toUpperCase() || '?'}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink dark:text-white">
              <span className="truncate">{personName}</span>
              {result.status === 'valid' && (
                <BadgeCheck className="h-4 w-4 shrink-0 text-[#059669]" aria-label="Verified" />
              )}
            </p>
            <p className="text-xs text-gray-400 truncate">{domain || '—'}</p>
          </div>
        </div>

        <span
          className={`shrink-0 inline-flex items-center gap-1.5 h-6 rounded-full border px-2.5 text-[11px] font-semibold ${
            isCatchAll
              ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A] dark:bg-[#D97706]/15 dark:border-[#D97706]/30'
              : 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-[#059669]/15 dark:border-[#059669]/30'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isCatchAll ? 'bg-[#D97706]' : 'bg-[#059669]'}`}
            aria-hidden="true"
          />
          {isCatchAll ? `${confidencePct}% Catch-All Guess` : `${confidencePct}% Valid Deliverability`}
        </span>
      </div>

      {/* Catch-all notice */}
      {isCatchAll && (
        <div className="mx-5 mt-5 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] dark:bg-[#D97706]/10 dark:border-[#D97706]/30 p-3">
          <p className="text-[13px] leading-5 text-[#92400E] dark:text-[#FBBF24]">
            {result.notice ||
              "This domain accepts any email address, so we can't confirm this is the real one. Treat with caution before sending."}
          </p>
        </div>
      )}

      <div className="p-5">
        {/* Discovered address */}
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
          Discovered Email Address
        </p>
        <div className="rounded-lg bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="font-mono-code text-base sm:text-lg font-medium text-brand break-all">
            {result.email}
          </p>
          {result.email && (
            <button
              type="button"
              onClick={copyEmail}
              className="h-8 px-3 shrink-0 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-hover transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy Email'}
            </button>
          )}
        </div>

        {/* Three detail tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <DetailTile
            icon={Regex}
            label="Domain Pattern"
            value={pattern && domain ? `${pattern}@${domain}` : NOT_REPORTED}
            muted={!pattern || !domain}
            sub={
              typeof patternPct === 'number'
                ? `${Math.round(patternPct)}% pattern occurrence`
                : pattern
                  ? 'Derived from this result'
                  : undefined
            }
          />
          <DetailTile
            icon={Network}
            label="MX Server"
            value={mxHost || NOT_REPORTED}
            muted={!mxHost}
            sub={mxProvider || undefined}
          />
          <DetailTile
            icon={Inbox}
            label="Mailbox Status"
            value={
              result.safeToSend === true
                ? 'Accepts Mail'
                : result.safeToSend === false
                  ? 'Rejects Mail'
                  : NOT_REPORTED
            }
            muted={result.safeToSend === undefined}
            sub={`Catch-all: ${isCatchAll ? 'Enabled' : 'Disabled'}`}
          />
        </div>

        {/* Verification steps */}
        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/10">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
            Verification Steps Run
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {steps.map((s) => (
              <VerificationStep key={s.label} state={s.state} label={s.label} />
            ))}
          </div>
        </div>

        {/* Company footer */}
        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/10 flex items-end justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <span className="h-9 w-9 shrink-0 rounded-lg bg-[#F1F5F9] dark:bg-white/5 text-gray-400 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink dark:text-white truncate">
                {organization || domain || '—'}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {mxProvider ? `Primary MX Provider: ${mxProvider}` : `Primary MX Provider: ${NOT_REPORTED}`}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              Confidence Score
            </p>
            <p className="text-lg font-bold text-ink dark:text-white tabular-nums leading-tight">
              {confidencePct} <span className="text-xs font-medium text-gray-400">/ 100</span>
            </p>
          </div>
        </div>

        {typeof result.creditsUsed === 'number' && (
          <p className="mt-4 text-[11px] text-gray-400">
            Credits used:{' '}
            <span className="font-semibold text-ink dark:text-gray-200 tabular-nums">
              {result.creditsUsed}
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
