'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BulkFinderWorkspace } from '@/components/bulk-finder-workspace'
import { FindResultPanel } from './components/find-result-panel'

/**
 * Credit cost shown on this page. Display strings only — the actual
 * deduction is done by the backend and is not affected by these values.
 */
const CREDITS_PER_FIND_LABEL = '20 Credits / Find'
const CREDITS_PER_FIND_TEXT = '20 credits'

import { toast } from 'sonner'
import { Search, Mail, ChevronDown, ChevronRight, AlertTriangle, UserSearch, UploadCloud, Loader2, ShieldCheck, CircleDollarSign, IdCard, Globe, Info, Database } from 'lucide-react'
import { isAuthenticated, saveRedirectUrl } from '@/lib/auth'
import { useQueryInvalidation } from '@/lib/query-invalidation'
import { useRecentFindResults } from '@/hooks/useRecentResults'
import { RecentFindResultsTable } from '@/components/recent-results-table'
import { ActiveJobsBanner } from '@/components/active-jobs-banner'
import { humanizeApiError } from '@/lib/api-error'

interface EmailResult {
  email: string | null
  confidence: number
  status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'error' | 'guessed'
  safeToSend?: boolean
  provider?: string
  fullName?: string
  creditsUsed?: number
  isCatchAllDomain?: boolean
  notice?: string
}

interface SearchHistoryItem {
  id: string
  payload: {
    full_name: string
    company_domain: string
    role?: string
  }
  result: EmailResult
  created_at: string
  raw?: {
    email: string | null
    full_name?: string
    email_provider?: string
    confidence_score?: number
    safe_to_send?: boolean
    status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'error' | 'guessed'
    credits_used?: number
    domain: string
    created_at: string
  }
}

