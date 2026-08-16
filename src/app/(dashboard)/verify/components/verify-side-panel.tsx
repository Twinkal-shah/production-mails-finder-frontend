'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'

const BULK_STEPS = [
  { title: 'Upload your list', body: 'A CSV or Excel file with an "Email" column. Other columns are kept.' },
  { title: 'We run the checks', body: 'Syntax, domain, MX and SMTP mailbox checks on every unique address.' },
  { title: 'Download a clean list', body: 'Export the results with the verification status added to your data.' },
]

const SINGLE_STEPS = [
  { title: 'Enter an address', body: 'Any email address you want to check before sending.' },
  { title: 'We run the checks', body: 'Syntax, domain, MX and SMTP mailbox checks in a few seconds.' },
  { title: 'Read the result', body: 'A clear status plus the technical details behind it.' },
]

/** Status meanings — wording matches `statusDescription()` so nothing shifts. */
const LEGEND: { status: string; body: string }[] = [
  { status: 'valid', body: 'Email is valid and deliverable.' },
  { status: 'invalid', body: 'Email does not exist or cannot receive messages.' },
  { status: 'risky', body: 'Email appears risky (catch-all or uncertain).' },
  { status: 'catch_all', body: 'Domain accepts all emails — deliverability cannot be confirmed.' },
  { status: 'unknown', body: 'Verification completed. Status is unknown.' },
]

export function VerifySidePanel({
  variant,
  className,
}: {
  variant: 'single' | 'bulk'
  className?: string
}) {
  const steps = variant === 'bulk' ? BULK_STEPS : SINGLE_STEPS

  return (
    // `self-start` is required: a stretched grid item fills the row height and
    // then has no room to move, so `sticky` would silently do nothing.
    <div className={cn('space-y-6 lg:sticky lg:top-6 lg:self-start', className)}>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How verification works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--primary)]/40 bg-[var(--primary)]/10 text-xs font-bold tabular-nums text-[var(--primary)]">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">What the statuses mean</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {LEGEND.map((item) => (
              <li key={item.status} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                <span className="shrink-0">
                  <StatusBadge status={item.status} />
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">{item.body}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            Risky and unknown results are not billed.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
