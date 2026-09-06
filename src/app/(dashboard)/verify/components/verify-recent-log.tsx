'use client'

import { Fragment, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Download,
  HelpCircle,
  Loader2,
  MailCheck,
  Search,
  SlidersHorizontal,
  Trash2,
  XCircle,
  Inbox,
} from 'lucide-react'
import { useRecentVerifyResults, useClearRecentResults } from '@/hooks/useRecentResults'
import type { RecentVerifyResult } from '@/types/jobs'

type StatusKey = 'deliverable' | 'risky' | 'undeliverable' | 'unknown'

const STATUS_FILTERS: Array<{ key: StatusKey | 'all'; label: string }> = [
  { key: 'all', label: 'All Statuses' },
  { key: 'deliverable', label: 'Deliverable' },
  { key: 'risky', label: 'Risky / Catch-all' },
  { key: 'undeliverable', label: 'Undeliverable' },
  { key: 'unknown', label: 'Unknown' },
]

function statusOf(item: RecentVerifyResult): StatusKey {
  const s = (item.result.status || '').toLowerCase()
  if (item.result.catch_all) return 'risky'
  if (s === 'valid') return 'deliverable'
  if (s === 'risky' || s === 'catch_all' || s === 'catchall') return 'risky'
  if (s === 'invalid') return 'undeliverable'
  return 'unknown'
}

const STATUS_META: Record<
  StatusKey,
  { label: string; pill: string; dot: string; icon: React.ReactNode; bar: string; score: string }
> = {
  deliverable: {
    label: 'Deliverable',
    pill: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    icon: <MailCheck className="h-4 w-4 text-emerald-600" />,
    bar: 'bg-emerald-500',
    score: 'text-emerald-700 dark:text-emerald-400',
  },
  risky: {
    label: 'Risky (Catch-all)',
    pill: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400',
    dot: 'bg-amber-500',
    icon: <HelpCircle className="h-4 w-4 text-amber-500" />,
    bar: 'bg-amber-500',
    score: 'text-amber-700 dark:text-amber-400',
  },
  undeliverable: {
    label: 'Undeliverable',
    pill: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400',
    dot: 'bg-red-500',
    icon: <XCircle className="h-4 w-4 text-red-600" />,
    bar: 'bg-red-500',
    score: 'text-red-700 dark:text-red-400',
  },
  unknown: {
    label: 'Unknown',
    pill: 'bg-[#F1F5F9] border-gray-200 text-[#475569] dark:bg-white/5 dark:border-white/10 dark:text-gray-300',
    dot: 'bg-[#94A3B8]',
    icon: <HelpCircle className="h-4 w-4 text-gray-400" />,
    bar: 'bg-[#94A3B8]',
    score: 'text-gray-500 dark:text-gray-400',
  },
}

function scoreOf(item: RecentVerifyResult): number | null {
  const c = item.result.confidence_score
  if (typeof c !== 'number') return null
  return c <= 1 ? Math.round(c * 100) : Math.round(c)
}

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000)
  if (Number.isNaN(diffMin)) return '—'
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} mins ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

/**
 * Stitch "Recent Verifications Log".
 *
 * Reads the existing recent-verify-results endpoint — same data the previous
 * table used. Filtering, the status menu and CSV export all run client-side on
 * the already-loaded rows; no extra requests are made.
 */
