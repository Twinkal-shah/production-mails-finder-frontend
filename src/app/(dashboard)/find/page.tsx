'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { toast } from 'sonner'
import { Search, Mail, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { isAuthenticated, saveRedirectUrl } from '@/lib/auth'
import { useQueryInvalidation } from '@/lib/query-invalidation'
import { useRecentFindResults } from '@/hooks/useRecentResults'
import { RecentFindResultsTable } from '@/components/recent-results-table'
import { ActiveJobsBanner } from '@/components/active-jobs-banner'

interface EmailResult {
  email: string | null
  confidence: number
  status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'error'
  safeToSend?: boolean
  provider?: string
  fullName?: string
  creditsUsed?: number
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
    status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'error'
    credits_used?: number
    domain: string
    created_at: string
  }
}

export default function FindPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<EmailResult | null>(null)
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
          const msg = typeof errJson?.message === 'string' ? errJson.message : typeof errJson?.error === 'string' ? errJson.error : 'Failed to find email'
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
      const status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'error' =
        sLower === 'valid' || sLower === 'found' ? 'valid' :
        sLower === 'invalid' ? 'invalid' :
        sLower === 'risky' ? 'risky' :
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
      const nextResult: EmailResult = {
        email,
        confidence,
        status,
        safeToSend,
        provider,
        fullName: fullNameResp,
        creditsUsed
      }
      setResult(nextResult)
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
    <div className={`mx-auto h-full flex flex-col items-center transition-all duration-700 ease-in-out ${showRightColumn
  ? 'max-w-6xl mt-6'
  : 'max-w-lg min-h-[calc(100vh-140px)] flex items-center justify-center'
}`}>
      <div className={`grid gap-8 w-full transition-all duration-700 ease-in-out ${showRightColumn ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Search Form */}
        <div className={`w-full transition-all duration-700 ease-in-out ${showRightColumn ? 'lg:sticky top-6 self-start' : 'mb-12'}`}>
          <Card className="shadow-lg border-gray-200 dark:border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Email Finder
              </CardTitle>
              <CardDescription>
                Enter the person&apos;s details to find their email address.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                <div className="mb-5">
                  <Label htmlFor="fullName" className="mb-2">Full Name *</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    placeholder="e.g., John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isLoading}
                    className="text-[#1b1c1b] dark:text-white placeholder-[#5a4042]/50 dark:placeholder-[#e2bebf]/50"
                  />
                </div>

                <div className="mb-5">
                  <Label htmlFor="companyDomain" className="mb-2">Company Domain *</Label>
                  <Input
                    id="companyDomain"
                    name="companyDomain"
                    placeholder="e.g., company.com"
                    value={companyDomain}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    required
                    disabled={isLoading}
                    className="text-[#1b1c1b] dark:text-white placeholder-[#5a4042]/50 dark:placeholder-[#e2bebf]/50"
                  />
                </div>

                <div className="mb-5">
                  <Label htmlFor="role" className="mb-2">Role (Optional)</Label>
                  <Input
                    id="role"
                    name="role"
                    placeholder="e.g., Marketing Manager"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={isLoading}
                    className="text-[#1b1c1b] dark:text-white placeholder-[#5a4042]/50 dark:placeholder-[#e2bebf]/50"
                  />
                </div>

                <Button type="submit"
                  disabled={isLoading || !fullName.trim() || !companyDomain.trim()}
                  className="w-full">
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Find Email
                  </>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {showRightColumn && (
        <div className="space-y-6 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto pb-10 pr-4">
          {hasSearched && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Search Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result ? (
                  result.status === 'valid' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Email Found</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="font-mono text-lg">{result.email}</p>
                      </div>
                      <div className="text-sm text-gray-600">
                        {(() => {
                          const c = Number(result.confidence || 0)
                          const pct = c <= 1 ? Math.round(c * 100) : Math.round(c)
                          return `Confidence: ${pct}%`
                        })()}
                      </div>
                      <div className="text-sm text-gray-600">
                        {(() => {
                          const s = result.status || 'unknown'
                          const statusLabel = s === 'valid' ? 'Valid' : s === 'risky' ? 'Risky' : s === 'invalid' ? 'Invalid' : 'Unknown'
                          return `Status: ${statusLabel}`
                        })()}
                      </div>
                      <div className="text-sm text-gray-600">
                        {`Safe to Send: ${result.safeToSend === true ? 'Yes' : result.safeToSend === false ? 'No' : 'Unknown'}`}
                      </div>
                      {result.provider ? (
                        <div className="text-sm text-gray-600">
                          {`Provider: ${result.provider}`}
                        </div>
                      ) : null}
                      {result.fullName ? (
                        <div className="text-sm text-gray-600">
                          {`Full Name: ${result.fullName}`}
                        </div>
                      ) : null}
                      {typeof result.creditsUsed === 'number' ? (
                        <div className="text-sm text-gray-600">
                          {`Credits Used: ${result.creditsUsed}`}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-600">No email found</p>
                    </div>
                  )
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Active Jobs */}
          <ActiveJobsBanner />

          {/* Recent Results from API */}
          <RecentFindResultsTable />

          {/* Search History (current session) */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Searches</CardTitle>
                <CardDescription>
                  Your last {Math.min(history.length, 10)} email searches.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="border-l-4 pl-4 py-2" style={{ borderLeftColor: 'rgba(226,190,191,0.5)' }}>
                      <div className="flex justify-between items-start">
                        <div>
                          {(() => {
                            const isValid = item.result.status === 'valid'
                            const isExpanded = !!expanded[item.id]
                            return (
                              <>
                                <p className="font-medium text-sm">
                                  {isValid ? (item.result.email || '') : `${item.payload.full_name} @ ${item.payload.company_domain}`}
                                </p>
                                {isValid ? (
                                  isExpanded ? (
                                    <div className="space-y-1 mt-1">
                                      {item.result.fullName ? (
                                        <p className="text-xs text-gray-600">{`Full Name: ${item.result.fullName}`}</p>
                                      ) : null}
                                      {item.result.provider ? (
                                        <p className="text-xs text-gray-600">{`Provider: ${item.result.provider}`}</p>
                                      ) : null}
                                      <p className="text-xs text-gray-600">
                                        {(() => {
                                          const c = Number(item.result.confidence || 0)
                                          const pct = c <= 1 ? Math.round(c * 100) : Math.round(c)
                                          return `Confidence: ${pct}%`
                                        })()}
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        {`Safe to Send: ${item.result.safeToSend === true ? 'Yes' : item.result.safeToSend === false ? 'No' : 'Unknown'}`}
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        {(() => {
                                          const s = item.result.status || 'unknown'
                                          const statusLabel = s === 'valid' ? 'Valid' : s === 'risky' ? 'Risky' : s === 'invalid' ? 'Invalid' : 'Unknown'
                                          return `Status: ${statusLabel}`
                                        })()}
                                      </p>
                                      {typeof item.result.creditsUsed === 'number' ? (
                                        <p className="text-xs text-gray-600">{`Credits Used: ${item.result.creditsUsed}`}</p>
                                      ) : null}
                                    </div>
                                  ) : null
                                ) : (
                                  <p className="text-sm text-gray-500">No email found</p>
                                )}
                              </>
                            )
                          })()}
                        </div>
                        <div className="flex items-center gap-2">
                          {item.result.status === 'valid' ? (
                            <button
                              onClick={() => setExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                              aria-label="Toggle details"
                              className="text-gray-500"
                            >
                              {expanded[item.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : null}
                          <span className="text-xs text-gray-400">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
