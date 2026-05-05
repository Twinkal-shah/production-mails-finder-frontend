'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe,
  Lock,
  MailSearch,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useUserProfile } from '@/hooks/useCreditsData'
import { useQueryInvalidation } from '@/lib/query-invalidation'
import { humanizeApiError } from '@/lib/api-error'
import {
  DOMAIN_REGEX,
  normalizeDomainInput,
  type DomainEmailResult,
  type DomainSearchData,
  type DomainSearchEnvelope,
} from './types'

type Mode = 'idle' | 'preview' | 'full'

const PAID_PLANS = new Set(['monthly', 'lifetime'])

function isPaidPlan(plan?: string | null): boolean {
  return !!plan && PAID_PLANS.has(plan.toLowerCase())
}

function formatDate(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString()
}

function StatusBadge({ status }: { status?: string | null }) {
  const s = (status || '').toLowerCase()
  if (s === 'valid') return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Valid</Badge>
  if (s === 'invalid') return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Invalid</Badge>
  if (s === 'risky') return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Risky</Badge>
  return <Badge variant="outline" className="text-gray-500">Unverified</Badge>
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  let data: T | null = null
  try {
    data = (await res.json()) as T
  } catch {}
  return { ok: res.ok, status: res.status, data }
}

export default function DomainSearchPage() {
  const router = useRouter()
  const { data: profile, isLoading: profileLoading } = useUserProfile()
  const { invalidateCreditsData } = useQueryInvalidation()

  const [domainInput, setDomainInput] = useState('')
  const [submittedDomain, setSubmittedDomain] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>('idle')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [fullLoading, setFullLoading] = useState(false)
  const [pageData, setPageData] = useState<DomainSearchData | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  // Modal state — only one of these is open at a time
  const [confirmCharge, setConfirmCharge] = useState<{ pageNum: number; size: number; cost: number } | null>(null)
  const [insufficientCredits, setInsufficientCredits] = useState<{ message: string } | null>(null)
  const [upgradeRequired, setUpgradeRequired] = useState<{ message: string } | null>(null)

  const totalPages = useMemo(() => {
    if (!pageData || !pageData.total || !pageSize) return 1
    return Math.max(1, Math.ceil(pageData.total / pageSize))
  }, [pageData, pageSize])

  const handle401 = () => {
    toast.error('Session expired. Please sign in again.')
    router.push('/auth/login')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setGlobalError(null)
    const cleaned = normalizeDomainInput(domainInput)
    if (!cleaned || !DOMAIN_REGEX.test(cleaned)) {
      setFormError("Please enter a valid domain (e.g. company.com).")
      return
    }
    setDomainInput(cleaned)
    setSubmittedDomain(cleaned)
    setExpanded({})
    setPage(1)
    setMode('preview')
    setPageData(null)
    setPreviewLoading(true)
    try {
      const res = await postJson<DomainSearchEnvelope>('/api/email/domainPreview', { domain: cleaned })
      if (res.status === 401) { handle401(); return }
      if (!res.ok || !res.data?.success || !res.data?.data) {
        const msg = humanizeApiError(res.data?.message || res.data?.error || '', 'Failed to load domain preview')
        setGlobalError(msg)
        toast.error(msg)
        return
      }
      setPageData(res.data.data)
    } catch (err) {
      const msg = humanizeApiError(err, 'Failed to load domain preview')
      setGlobalError(msg)
      toast.error(msg)
    } finally {
      setPreviewLoading(false)
    }
  }

  const fetchFullPage = async (nextPage: number, nextSize: number) => {
    if (!submittedDomain) return
    setFullLoading(true)
    setGlobalError(null)
    try {
      const res = await postJson<DomainSearchEnvelope>('/api/email/domainSearch', {
        domain: submittedDomain,
        page: nextPage,
        page_size: nextSize,
      })
      if (res.status === 401) { handle401(); return }
      if (res.status === 403 && res.data?.error === 'plan_not_allowed') {
        setUpgradeRequired({
          message: "You're on the Free plan. Upgrade to Monthly or Lifetime to unlock the full email list for any domain.",
        })
        return
      }
      const raw = res.data?.message || res.data?.error || ''
      const looksLikeInsufficientCredits =
        res.status === 400 && /credits?/i.test(raw) && /(would cost|insufficient|not enough|but you have)/i.test(raw)
      if (looksLikeInsufficientCredits) {
        setInsufficientCredits({ message: humanizeApiError(raw, 'Not enough credits to load this page.') })
        return
      }
      if (!res.ok || !res.data?.success || !res.data?.data) {
        const msg = humanizeApiError(raw, 'Failed to load full results')
        setGlobalError(msg)
        toast.error(msg)
        return
      }
      setPageData(res.data.data)
      setPage(nextPage)
      setPageSize(nextSize)
      setMode('full')
      setExpanded({})
      setSelected({})
      // Refresh credit balance shown elsewhere in the app (header, etc.)
      invalidateCreditsData()
    } catch (err) {
      const msg = humanizeApiError(err, 'Failed to load full results')
      setGlobalError(msg)
      toast.error(msg)
    } finally {
      setFullLoading(false)
    }
  }

  const requestFullPage = (nextPage: number, nextSize: number) => {
    if (!pageData) return
    // Only the first transition (preview → full) and page-size changes need
    // a confirm — page nav within the same size is already authorized.
    const needsConfirm = mode === 'preview' || nextSize !== pageSize
    const cost = Math.min(nextSize, Math.max(0, pageData.total - (nextPage - 1) * nextSize))
    if (needsConfirm && cost > 0) {
      setConfirmCharge({ pageNum: nextPage, size: nextSize, cost })
      return
    }
    fetchFullPage(nextPage, nextSize)
  }

  const handleVerifySelected = async () => {
    if (!pageData?.results.length) return
    const selectedEmails = pageData.results
      .filter(r => selected[r.email])
      .map(r => ({ email: r.email }))
      .filter(r => r.email)
    if (selectedEmails.length === 0) {
      toast.error('Select at least one email to verify.')
      return
    }
    setVerifying(true)
    try {
      const res = await postJson<{ success?: boolean; message?: string; data?: { job_id?: string } }>(
        '/api/email/verifyBulkEmailV2',
        { rows: selectedEmails }
      )
      if (res.status === 401) { handle401(); return }
      if (!res.ok || !res.data?.success) {
        toast.error(humanizeApiError(res.data?.message || '', 'Failed to start verification'))
        return
      }
      toast.success(`Verification started for ${selectedEmails.length} email${selectedEmails.length === 1 ? '' : 's'}. Track progress in Job History.`)
      invalidateCreditsData()
    } catch (err) {
      toast.error(humanizeApiError(err, 'Failed to start verification'))
    } finally {
      setVerifying(false)
    }
  }

  const visibleEmails = pageData?.results.map(r => r.email) ?? []
  const allVisibleSelected = visibleEmails.length > 0 && visibleEmails.every(e => selected[e])
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected({})
    } else {
      const next: Record<string, boolean> = {}
      visibleEmails.forEach(e => { next[e] = true })
      setSelected(next)
    }
  }
  const selectedCount = visibleEmails.filter(e => selected[e]).length

  const showStats = !!pageData && (pageData.total > 0 || !!pageData.mx_provider)
  const topPattern = useMemo(() => {
    if (!pageData?.patterns?.length) return null
    return [...pageData.patterns].sort((a, b) => b.count - a.count)[0]
  }, [pageData])

  // Treat user as paid if EITHER the profile says monthly/lifetime OR the
  // preview response says upgrade_required: false. Either signal alone is
  // enough — this avoids locking out a paid user when one source is stale.
  const paidByPlan = isPaidPlan(profile?.plan)
  const paidByPreview = pageData?.upgrade_required === false
  const paid = paidByPlan || paidByPreview
  const isFreeTier = !paid && !profileLoading

  // If a free user lands on the page after a previously cached profile, ensure
  // pageData reflects the preview-only flag (defensive).
  useEffect(() => {
    if (!pageData) return
    if (isFreeTier) setMode('preview')
  }, [isFreeTier, pageData])

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
          <MailSearch className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Domain Search</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Find every email at any company in seconds.
        </p>
      </div>

      <Card className="shadow-md border-gray-200 dark:border-white/10">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="domain" className="mb-2">Company domain</Label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  id="domain"
                  name="domain"
                  placeholder="e.g. klientsgrowth.com"
                  value={domainInput}
                  onChange={(e) => { setDomainInput(e.target.value); if (formError) setFormError(null) }}
                  disabled={previewLoading}
                  autoComplete="off"
                  className="flex-1 text-[#1b1c1b] dark:text-white placeholder-[#5a4042]/50 dark:placeholder-[#e2bebf]/50"
                />
                <Button type="submit" disabled={previewLoading || !domainInput.trim()} className="sm:px-6">
                  <Search className="mr-2 h-4 w-4" />
                  {previewLoading ? 'Searching...' : 'Search'}
                </Button>
              </div>
              {formError && (
                <p className="mt-2 text-sm text-red-600">{formError}</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {previewLoading && <ResultsSkeleton />}

      {globalError && !previewLoading && (
        <Card className="border-red-200 dark:border-red-900/40">
          <CardContent className="pt-6 text-sm text-red-700 dark:text-red-300">
            {globalError}
          </CardContent>
        </Card>
      )}

      {pageData && !previewLoading && (
        <>
          {showStats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-4 w-4" /> {pageData.domain}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-gray-500">Total emails</p>
                    <p className="text-2xl font-semibold">{pageData.total.toLocaleString()}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-gray-500">Mail provider</p>
                    <p className="text-2xl font-semibold">
                      {pageData.mx_provider || '—'}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-gray-500">Top pattern</p>
                    <p className="text-2xl font-semibold font-mono">
                      {topPattern ? topPattern.pattern : '—'}
                    </p>
                    {topPattern && (
                      <p className="text-xs text-gray-500 mt-1">
                        {Math.round(topPattern.percentage)}% of known emails
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {pageData.results.length === 0 && (
            pageData.hint === 'no_mx' ? (
              <EmptyState
                icon={<Globe className="h-6 w-6" />}
                title="This domain doesn't accept email."
                description="There's no mail server (MX record) configured for this domain, so it probably can't receive messages."
              />
            ) : pageData.hint === 'no_data' ? (
              <EmptyState
                icon={<MailSearch className="h-6 w-6" />}
                title="No emails on file for this domain yet."
                description="Try the Email Finder with a person's name to look up a specific contact."
                action={
                  <Link href="/find">
                    <Button variant="outline">Open Email Finder</Button>
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={<MailSearch className="h-6 w-6" />}
                title="No verified emails available right now."
                description="Try the Email Finder with a person's name to look up a specific contact."
                action={
                  <Link href="/find">
                    <Button variant="outline">Open Email Finder</Button>
                  </Link>
                }
              />
            )
          )}

          {pageData.results.length > 0 && (
            <>
              {/* Free / PAYG preview card */}
              {isFreeTier && pageData.is_preview && (
                <UpgradeCard
                  total={pageData.total}
                  domain={pageData.domain}
                  onSeeAll={() => setUpgradeRequired({
                    message: `You're on the Free plan. Upgrade to Monthly or Lifetime to unlock all ${pageData.total.toLocaleString()} email${pageData.total === 1 ? '' : 's'} for ${pageData.domain}.`,
                  })}
                />
              )}

              {/* Paid: show "See all X emails" call to action when only preview is loaded */}
              {paid && mode === 'preview' && pageData.total > pageData.results.length && (() => {
                const initialSize = Math.min(100, pageData.total)
                const initialCost = initialSize
                return (
                  <Card className="border-[var(--primary)]/30 bg-[var(--primary)]/5">
                    <CardContent className="pt-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
                      <div>
                        <p className="font-medium">Show all {pageData.total.toLocaleString()} emails</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {initialCost} credit{initialCost === 1 ? '' : 's'} for the first {initialSize} email{initialSize === 1 ? '' : 's'}
                          {pageData.total > initialSize ? ' • paginate for the rest' : ''}.
                        </p>
                      </div>
                      <Button
                        onClick={() => requestFullPage(1, initialSize)}
                        disabled={fullLoading}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {fullLoading ? 'Loading...' : `Show all (${initialCost} credits)`}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Toolbar (paid full mode only) */}
              {paid && mode === 'full' && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 accent-[var(--primary)]"
                      />
                      <span>{selectedCount > 0 ? `${selectedCount} selected` : 'Select all on page'}</span>
                    </label>
                    <span className="text-sm text-gray-400">|</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">Per page</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => requestFullPage(1, Number(v))}
                    >
                      <SelectTrigger className="w-[90px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerifySelected}
                    disabled={verifying || selectedCount === 0}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {verifying ? 'Starting...' : `Verify selected${selectedCount > 0 ? ` (${selectedCount})` : ''}`}
                  </Button>
                </div>
              )}

              {/* Results */}
              {fullLoading ? (
                <ResultsSkeleton />
              ) : (
                <ResultsList
                  results={pageData.results}
                  blurDetails={isFreeTier && pageData.is_preview}
                  expanded={expanded}
                  onToggle={(email) => setExpanded(prev => ({ ...prev, [email]: !prev[email] }))}
                  selectable={paid && mode === 'full'}
                  selected={selected}
                  onToggleSelect={(email) => setSelected(prev => {
                    const next = { ...prev }
                    if (next[email]) delete next[email]
                    else next[email] = true
                    return next
                  })}
                />
              )}

              {/* Pagination (paid full mode only) */}
              {paid && mode === 'full' && pageData.total > pageSize && (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Page {pageData.page} of {totalPages} • {pageData.total.toLocaleString()} total
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || fullLoading}
                      onClick={() => requestFullPage(page - 1, pageSize)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages || fullLoading}
                      onClick={() => requestFullPage(page + 1, pageSize)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {!submittedDomain && !previewLoading && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Search any domain to see emails, mail provider, and the most common email pattern.
        </p>
      )}

      {/* Confirm-charge dialog */}
      <Dialog open={!!confirmCharge} onOpenChange={(open) => { if (!open) setConfirmCharge(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm charge</DialogTitle>
            <DialogDescription>
              {confirmCharge && (
                <>
                  This will charge <span className="font-semibold">{confirmCharge.cost} credit{confirmCharge.cost === 1 ? '' : 's'}</span>
                  {' '}for {confirmCharge.cost} email{confirmCharge.cost === 1 ? '' : 's'} on this page. Continue?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCharge(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!confirmCharge) return
                const c = confirmCharge
                setConfirmCharge(null)
                fetchFullPage(c.pageNum, c.size)
              }}
            >
              Yes, charge {confirmCharge?.cost} credit{confirmCharge?.cost === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Insufficient credits dialog */}
      <Dialog open={!!insufficientCredits} onOpenChange={(open) => { if (!open) setInsufficientCredits(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Not enough credits</DialogTitle>
            <DialogDescription>
              {insufficientCredits?.message || 'This page would cost more credits than you have.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsufficientCredits(null)}>Close</Button>
            <Button onClick={() => { setInsufficientCredits(null); router.push('/credits') }}>
              <Sparkles className="mr-2 h-4 w-4" />
              Buy credits or upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan-not-allowed dialog */}
      <Dialog open={!!upgradeRequired} onOpenChange={(open) => { if (!open) setUpgradeRequired(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to unlock the full list</DialogTitle>
            <DialogDescription>
              {upgradeRequired?.message || "You're on the Free plan. Upgrade to Monthly or Lifetime to unlock the full email list for any domain."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeRequired(null)}>Maybe later</Button>
            <Button onClick={() => { setUpgradeRequired(null); router.push('/credits') }}>
              <Sparkles className="mr-2 h-4 w-4" />
              View plans
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ResultsSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="pt-10 pb-10 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500">
          {icon}
        </div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">{description}</p>
        {action && <div className="pt-2">{action}</div>}
      </CardContent>
    </Card>
  )
}

function UpgradeCard({
  total,
  domain,
  onSeeAll,
}: {
  total: number
  domain: string
  onSeeAll: () => void
}) {
  return (
    <Card className="border-[var(--primary)]/30 bg-gradient-to-br from-[var(--primary)]/10 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lock className="h-5 w-5 text-[var(--primary)]" /> {total.toLocaleString()} email{total === 1 ? '' : 's'} found at {domain}
        </CardTitle>
        <CardDescription>
          You&apos;re seeing a 3-email preview. Unlock the full list with names, titles, and LinkedIn profiles.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onSeeAll}>
          <Sparkles className="mr-2 h-4 w-4" />
          Show all {total.toLocaleString()} email{total === 1 ? '' : 's'}
        </Button>
      </CardContent>
    </Card>
  )
}

function ResultsList({
  results,
  blurDetails,
  expanded,
  onToggle,
  selectable = false,
  selected,
  onToggleSelect,
}: {
  results: DomainEmailResult[]
  blurDetails: boolean
  expanded: Record<string, boolean>
  onToggle: (email: string) => void
  selectable?: boolean
  selected?: Record<string, boolean>
  onToggleSelect?: (email: string) => void
}) {
  return (
    <Card>
      <CardContent className="pt-4 px-0 sm:px-2">
        <div className="divide-y dark:divide-white/10">
          {results.map((r) => {
            const isOpen = !!expanded[r.email]
            const isSelected = !!selected?.[r.email]
            return (
              <div key={r.email} className="px-3 sm:px-4 py-3">
                <div className="flex items-start gap-3">
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect?.(r.email)}
                      aria-label={`Select ${r.email}`}
                      className="mt-1 h-4 w-4 rounded border-gray-300 accent-[var(--primary)]"
                    />
                  )}
                  <button
                    onClick={() => onToggle(r.email)}
                    className="mt-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    aria-label="Toggle details"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-mono text-sm break-all">{r.email}</p>
                      <StatusBadge status={r.verification_status} />
                    </div>
                    <div className={`mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300 ${blurDetails ? 'select-none blur-sm' : ''}`}>
                      {r.full_name && <span>{r.full_name}</span>}
                      {r.title && <span>• {r.title}</span>}
                      {r.organization_name && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {r.organization_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className={`mt-3 ${selectable ? 'ml-13' : 'ml-7'} grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 dark:text-gray-300 ${blurDetails ? 'select-none blur-sm' : ''}`}>
                    {r.linkedin_url && (
                      <p className="inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        <a
                          href={blurDetails ? undefined : r.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--primary)] hover:underline truncate"
                        >
                          LinkedIn profile
                        </a>
                      </p>
                    )}
                    {r.country && <p>Country: {r.country}</p>}
                    {r.seniority_level && <p>Seniority: {r.seniority_level}</p>}
                    {r.department && <p>Department: {r.department}</p>}
                    {r.last_verified_at && <p>Last verified: {formatDate(r.last_verified_at)}</p>}
                    {typeof r.confidence_score === 'number' && <p>Confidence: {r.confidence_score}%</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
