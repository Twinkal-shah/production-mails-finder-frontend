'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BulkFinderWorkspace } from '@/components/bulk-finder-workspace'
import { FindResultPanel } from './components/find-result-panel'

import { toast } from 'sonner'
import { Search, Mail, ChevronDown, ChevronRight, AlertTriangle, UserSearch, UploadCloud, Loader2, Target, Gauge } from 'lucide-react'
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
  const [fullName, setFullName] = useState('')
  const [companyDomain, setCompanyDomain] = useState('')
  const [role, setRole] = useState('')
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

    if (!fullName.trim() || !companyDomain.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    setHasSearched(true)
    setIsLoading(true)
    setResult(null)
    setRawResult(null)
    setError(null)

    try {
      const cleaned = (fullName || '').trim().replace(/[\/,._\-@#$%]+/g, ' ')
      const parts = cleaned.split(/\s+/)
      const firstRaw = parts[0] || ''
      const lastRaw = parts.slice(1).join(' ') || ''
      const first_name = firstRaw.toLowerCase().replace(/[^a-z]/g, '')
      const last_name = lastRaw.toLowerCase().replace(/[^a-z]/g, '')
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
        full_name: fullNameResp || fullName,
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
        payload: { full_name: fullName, company_domain: companyDomain, role },
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
          full_name: fullNameResp || fullName,
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

        {/* Accuracy + usage policy (static display labels) */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-2xs">
            <Gauge className="h-4 w-4 text-[#059669]" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Accuracy</span>
            <span className="text-xs font-bold text-ink dark:text-white tabular-nums">99.4%</span>
          </div>
          <div className="flex items-center gap-2 h-9 px-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-2xs">
            <Target className="h-4 w-4 text-brand" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Usage Policy</span>
            <span className="text-xs font-bold text-ink dark:text-white">20 Credits / Find</span>
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

      <div className={`grid gap-6 items-start ${showRightColumn ? 'lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]' : 'grid-cols-1 max-w-xl'}`}>
        {/* Search form */}
        <div className={showRightColumn ? 'lg:sticky lg:top-2 self-start' : ''}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-6">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink dark:text-white">
                <span className="h-8 w-8 rounded-lg bg-brand-light dark:bg-brand/15 text-brand flex items-center justify-center">
                  <UserSearch className="h-4 w-4" />
                </span>
                Prospect Identity
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wide text-brand bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 px-2 py-0.5 rounded">
                Smart Lookup
              </span>
            </div>
            <p className="text-[13px] leading-5 text-gray-500 dark:text-gray-400 mb-5">
              Provide the name and corporate domain. Credits are only deducted on a successful,
              verified address discovery.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
              <div>
                <Label htmlFor="fullName" className="mb-2 text-xs font-semibold text-ink dark:text-gray-200">
                  Full Name <span className="text-brand">*</span>
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  placeholder="e.g., John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="companyDomain" className="mb-2 text-xs font-semibold text-ink dark:text-gray-200">
                  Company Domain <span className="text-brand">*</span>
                </Label>
                <Input
                  id="companyDomain"
                  name="companyDomain"
                  placeholder="e.g., company.com"
                  value={companyDomain}
                  onChange={(e) => setCompanyDomain(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="role" className="mb-2 text-xs font-semibold text-ink dark:text-gray-200">
                  Role <span className="font-normal text-gray-400">(Optional)</span>
                </Label>
                <Input
                  id="role"
                  name="role"
                  placeholder="e.g., Marketing Manager"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !fullName.trim() || !companyDomain.trim()}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finding email...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Find Email
                  </>
                )}
              </Button>
            </form>

            {/* High-volume prompt */}
            <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-ink dark:text-white">Need high volume?</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Process spreadsheets in bulk.</p>
              </div>
              <Link
                href="/bulk-finder"
                className="h-8 px-3 shrink-0 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-[11px] font-bold text-ink dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300 transition-colors flex items-center gap-1.5"
              >
                <UploadCloud className="h-3.5 w-3.5 text-gray-500" />
                Open bulk
              </Link>
            </div>
          </div>
        </div>

        {showRightColumn && (
          <div className="space-y-6 min-w-0">
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
                      enteredName={fullName}
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