export function VerifyRecentLog() {
  const { data, isLoading } = useRecentVerifyResults()
  const clearMutation = useClearRecentResults('verify')

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusKey | 'all'>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = useMemo(() => (Array.isArray(data) ? data : []), [data])

  const verifiedToday = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10)
    return rows.filter((r) => String(r.created_at || '').slice(0, 10) === todayKey).length
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'all' && statusOf(r) !== status) return false
      if (!q) return true
      return (
        (r.result.email || '').toLowerCase().includes(q) ||
        (r.result.domain || '').toLowerCase().includes(q) ||
        (r.result.mx || '').toLowerCase().includes(q)
      )
    })
  }, [rows, query, status])

  const exportCsv = () => {
    if (visible.length === 0) {
      toast.error('Nothing to export yet')
      return
    }
    const header = ['Verified Mailbox', 'Status', 'Quality Score', 'MX Host Provider', 'Timestamp']
    const lines = visible.map((r) =>
      [
        r.result.email || '',
        STATUS_META[statusOf(r)].label,
        scoreOf(r) ?? '',
        r.result.mx || r.result.email_provider || '',
        r.created_at || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'recent-verifications.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isLoading) return null
  if (rows.length === 0) return null

  const activeFilterLabel = STATUS_FILTERS.find((f) => f.key === status)?.label ?? 'All Statuses'

  return (
    <section className="flex flex-col gap-4">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-lg text-ink dark:text-white">Recent Verifications Log</span>
          <span className="bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 text-brand px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono-code shrink-0">
            {verifiedToday.toLocaleString()} Verified Today
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center">
            <Search className="h-4 w-4 text-ink-muted absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by domain, address..."
              className="h-8 pl-8 pr-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-ink dark:text-white placeholder:text-gray-400 shadow-2xs outline-none focus:border-brand transition-colors"
            />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="h-8 px-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-[#F8FAFC] dark:hover:bg-white/10 text-ink dark:text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>{activeFilterLabel}</span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 mt-1 z-20 w-48 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-layer2 p-1">
                  {STATUS_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => {
                        setStatus(f.key)
                        setMenuOpen(false)
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                        status === f.key
                          ? 'bg-brand-light dark:bg-brand/15 text-brand font-semibold'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="h-8 px-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-[#F8FAFC] dark:hover:bg-white/10 text-ink dark:text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>

          {/* Existing clear-history action, preserved */}
          <button
            type="button"
            disabled={clearMutation.isPending}
            onClick={() => clearMutation.mutate()}
            title="Clear verification history"
            className="h-8 px-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-[#F8FAFC] dark:hover:bg-white/10 text-ink-muted text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-60"
          >
            {clearMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card overflow-hidden">
        {visible.length === 0 ? (
          <div className="p-10 flex flex-col items-center justify-center text-center gap-2">
            <span className="h-10 w-10 rounded-full bg-[#F1F5F9] dark:bg-white/5 text-gray-400 flex items-center justify-center">
              <Inbox className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-ink dark:text-white">Nothing matches this filter</p>
            <p className="text-xs text-gray-400">Try a different status or clear the search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[880px]">
              <thead>
                <tr className="bg-[#F8FAFC] dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-ink-muted text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5 font-semibold">Verified Mailbox</th>
                  <th className="py-3 px-5 font-semibold">Status</th>
                  <th className="py-3 px-5 font-semibold">Quality Score</th>
                  <th className="py-3 px-5 font-semibold">MX Host Provider</th>
                  <th className="py-3 px-5 font-semibold">Timestamp</th>
                  <th className="py-3 px-5 font-semibold text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-white/10 text-xs text-ink dark:text-white">
                {visible.map((item, i) => {
                  const key = `${item.result.email}-${item.created_at}-${i}`
                  const meta = STATUS_META[statusOf(item)]
                  const score = scoreOf(item)
                  const isOpen = expanded === key
                  return (
                    <Fragment key={key}>
                      <tr className="hover:bg-[#F8FAFC] dark:hover:bg-white/5 transition-colors">
                        <td className="py-3 px-5 font-medium">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0">{meta.icon}</span>
                            <span className="font-mono-code text-xs text-ink dark:text-white truncate">
                              {item.result.email}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${meta.pill}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="py-3 px-5">
                          {score === null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className={`font-mono-code text-xs font-semibold ${meta.score}`}>
                                {score}/100
                              </span>
                              <div className="w-12 h-1.5 rounded-full bg-[#E2E8F0] dark:bg-white/10 overflow-hidden">
                                <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-5 font-mono-code text-[11px] text-ink-muted">
                          {item.result.mx || item.result.email_provider || 'Not reported'}
                        </td>
                        <td className="py-3 px-5 text-ink-muted text-[11px] whitespace-nowrap">
                          {relativeTime(item.created_at)}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : key)}
                            className="text-brand hover:text-brand-hover font-semibold text-xs transition-colors whitespace-nowrap"
                          >
                            {isOpen ? 'Hide Details' : 'View Details'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-[#F8FAFC] dark:bg-white/5">
                          <td colSpan={6} className="py-3 px-5">
                            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
                              {[
                                ['Domain', item.result.domain || 'Not reported'],
                                ['MX Host', item.result.mx || 'Not reported'],
                                ['Provider', item.result.email_provider || 'Not reported'],
                                [
                                  'Catch-all',
                                  item.result.catch_all === undefined
                                    ? 'Not reported'
                                    : item.result.catch_all
                                      ? 'Yes'
                                      : 'No',
                                ],
                                [
                                  'Safe to send',
                                  item.result.safe_to_send === undefined
                                    ? 'Not reported'
                                    : item.result.safe_to_send
                                      ? 'Yes'
                                      : 'No',
                                ],
                                ['Checked', new Date(item.created_at).toLocaleString()],
                              ].map(([label, value]) => (
                                <div key={label as string} className="min-w-0">
                                  <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                    {label}
                                  </dt>
                                  <dd className="mt-0.5 font-mono-code text-[11px] text-ink dark:text-white truncate">
                                    {value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