export default function FindPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<EmailResult | null>(null)
  // Full backend payload, kept so the result panel can surface fields the
  // typed EmailResult does not model. Same request — nothing extra is fetched.
  const [rawResult, setRawResult] = useState<Record<string, unknown> | null>(null)
  // Which workspace is shown. Bulk renders inline; it is not a separate route.
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [hasSearched, setHasSearched] = useState(false)
  // Optional prefill from the dashboard's quick lookup. Values only populate
  // the form — no search runs and no credits are spent until Find is pressed.
  const searchParams = useSearchParams()
  const [firstName, setFirstName] = useState(() => searchParams.get('first') ?? '')
  const [lastName, setLastName] = useState(() => searchParams.get('last') ?? '')
  const [companyDomain, setCompanyDomain] = useState(() => searchParams.get('domain') ?? '')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { invalidateCreditsData } = useQueryInvalidation()
  const { data: recentFindResults, addResult: addRecentFindResult } = useRecentFindResults()
  const hasRecentResults = (recentFindResults?.length ?? 0) > 0
  const showRightColumn = !!result || hasSearched || hasRecentResults

  // Check authentication on component mount
  useEffect(() => {
    if (!isAuthenticated()) {
      // Save current URL for redirect after login
      saveRedirectUrl(window.location.pathname + window.location.search)
      // Redirect to login page
      router.push('/auth/login')
    }
  }, [router])

  const handleSubmit = async () => {
    if (isLoading) return

    if (!firstName.trim() || !lastName.trim() || !companyDomain.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    const combinedName = `${firstName.trim()} ${lastName.trim()}`.trim()

    setHasSearched(true)
    setIsLoading(true)
    setResult(null)
    setRawResult(null)
    setError(null)

    try {
      // Same normalisation and same request body as before — the two inputs
      // simply replace splitting one combined name field.
      const first_name = firstName.trim().toLowerCase().replace(/[^a-z]/g, '')
      const last_name = lastName.trim().toLowerCase().replace(/[^a-z]/g, '')
      const res = await fetch('/api/email/findEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: companyDomain,
          first_name,
          last_name
        }),
        credentials: 'include'
      })
      if (!res.ok) {
        try {
          const errJson = await res.json()
          const rawMsg = typeof errJson?.message === 'string' ? errJson.message : typeof errJson?.error === 'string' ? errJson.error : ''
          const msg = humanizeApiError(rawMsg, 'Failed to find email')
          setError(msg)
          toast.error(msg)
        } catch {
          setError('Failed to find email')
          toast.error('Failed to find email')
        }
        return
      }
      const raw = await res.json()
      const root = raw as Record<string, unknown>
      const payload = (typeof root?.data === 'object' && root.data !== null)
        ? (root.data as Record<string, unknown>)
        : (typeof root?.result === 'object' && root.result !== null)
          ? (root.result as Record<string, unknown>)
          : root
      const email = typeof payload?.email === 'string' ? (payload.email as string) : null
      const statusRaw = typeof payload?.status === 'string' ? (payload.status as string) : (typeof root?.status === 'string' ? (root.status as string) : undefined)
      const sLower = (statusRaw || '').toLowerCase()
      const status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'error' | 'guessed' =
        sLower === 'valid' || sLower === 'found' ? 'valid' :
        sLower === 'invalid' ? 'invalid' :
        sLower === 'risky' ? 'risky' :
        sLower === 'guessed' ? 'guessed' :
        sLower === 'error' ? 'error' : 'unknown'
      const confidence =
        typeof (payload as Record<string, unknown>)?.confidence_score === 'number'
          ? ((payload as Record<string, unknown>).confidence_score as number)
          : (typeof (payload as Record<string, unknown>)?.confidence === 'number'
              ? ((payload as Record<string, unknown>).confidence as number)
              : (email ? 95 : 0))
      const safeToSend = typeof (payload as Record<string, unknown>)?.safe_to_send === 'boolean'
        ? ((payload as Record<string, unknown>).safe_to_send as boolean)
        : undefined
      const provider = typeof (payload as Record<string, unknown>)?.email_provider === 'string'
        ? ((payload as Record<string, unknown>).email_provider as string)
        : undefined
      const fullNameResp = typeof (payload as Record<string, unknown>)?.full_name === 'string'
        ? ((payload as Record<string, unknown>).full_name as string)
        : undefined
      const creditsUsed = typeof (payload as Record<string, unknown>)?.credits_used === 'number'
        ? ((payload as Record<string, unknown>).credits_used as number)
        : undefined
      const isCatchAllDomain = (payload as Record<string, unknown>)?.is_catch_all_domain === true
      const noticeText = typeof (payload as Record<string, unknown>)?.notice === 'string'
        ? ((payload as Record<string, unknown>).notice as string)
        : undefined
      const nextResult: EmailResult = {
        email,
        confidence,
        status,
        safeToSend,
        provider,
        fullName: fullNameResp,
        creditsUsed,
        isCatchAllDomain,
        notice: noticeText
      }
      setResult(nextResult)
      setRawResult(payload as Record<string, unknown>)
      const rawHistory = {
        email,
        full_name: fullNameResp || combinedName,
        email_provider: provider,
        confidence_score: confidence,
        safe_to_send: safeToSend,
        status,
        credits_used: creditsUsed,
        domain: companyDomain,
        created_at: new Date().toISOString()
      }
      const newHistoryItem: SearchHistoryItem = {
        id: Date.now().toString(),
        payload: { full_name: combinedName, company_domain: companyDomain },
        result: nextResult,
        created_at: new Date().toISOString(),
        raw: rawHistory
      }
      setHistory(prev => {
        const next = [newHistoryItem, ...prev]
        return next.slice(0, 10)
      })
      toast.success('Email search completed!')
      invalidateCreditsData()
      // Optimistically add to recent results
      addRecentFindResult({
        result: {
          email: email,
          status: status,
          domain: companyDomain,
          confidence_score: confidence,
          safe_to_send: safeToSend,
          email_provider: provider,
          credits_used: creditsUsed,
          full_name: fullNameResp || combinedName,
        },
        created_at: new Date().toISOString(),
      })
    } catch {
      setError('An unexpected error occurred')
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
            Prospecting Engine
            <span aria-hidden="true">•</span>
            <span className="flex items-center gap-1.5 text-[#059669] normal-case tracking-normal font-mono-code font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
              SMTP Engine Online
            </span>
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">Find Email</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enter a person&apos;s name and company domain to discover their verified email address.
          </p>
        </div>

        {/* Quick stats strip — static display labels */}
        <div className="flex items-center gap-3 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 p-1.5 rounded-xl shadow-card shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F8FAFC] dark:bg-white/5 rounded-lg">
            <ShieldCheck className="h-[18px] w-[18px] text-brand shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] text-gray-400 font-medium leading-none">Accuracy</span>
              <span className="font-mono-code text-xs text-ink dark:text-white font-bold">99.4%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F8FAFC] dark:bg-white/5 rounded-lg">
            <CircleDollarSign className="h-[18px] w-[18px] text-brand shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] text-gray-400 font-medium leading-none">Usage Policy</span>
              <span className="font-mono-code text-xs text-ink dark:text-white font-bold whitespace-nowrap">
                {CREDITS_PER_FIND_LABEL}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mode selector — both modes live in this page; bulk is not a route */}
      <div className="flex items-center gap-1 bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setMode('single')}
          aria-pressed={mode === 'single'}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition-all ${
            mode === 'single'
              ? 'font-bold bg-white dark:bg-white/10 text-brand dark:text-white shadow-2xs'
              : 'font-semibold text-ink-muted hover:text-ink dark:hover:text-white'
          }`}
        >
          <UserSearch className="h-[17px] w-[17px]" />
          Single Email Search
        </button>
        <button
          type="button"
          onClick={() => setMode('bulk')}
          aria-pressed={mode === 'bulk'}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition-all ${
            mode === 'bulk'
              ? 'font-bold bg-white dark:bg-white/10 text-brand dark:text-white shadow-2xs'
              : 'font-semibold text-ink-muted hover:text-ink dark:hover:text-white'
          }`}
        >
          <UploadCloud className="h-[17px] w-[17px]" />
          Bulk File Upload (CSV)
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-ink-muted">
            Up to 50k
          </span>
        </button>
      </div>

      {mode === 'bulk' ? (
        <BulkFinderWorkspace showHeader={false} />
      ) : (
      <>

      <div className={`grid gap-6 items-start ${showRightColumn ? 'lg:grid-cols-12' : 'grid-cols-1 max-w-xl'}`}>
        {/* Search form — Stitch "Prospect Identity" card (5 of 12 cols) */}
        <div className={showRightColumn ? 'lg:col-span-5 lg:sticky lg:top-2 self-start' : ''}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 text-brand flex items-center justify-center">
                  <IdCard className="h-[18px] w-[18px]" />
                </span>
                <h2 className="text-base font-bold text-ink dark:text-white">Prospect Identity</h2>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 text-ink-muted shrink-0">
                Direct Lookup
              </span>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Provide full name and corporate domain. Credits are deducted only upon successful
              verified address discovery.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex flex-col gap-4 mt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="first-name" className="text-xs font-semibold text-ink dark:text-gray-200">
                    First Name
                  </label>
                  <input
                    id="first-name"
                    name="first-name"
                    type="text"
                    placeholder="e.g. Marc"
                    required
                    disabled={isLoading}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-ink dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all disabled:opacity-60"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="last-name" className="text-xs font-semibold text-ink dark:text-gray-200">
                    Last Name
                  </label>
                  <input
                    id="last-name"
                    name="last-name"
                    type="text"
                    placeholder="e.g. Benioff"
                    required
                    disabled={isLoading}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-ink dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="company-domain" className="text-xs font-semibold text-ink dark:text-gray-200">
                  Company Domain
                </label>
                <div className="relative flex items-center">
                  <Globe className="absolute left-3 h-[18px] w-[18px] text-gray-400 pointer-events-none" />
                  <input
                    id="company-domain"
                    name="company-domain"
                    type="text"
                    placeholder="salesforce.com or stripe.com"
                    required
                    disabled={isLoading}
                    value={companyDomain}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-ink dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Cost explanation notice */}
              <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-start gap-2.5">
                <Info className="h-[18px] w-[18px] text-brand mt-0.5 shrink-0" />
                <div className="flex flex-col text-xs text-gray-500 dark:text-gray-400 leading-snug">
                  <span>
                    Charges <strong className="text-ink dark:text-white font-semibold">{CREDITS_PER_FIND_TEXT}</strong>{' '}
                    only when a deliverable email is confirmed.
                  </span>
                  <span className="text-[11px] text-gray-400 mt-0.5">
                    0 charge on unresolvable names or invalid bounce states.
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !firstName.trim() || !lastName.trim() || !companyDomain.trim()}
                className="w-full h-10 rounded-lg bg-brand hover:bg-brand-hover text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-2xs active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-[18px] w-[18px] animate-spin" />
                    <span>Finding email...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-[18px] w-[18px]" />
                    <span>Find Email</span>
                  </>
                )}
              </button>
            </form>

            {/* Mini CSV promo */}
            <div className="mt-1 p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 shrink-0 rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-brand shadow-2xs">
                  <Database className="h-5 w-5" />
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-ink dark:text-white">Need high volume?</span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    Process spreadsheets up to 50k rows.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMode('bulk')}
                className="px-3 py-1.5 shrink-0 rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 hover:border-brand/50 text-ink dark:text-white font-semibold text-xs transition-colors shadow-2xs"
              >
                Open CSV
              </button>
            </div>
          </div>
        </div>

        {showRightColumn && (
          <div className="lg:col-span-7 space-y-6 min-w-0">
            {/* Result panel */}
            {hasSearched && (
              (() => {
                const isFound =
                  !!result &&
                  (result.status === 'valid' ||
                    result.status === 'guessed' ||
                    (!!result.email && !!result.isCatchAllDomain))

                // Successful find renders the full Stitch result panel.
                if (!isLoading && !error && isFound && result) {
                  return (
                    <FindResultPanel
                      result={result}
                      raw={rawResult}
                      companyDomain={companyDomain}
                      enteredName={`${firstName} ${lastName}`.trim()}
                    />
                  )
                }

                // Loading / error / not-found share a single state card.
                return (
                  <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card overflow-hidden">
                    {isLoading ? (
                      <div className="p-10 flex flex-col items-center justify-center text-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-brand" />
                        <p className="text-sm font-medium text-ink dark:text-white">Searching mail servers…</p>
                        <p className="text-xs text-gray-400">Running pattern discovery and SMTP checks.</p>
                      </div>
                    ) : error ? (
                      <div className="p-6 flex items-start gap-3">
                        <span className="h-8 w-8 shrink-0 rounded-lg bg-[#FEF2F2] dark:bg-[#DC2626]/15 text-[#DC2626] flex items-center justify-center">
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink dark:text-white">Search failed</p>
                          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">{error}</p>
                        </div>
                      </div>
                    ) : result ? (
                      <div className="p-10 flex flex-col items-center justify-center text-center gap-2">
                        <span className="h-10 w-10 rounded-full bg-[#F1F5F9] dark:bg-white/5 text-gray-400 flex items-center justify-center">
                          <Mail className="h-5 w-5" />
                        </span>
                        <p className="text-sm font-semibold text-ink dark:text-white">No email found</p>
                        <p className="text-xs text-gray-400 max-w-xs">
                          We couldn&apos;t discover a deliverable address for this name and domain.
                        </p>
                      </div>
                    ) : null}
                  </div>
                )
              })()
            )}

            {/* Active Jobs */}
            <ActiveJobsBanner />

            {/* Recent Results from API */}
            <RecentFindResultsTable />

            {/* Search History (current session) */}
            {history.length > 0 && (
              <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-6">
                <h3 className="text-[15px] font-semibold text-ink dark:text-white">Recent Searches</h3>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5 mb-4">
                  Your last {Math.min(history.length, 10)} email searches.
                </p>
                <div className="divide-y divide-gray-100 dark:divide-white/10">
                  {history.map((item) => {
                    const isValid = item.result.status === 'valid' || item.result.status === 'guessed' || (!!item.result.email && item.result.isCatchAllDomain === true)
                    const isExpanded = !!expanded[item.id]
                    return (
                      <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${isValid ? 'font-mono-code text-ink dark:text-white' : 'text-ink dark:text-white'}`}>
                              {isValid ? (item.result.email || '') : `${item.payload.full_name} @ ${item.payload.company_domain}`}
                            </p>
                            {isValid ? (
                              isExpanded ? (
                                <div className="space-y-1 mt-2">
                                  {item.result.fullName ? (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{`Full Name: ${item.result.fullName}`}</p>
                                  ) : null}
                                  {item.result.provider ? (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{`Provider: ${item.result.provider}`}</p>
                                  ) : null}
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {(() => {
                                      const c = Number(item.result.confidence || 0)
                                      const pct = c <= 1 ? Math.round(c * 100) : Math.round(c)
                                      return `Confidence: ${pct}%`
                                    })()}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {`Safe to Send: ${item.result.safeToSend === true ? 'Yes' : item.result.safeToSend === false ? 'No' : 'Unknown'}`}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {(() => {
                                      const s = item.result.status || 'unknown'
                                      const statusLabel = s === 'valid' ? 'Valid' : s === 'risky' ? 'Risky' : s === 'invalid' ? 'Invalid' : s === 'guessed' ? 'Guessed' : 'Unknown'
                                      return `Status: ${statusLabel}`
                                    })()}
                                  </p>
                                  {typeof item.result.creditsUsed === 'number' ? (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{`Credits Used: ${item.result.creditsUsed}`}</p>
                                  ) : null}
                                </div>
                              ) : null
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5">No email found</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isValid ? (
                              <button
                                onClick={() => setExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                aria-label="Toggle details"
                                className="text-gray-400 hover:text-ink dark:hover:text-white transition-colors"
                              >
                                {expanded[item.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            ) : null}
                            <span className="text-[11px] text-gray-400">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  )
}
