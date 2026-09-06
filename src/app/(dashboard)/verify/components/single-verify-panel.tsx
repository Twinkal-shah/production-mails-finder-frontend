'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Copy,
  HelpCircle,
  Loader2,
  Mail,
  MailCheck,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { humanizeVerificationReason } from '@/lib/api-error'
import { cn } from '@/lib/utils'

export interface SingleVerifyResult {
  status: string
  reason?: string
  error?: string
  isCatchAllDomain?: boolean
  notice?: string
}

/* ---------- display helpers (moved verbatim from page.tsx) ---------- */

const formatLabel = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const statusLabel = (s?: string) => {
  const v = typeof s === 'string' ? s.toLowerCase() : ''
  if (v === 'valid') return 'Valid'
  if (v === 'invalid') return 'Invalid'
  if (v === 'risky') return 'Risky'
  if (v === 'catch_all' || v === 'catchall') return 'Catch-All'
  return 'Unknown'
}

const statusDescription = (s?: string) => {
  const v = typeof s === 'string' ? s.toLowerCase() : ''
  if (v === 'valid') return 'Email is valid and deliverable.'
  if (v === 'invalid') return 'Email does not exist or cannot receive messages.'
  if (v === 'risky') return 'Email appears risky (catch-all or uncertain).'
  if (v === 'catch_all' || v === 'catchall') return 'Domain accepts all emails — deliverability cannot be confirmed.'
  if (v === 'error') return 'Unable to verify this email. Please try again later.'
  return 'Verification completed. Status is unknown.'
}

/* ---------- result panel styling ---------- */

/** Semantic tints from the Stitch status-badge spec. */
function resultTone(status: string) {
  const v = (status || '').toLowerCase()
  if (v === 'valid') {
    return {
      wrapper: 'border-l-[#059669] bg-[#ECFDF5] dark:bg-[#059669]/10',
      icon: <CheckCircle2 className="h-5 w-5 text-[#059669] dark:text-[#34D399]" />,
    }
  }
  if (v === 'invalid') {
    return {
      wrapper: 'border-l-[#DC2626] bg-[#FEF2F2] dark:bg-[#DC2626]/10',
      icon: <XCircle className="h-5 w-5 text-[#DC2626] dark:text-[#F87171]" />,
    }
  }
  if (v === 'risky' || v === 'catch_all' || v === 'catchall') {
    return {
      wrapper: 'border-l-[#D97706] bg-[#FFFBEB] dark:bg-[#D97706]/10',
      icon: <AlertTriangle className="h-5 w-5 text-[#D97706] dark:text-[#FBBF24]" />,
    }
  }
  return {
    wrapper: 'border-l-[#94A3B8] bg-[#F8FAFC] dark:bg-white/[0.04]',
    icon: <HelpCircle className="h-5 w-5 text-ink-muted" />,
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label="Copy email address"
      title="Copy email address"
      onClick={() => {
        navigator.clipboard?.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      }}
      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export function SingleVerifyPanel({
  email,
  onEmailChange,
  onVerify,
  isVerifying,
  result,
  raw,
  className,
}: {
  email: string
  onEmailChange: (value: string) => void
  onVerify: () => void
  isVerifying: boolean
  result: SingleVerifyResult | null
  raw: Record<string, unknown> | null
  className?: string
}) {
  const [showDetails, setShowDetails] = useState(false)

  const details = raw
    ? Object.entries(raw).filter(
        ([key, value]) =>
          key !== 'reason' &&
          key !== 'status' &&
          key !== 'notice' &&
          key !== 'is_catch_all_domain' &&
          value !== undefined &&
          value !== null &&
          !(typeof value === 'string' && value.trim() === '')
      )
    : []

  const tone = result ? resultTone(result.status) : null

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3 text-[15px] font-semibold text-ink dark:text-white">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-light text-brand dark:bg-brand/15">
              <ShieldCheck className="h-4 w-4" />
            </span>
            Target Mailbox
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wide text-brand bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 px-2 py-0.5 rounded shrink-0">
            1 credit / lookup
          </span>
        </CardTitle>
        <CardDescription className="text-[13px]">
          Check a single email address for deliverability.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!isVerifying && email) onVerify()
          }}
          className="space-y-2"
        >
          <Label htmlFor="single-email" className="text-sm font-medium">
            Email address
          </Label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="single-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                disabled={isVerifying}
                className="h-11 pl-10"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-11 w-full sm:w-auto"
              disabled={isVerifying || !email}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <MailCheck className="mr-2 h-4 w-4" />
                  Verify email
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Costs 1 credit · press Enter to submit
          </p>
        </form>

        {result && tone && (
          <div
            className={cn(
              'verification-result animate-fade-slide-in rounded-lg border border-border border-l-4 p-4',
              tone.wrapper
            )}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0">{tone.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={result.status} />
                  <span className="text-sm font-semibold">{statusLabel(result.status)}</span>
                </div>
                <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono text-xs text-muted-foreground">{email}</span>
                  {email && <CopyButton value={email} />}
                </div>
                <p className="mt-2 text-sm leading-relaxed">
                  {result.reason
                    ? humanizeVerificationReason(result.reason, statusDescription(result.status))
                    : statusDescription(result.status)}
                </p>
              </div>
            </div>

            {result.isCatchAllDomain && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {result.notice ||
                    "This domain accepts any email address, so we can't confirm if this specific address is real. Treat with caution before sending."}
                </span>
              </div>
            )}

            {(result.status === 'valid' || result.isCatchAllDomain) && details.length > 0 && (
              <div className="mt-4 border-t border-border/70 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-expanded={showDetails}
                >
                  {showDetails ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                  {showDetails ? 'Hide technical details' : 'Show technical details'}
                </button>

                {showDetails && (
                  <dl className="animate-fade-in mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {details.map(([key, value]) => (
                      <div key={key} className="min-w-0">
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {formatLabel(key)}
                        </dt>
                        <dd className="mt-0.5 truncate text-sm font-medium" title={String(value)}>
                          {String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
