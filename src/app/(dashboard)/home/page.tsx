'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Search,
  UserSearch,
  Database,
  BadgeCheck,
  Code2,
  PlayCircle,
  Users,
  Lock,
  Zap,
  CircleDollarSign,
  ContactRound,
  ShieldCheck,
  UploadCloud,
  ArrowRight,
  ArrowUpRight,
  PlusCircle,
  Globe,
  User as UserIcon,
  Copy,
  Check,
  FileDown,
  Clock,
} from 'lucide-react'
import { useCreditsData } from '@/hooks/useCreditsData'
import { useRecentFindResults } from '@/hooks/useRecentResults'
import { useVerificationStats } from '@/hooks/useVerificationStats'
import type { RecentFindResult } from '@/types/jobs'

/** Static display value, matching the Find Email page. */
const ACCURACY_LABEL = '99.4%'

/* ------------------------------ metric card ------------------------------ */

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  iconClass,
  footerLeft,
  footerRight,
}: {
  label: string
  value: string
  unit?: string
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  footerLeft: React.ReactNode
  footerRight?: React.ReactNode
}) {
  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-5 border border-gray-200 dark:border-white/10 shadow-2xs flex flex-col justify-between hover:border-gray-300 dark:hover:border-white/20 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-ink dark:text-white tabular-nums tracking-tight">
              {value}
            </span>
            {unit && <span className="text-xs text-gray-400 font-medium">{unit}</span>}
          </div>
        </div>
        <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
        {footerLeft}
        {footerRight}
      </div>
    </div>
  )
}

/* ------------------------------ tool card ------------------------------ */

