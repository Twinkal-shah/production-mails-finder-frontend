'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Search,
} from 'lucide-react'
import { humanizeVerificationReason } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { VerifyResultItem } from '../types'
import { DistributionBar, StatTile } from './stat-tile'

const PAGE_SIZE = 50

type Bucket = 'valid' | 'invalid' | 'risky' | 'unknown'
type Filter = 'all' | Bucket
type SortKey = 'email' | 'status' | 'domain'
type SortDir = 'asc' | 'desc'

/** Same bucketing rule the page uses when tallying totals. */
function bucketOf(status?: string): Bucket {
  const v = (status || '').toLowerCase()
  if (v === 'valid') return 'valid'
  if (v === 'risky') return 'risky'
  if (v === 'invalid') return 'invalid'
  return 'unknown'
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

export function VerifyResultsSummary({
  processedCount,
  validCount,
  invalidCount,
  riskyCount,
  unknownCount,
  creditsCharged,
  catchAllCount,
  catchAllNotice,
  onDownload,
}: {
  processedCount: number
  validCount: number
  invalidCount: number
  riskyCount: number
  unknownCount: number
  creditsCharged: number
  catchAllCount: number
  catchAllNotice: string | null
  onDownload: () => void
}) {
  const share = (n: number) =>
    processedCount > 0 ? Math.round((n / processedCount) * 100) : 0

  return (
    <Card className="animate-fade-slide-in shadow-sm">
      <CardContent className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600 dark:text-green-400" />
            <div className="min-w-0">
              <p className="text-lg font-semibold text-foreground">Verification complete</p>
              <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                {processedCount.toLocaleString()} email{processedCount === 1 ? '' : 's'} processed
                {creditsCharged > 0
                  ? ` · ${creditsCharged.toLocaleString()} credit${creditsCharged === 1 ? '' : 's'} used`
                  : ''}
              </p>
            </div>
          </div>
          <Button onClick={onDownload} className="w-full shrink-0 sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="Total" value={processedCount} tone="neutral" delayMs={0} />
          <StatTile label="Valid" value={validCount} tone="success" share={share(validCount)} delayMs={60} />
          <StatTile label="Invalid" value={invalidCount} tone="danger" share={share(invalidCount)} delayMs={120} />
          <StatTile
            label="Risky"
            value={riskyCount}
            tone="warning"
            share={share(riskyCount)}
            hint="Catch-all or uncertain results — not billed."
            delayMs={180}
          />
          <StatTile label="Unknown" value={unknownCount} tone="muted" share={share(unknownCount)} delayMs={240} />
          <StatTile label="Credits used" value={creditsCharged} tone="brand" delayMs={300} />
        </div>

        <DistributionBar
          valid={validCount}
          invalid={invalidCount}
          risky={riskyCount}
          unknown={unknownCount}
        />

        {catchAllCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {catchAllCount} email{catchAllCount === 1 ? ' is' : 's are'} on catch-all domain
              {catchAllCount === 1 ? '' : 's'} where deliverability cannot be confirmed.
              {catchAllNotice ? ` ${catchAllNotice}` : ''}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* Per-email table                                                     */
/* ------------------------------------------------------------------ */

function SortHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey | null
  dir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  const active = activeKey === sortKey
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        'flex items-center gap-1 text-left text-xs font-medium uppercase tracking-wide transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        active ? 'text-[var(--primary)]' : 'text-muted-foreground',
        className
      )}
    >
      {label}
      {active ? (
        dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </button>
  )
}

export function VerifyResultsTable({ results }: { results: VerifyResultItem[] }) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim().toLowerCase()), 200)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debounced, filter, sortKey, sortDir])

  const counts = useMemo(() => {
    const c = { all: results.length, valid: 0, invalid: 0, risky: 0, unknown: 0 }
    for (const r of results) c[bucketOf(r.status)]++
    return c
  }, [results])

  const visible = useMemo(() => {
    let list = results
    if (filter !== 'all') list = list.filter((r) => bucketOf(r.status) === filter)
    if (debounced) {
      list = list.filter(
        (r) =>
          (r.email || '').toLowerCase().includes(debounced) ||
          (r.domain || '').toLowerCase().includes(debounced)
      )
    }
    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1
      list = [...list].sort((a, b) => {
        const av = (sortKey === 'status' ? bucketOf(a.status) : a[sortKey] || '').toString()
        const bv = (sortKey === 'status' ? bucketOf(b.status) : b[sortKey] || '').toString()
        return av.localeCompare(bv) * dir
      })
    }
    return list
  }, [results, filter, debounced, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'valid', label: 'Valid', count: counts.valid },
    { key: 'invalid', label: 'Invalid', count: counts.invalid },
    { key: 'risky', label: 'Risky', count: counts.risky },
    { key: 'unknown', label: 'Unknown', count: counts.unknown },
  ]

  if (results.length === 0) return null

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search email or domain..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 pl-10"
              aria-label="Search results"
            />
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key)}
                aria-pressed={filter === chip.key}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  filter === chip.key
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                    : 'border-border text-muted-foreground hover:border-[var(--primary)]/50 hover:text-[var(--primary)]'
                )}
              >
                {chip.label}
                <span className="ml-1.5 tabular-nums opacity-80">{chip.count.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Header row (desktop) */}
        <div className="hidden border-b border-border px-3 pb-2 sm:grid sm:grid-cols-[minmax(0,2fr)_110px_minmax(0,1fr)_minmax(0,1.5fr)] sm:gap-3">
          <SortHeader label="Email" sortKey="email" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
          <SortHeader label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
          <SortHeader label="Domain" sortKey="domain" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Details
          </span>
        </div>

        {/* Rows */}
        {pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground dark:bg-white/5">
              <Inbox className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-foreground">No matching results</p>
            <p className="text-xs text-muted-foreground">
              Try a different search term or clear the filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pageRows.map((r, i) => {
              const detail = r.reason
                ? humanizeVerificationReason(r.reason, '')
                : r.is_catch_all_domain
                  ? 'Catch-all domain'
                  : r.mx || ''
              return (
                <div
                  key={`${r.email}-${i}`}
                  className="grid grid-cols-1 gap-1 px-3 py-3 transition-colors hover:bg-muted/40 dark:hover:bg-white/[0.03] sm:grid-cols-[minmax(0,2fr)_110px_minmax(0,1fr)_minmax(0,1.5fr)] sm:items-center sm:gap-3"
                >
                  <span className="truncate font-mono text-xs text-foreground" title={r.email}>
                    {r.email || '--'}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={r.is_catch_all_domain ? 'catch_all' : r.status || 'unknown'} />
                    <span className="truncate text-xs text-muted-foreground sm:hidden">
                      {r.domain || ''}
                    </span>
                  </span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:block" title={r.domain}>
                    {r.domain || '--'}
                  </span>
                  <span className="truncate text-xs text-muted-foreground" title={detail || undefined}>
                    {detail || '--'}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {visible.length > PAGE_SIZE && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
            <p className="text-xs tabular-nums text-muted-foreground">
              Showing {((safePage - 1) * PAGE_SIZE + 1).toLocaleString()}–
              {Math.min(safePage * PAGE_SIZE, visible.length).toLocaleString()} of{' '}
              {visible.length.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Previous</span>
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">
                Page {safePage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <span className="mr-1 hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
