'use client'

import { cn } from '@/lib/utils'

export type StatTone = 'neutral' | 'success' | 'danger' | 'warning' | 'muted' | 'brand'

/**
 * Semantic tones reuse the exact status colour families already used across the
 * app (green / red / amber / gray) plus the brand token. No new palette.
 */
const TONE_CLASS: Record<StatTone, string> = {
  neutral: 'text-foreground',
  success: 'text-green-600 dark:text-green-400',
  danger: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  muted: 'text-muted-foreground',
  brand: 'text-[var(--primary)]',
}

export function StatTile({
  label,
  value,
  tone = 'neutral',
  share,
  hint,
  delayMs = 0,
}: {
  label: string
  value: number
  tone?: StatTone
  /** Percentage of the total, rendered under the value. */
  share?: number
  /** Native tooltip text. */
  hint?: string
  delayMs?: number
}) {
  return (
    <div
      title={hint}
      className="animate-fade-in rounded-xl border border-border bg-muted/40 p-3.5 transition-shadow duration-200 hover:shadow-sm dark:bg-white/[0.03] sm:p-4"
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-1.5 text-2xl font-bold tabular-nums sm:text-3xl', TONE_CLASS[tone])}>
        {value.toLocaleString()}
      </p>
      {typeof share === 'number' && (
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{share}%</p>
      )}
    </div>
  )
}

/**
 * Stacked proportion bar giving list quality at a glance.
 */
export function DistributionBar({
  valid,
  invalid,
  risky,
  unknown,
}: {
  valid: number
  invalid: number
  risky: number
  unknown: number
}) {
  const total = valid + invalid + risky + unknown
  if (total <= 0) return null

  const segments = [
    { key: 'valid', value: valid, label: 'Valid', className: 'bg-green-500' },
    { key: 'invalid', value: invalid, label: 'Invalid', className: 'bg-red-500' },
    { key: 'risky', value: risky, label: 'Risky', className: 'bg-amber-500' },
    { key: 'unknown', value: unknown, label: 'Unknown', className: 'bg-gray-400 dark:bg-gray-500' },
  ].filter((s) => s.value > 0)

  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted dark:bg-white/10">
      {segments.map((s) => (
        <div
          key={s.key}
          className={cn('h-full transition-[width] duration-500 ease-out', s.className)}
          style={{ width: `${(s.value / total) * 100}%` }}
          title={`${s.label}: ${s.value.toLocaleString()} (${Math.round((s.value / total) * 100)}%)`}
        />
      ))}
    </div>
  )
}