function ToolCard({
  href,
  title,
  description,
  cta,
  icon: Icon,
  locked,
  onLockedClick,
  lockedNote,
}: {
  href: string
  title: string
  description: string
  cta: string
  icon: React.ComponentType<{ className?: string }>
  locked?: boolean
  onLockedClick?: () => void
  lockedNote?: string
}) {
  const inner = (
    <>
      <div>
        <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 flex items-center justify-center text-brand group-hover:bg-brand-light dark:group-hover:bg-brand/15 transition-colors mb-3">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-bold text-ink dark:text-white group-hover:text-brand transition-colors flex items-center gap-2">
          {title}
          {locked && <Lock className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{description}</p>
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/10 flex items-center text-xs font-bold text-brand gap-1 group-hover:translate-x-0.5 transition-transform">
        <span>{locked ? lockedNote || cta : cta}</span>
        {!locked && <ArrowRight className="h-3.5 w-3.5" />}
      </div>
    </>
  )

  const cls =
    'bg-white dark:bg-[#1a1a1a] rounded-xl p-5 border border-gray-200 dark:border-white/10 shadow-2xs flex flex-col justify-between hover:border-brand/40 hover:shadow-card-hover transition-all group'

  if (locked) {
    return (
      <div
        role="button"
        tabIndex={-1}
        aria-disabled="true"
        onClick={onLockedClick}
        className={`${cls} opacity-60 cursor-not-allowed`}
      >
        {inner}
      </div>
    )
  }
  return (
    <Link href={href} className={`${cls} cursor-pointer`}>
      {inner}
    </Link>
  )
}

/* --------------------------- activity helpers --------------------------- */

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

function initialsOf(name?: string | null, email?: string | null) {
  const src = (name || email || '?').trim()
  const parts = src.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase()
}

function scoreOf(item: RecentFindResult): number | null {
  const c = item.result.confidence_score
  if (typeof c !== 'number') return null
  return c <= 1 ? Math.round(c * 100) : Math.round(c)
}

function isRisky(item: RecentFindResult) {
  const s = (item.result.status || '').toLowerCase()
  return s === 'risky' || s === 'catch_all' || s === 'guessed'
}
function isSafe(item: RecentFindResult) {
  const s = (item.result.status || '').toLowerCase()
  return s === 'valid' || s === 'found'
}

function CopyCell({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 font-mono-code text-[11px] text-gray-700 dark:text-gray-300 max-w-full">
      <span className="truncate">{email}</span>
      <button
        type="button"
        title="Copy email"
        onClick={() => {
          navigator.clipboard?.writeText(email)
          setCopied(true)
          toast.success('Email copied to clipboard')
          window.setTimeout(() => setCopied(false), 1500)
        }}
        className="text-gray-400 hover:text-brand transition-colors ml-1 shrink-0"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

/* --------------------------------- page --------------------------------- */

export default function HomePage() {
  const router = useRouter()
  const { profile, creditUsage } = useCreditsData()
  const { data: recentFinds, isLoading: findsLoading } = useRecentFindResults()
  const { data: verificationStats, isLoading: statsLoading } = useVerificationStats()

  const [quickName, setQuickName] = useState('')
  const [quickDomain, setQuickDomain] = useState('')
  const [filter, setFilter] = useState<'all' | 'safe' | 'risky'>('all')

  const isLifetime = (profile?.plan || '').toString().trim().toLowerCase() === 'lifetime'
  const communityLink = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_LINK || 'https://chat.whatsapp.com/'
  const firstName = (profile?.full_name || '').toString().trim().split(/\s+/)[0] || 'there'
  const credits = Math.max(Number(profile?.available_credits ?? 0), 0)
  const planLabel = (profile?.plan || 'free').toString()

  /* --- real usage metrics derived from the daily credit-usage series --- */
  const usageStats = useMemo(() => {
    const series = Array.isArray(creditUsage) ? creditUsage : []
    const dayMs = 86400000
    const now = Date.now()
    const todayKey = new Date().toISOString().slice(0, 10)
    let today = 0
    let last30 = 0
    let prev30 = 0
    for (const d of series) {
      const used = Number(d?.totalCreditsUsed) || 0
      const key = String(d?.date || '').slice(0, 10)
      if (key === todayKey) today += used
      const t = new Date(key).getTime()
      if (Number.isNaN(t)) continue
      const age = now - t
      if (age <= 30 * dayMs) last30 += used
      else if (age <= 60 * dayMs) prev30 += used
    }
    const hasPrev = prev30 > 0
    const change = hasPrev ? ((last30 - prev30) / prev30) * 100 : null
    return { today, last30, prev30, change }
  }, [creditUsage])

  /* --- activity rows from the existing recent-results endpoint --- */
  const rows = useMemo(() => (Array.isArray(recentFinds) ? recentFinds : []), [recentFinds])
  const safeCount = rows.filter(isSafe).length
  const riskyCount = rows.filter(isRisky).length
  const visibleRows =
    filter === 'safe' ? rows.filter(isSafe) : filter === 'risky' ? rows.filter(isRisky) : rows

  const exportCsv = () => {
    if (visibleRows.length === 0) {
      toast.error('Nothing to export yet')
      return
    }
    const header = ['Prospect', 'Company Domain', 'Verified Email', 'Status', 'Score', 'Provider', 'Date']
    const lines = visibleRows.map((r) =>
      [
        r.result.full_name || '',
        r.result.domain || '',
        r.result.email || '',
        r.result.status || '',
        scoreOf(r) ?? '',
        r.result.email_provider || '',
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
    a.download = 'recent-prospect-activity.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /** Hands the entered values to the Find page — no lookup runs here. */
  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const parts = quickName.trim().split(/\s+/).filter(Boolean)
    const params = new URLSearchParams()
    if (parts[0]) params.set('first', parts[0])
    if (parts.length > 1) params.set('last', parts.slice(1).join(' '))
    if (quickDomain.trim()) params.set('domain', quickDomain.trim())
    router.push(`/find${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------------------- header ---------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Here&apos;s what&apos;s happening across your email prospecting and verification queues today.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/bulk-finder"
            className="h-9 px-3.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 font-semibold text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300 transition-colors flex items-center gap-2 shadow-2xs"
          >
            <UploadCloud className="h-4 w-4 text-gray-500" />
            <span>Upload CSV for Bulk Find</span>
          </Link>
          <Link
            href="/find"
            className="h-9 px-3.5 bg-brand text-white font-bold text-xs rounded-lg hover:bg-brand-hover transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Search className="h-4 w-4" />
            <span>Find Single Email</span>
          </Link>
        </div>
      </div>

      {/* ---------------------------- metrics ---------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Available Credits"
          value={credits.toLocaleString()}
          icon={CircleDollarSign}
          iconClass="bg-brand-light dark:bg-brand/15 text-brand"
          footerLeft={
            <span className="text-emerald-600 font-bold flex items-center gap-1">
              <PlusCircle className="h-3.5 w-3.5" />
              {usageStats.last30.toLocaleString()} used (30D)
            </span>
          }
          footerRight={<span className="text-gray-400 font-medium capitalize">{planLabel}</span>}
        />

        <MetricCard
          label="Verified Emails (30D)"
          value={statsLoading ? '…' : verificationStats ? verificationStats.last30.toLocaleString() : '—'}
          icon={ContactRound}
          iconClass="bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400"
          footerLeft={
            verificationStats ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Successful verifications
              </span>
            ) : (
              <span className="text-gray-400 font-medium">Awaiting backend counter</span>
            )
          }
          footerRight={<span className="text-gray-400 font-medium">last 30 days</span>}
        />

        <MetricCard
          label="Deliverability Accuracy"
          value={ACCURACY_LABEL}
          icon={ShieldCheck}
          iconClass="bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          footerLeft={
            <span className="text-emerald-600 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Published accuracy
            </span>
          }
        />

        <MetricCard
          label="Verified Emails Today"
          value={statsLoading ? '…' : verificationStats ? verificationStats.today.toLocaleString() : '—'}
          unit={verificationStats ? 'emails' : undefined}
          icon={Zap}
          iconClass="bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400"
          footerLeft={
            <span className="text-gray-600 dark:text-gray-300 font-medium">
              {verificationStats ? 'Single, bulk and API' : 'Awaiting backend counter'}
            </span>
          }
          footerRight={
            <Link href="/verify" className="text-brand font-bold hover:underline">
              Verify
            </Link>
          }
        />
      </div>

      {/* ------------------------ quick lookup widget ------------------------ */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3.5">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand" />
            <h3 className="text-sm font-bold text-ink dark:text-white">Quick Discovery Sandbox</h3>
          </div>
          <span className="text-xs text-gray-400">Opens the finder with these details prefilled</span>
        </div>
        <form onSubmit={handleQuickSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-5 relative">
            <UserIcon className="absolute left-3 top-2.5 h-[18px] w-[18px] text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={quickName}
              onChange={(e) => setQuickName(e.target.value)}
              placeholder="Full Name (e.g. Marc Benioff)"
              className="w-full h-10 pl-9 pr-3 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-ink dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-white/10 focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all focus:outline-none"
            />
          </div>
          <div className="sm:col-span-4 relative">
            <Globe className="absolute left-3 top-2.5 h-[18px] w-[18px] text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={quickDomain}
              onChange={(e) => setQuickDomain(e.target.value)}
              placeholder="Company Domain (e.g. salesforce.com)"
              className="w-full h-10 pl-9 pr-3 text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-ink dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-white/10 focus:border-brand/40 focus:ring-2 focus:ring-brand/10 transition-all focus:outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="w-full h-10 bg-brand text-white text-xs font-bold rounded-lg hover:bg-brand-hover transition-colors flex items-center justify-center gap-2 shadow-2xs"
            >
              <Search className="h-4 w-4" />
              <span>Find &amp; Verify</span>
            </button>
          </div>
        </form>
      </div>

      {/* --------------------------- tool cards --------------------------- */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-sm font-bold text-ink dark:text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand" />
            Core Engines &amp; Workflows
          </h2>
          <span className="text-xs text-gray-400 hidden sm:block">
            High-throughput lead enrichment tools
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ToolCard
            href="/find"
            icon={UserSearch}
            title="Single Email Finder"
            description="Find verified direct work emails by full name and domain in seconds."
            cta="Launch Finder"
          />
          <ToolCard
            href="/bulk-finder"
            icon={Database}
            title="Bulk CSV List Finder"
            description="Upload CSV/Excel spreadsheets to discover and enrich prospect records at scale."
            cta="Upload List"
          />
          <ToolCard
            href="/verify"
            icon={BadgeCheck}
            title="Email Deliverability Verifier"
            description="Audit email databases for MX connectivity, spam traps, catch-alls and bounce risk."
            cta="Run Verification"
          />
          <ToolCard
            href="/api-calls"
            icon={Code2}
            title="Developer API & Webhooks"
            description="Integrate finding and verification directly into your outbound stack."
            cta="View API Docs"
          />
          <ToolCard
            href="/video-tutorials"
            icon={PlayCircle}
            title="Video Tutorials"
            description="Learn how to get the most out of Mailsfinder with short walkthroughs."
            cta="Watch Tutorials"
          />
          <ToolCard
            href={communityLink}
            icon={Users}
            title="Join Our Community"
            description="Access the WhatsApp community for tips, updates and direct support."
            cta="Open Community"
            locked={!isLifetime}
            lockedNote="Lifetime plan only"
            onLockedClick={() =>
              toast.info('Community is available only for Lifetime plan users. Upgrade to access.')
            }
          />
        </div>
      </div>

      {/* ------------------------ recent activity ------------------------ */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-2xs overflow-hidden flex flex-col">
        <div className="p-5 border-b border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-ink dark:text-white">Recent Prospect Activity</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 tabular-nums">
                {rows.length} Total
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Real-time audit log of discovered leads and verification verdicts.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-lg">
              {([
                ['all', `All (${rows.length})`],
                ['safe', `Verified Safe (${safeCount})`],
                ['risky', `Catch-all / Risky (${riskyCount})`],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    filter === key
                      ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-2xs'
                      : 'text-gray-500 hover:text-ink dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={exportCsv}
              className="h-8 px-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 font-semibold text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <FileDown className="h-3.5 w-3.5 text-gray-500" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {findsLoading ? (
          <div className="p-10 text-center text-xs text-gray-400">Loading recent activity…</div>
        ) : visibleRows.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center gap-2">
            <span className="h-10 w-10 rounded-full bg-gray-50 dark:bg-white/5 text-gray-400 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-ink dark:text-white">
              {rows.length === 0 ? 'No prospect activity yet' : 'Nothing matches this filter'}
            </p>
            <p className="text-xs text-gray-400 max-w-xs">
              {rows.length === 0
                ? 'Run your first lookup and discovered contacts will appear here.'
                : 'Try a different tab to see more results.'}
            </p>
            {rows.length === 0 && (
              <Link
                href="/find"
                className="mt-2 h-8 px-3 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-hover transition-colors flex items-center gap-1.5"
              >
                <Search className="h-3.5 w-3.5" />
                Find your first email
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-3 px-5">Prospect</th>
                  <th className="py-3 px-5">Company Domain</th>
                  <th className="py-3 px-5">Verified Email</th>
                  <th className="py-3 px-5">Deliverability Score</th>
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-5 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10 text-xs">
                {visibleRows.map((item, i) => {
                  const score = scoreOf(item)
                  const risky = isRisky(item)
                  const safe = isSafe(item)
                  return (
                    <tr
                      key={`${item.result.email}-${item.created_at}-${i}`}
                      className="hover:bg-gray-50/60 dark:hover:bg-white/5 transition-colors group"
                    >
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 shrink-0 rounded-full bg-brand-light dark:bg-brand/15 text-brand font-bold text-xs flex items-center justify-center border border-brand-border dark:border-brand/30">
                            {initialsOf(item.result.full_name, item.result.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-ink dark:text-white group-hover:text-brand transition-colors truncate">
                              {item.result.full_name || '—'}
                            </p>
                            <p className="text-[11px] text-gray-400 truncate">
                              {item.result.email_provider || 'Provider not reported'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-medium text-[11px]">
                          <Globe className="h-3 w-3 text-gray-400" />
                          {item.result.domain || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        {item.result.email ? <CopyCell email={item.result.email} /> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 h-6 rounded-full border px-2.5 text-[11px] font-semibold ${
                              safe
                                ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-[#059669]/15 dark:border-[#059669]/30'
                                : risky
                                  ? 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A] dark:bg-[#D97706]/15 dark:border-[#D97706]/30'
                                  : 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] dark:bg-[#DC2626]/15 dark:border-[#DC2626]/30'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                safe ? 'bg-[#059669]' : risky ? 'bg-[#D97706]' : 'bg-[#DC2626]'
                              }`}
                            />
                            {safe ? 'Deliverable' : risky ? 'Risky' : 'Undeliverable'}
                          </span>
                          {score !== null && (
                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 tabular-nums">
                              {score}/100
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-gray-500 dark:text-gray-400">
                        {relativeTime(item.created_at)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Link
                          href="/find"
                          className="text-[11px] font-bold text-brand hover:underline whitespace-nowrap"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
