'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { toast } from 'sonner'
import { Search, Mail, CheckCircle, Clock } from 'lucide-react'
import { findEmail as findEmailAction } from './actions'
import { isAuthenticated, saveRedirectUrl } from '@/lib/auth'
import { useQueryInvalidation } from '@/lib/query-invalidation'

interface EmailResult {
  email: string | null
  confidence: number
  status: 'found' | 'not_found' | 'error'
  verificationStatus?: 'valid' | 'invalid' | 'risky' | 'unknown' | 'error'
  verificationReason?: string
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
}

export default function FindPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<EmailResult | null>(null)
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const router = useRouter()
  const { invalidateCreditsData } = useQueryInvalidation()

  // Check authentication on component mount
  useEffect(() => {
    if (!isAuthenticated()) {
      // Save current URL for redirect after login
      saveRedirectUrl(window.location.pathname + window.location.search)
      // Redirect to login page
      router.push('/auth/login')
    }
  }, [router])

  const handleSubmit = async (formData: FormData) => {
    const fullName = formData.get('fullName') as string
    const companyDomain = formData.get('companyDomain') as string
    const role = formData.get('role') as string

    if (!fullName || !companyDomain) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      const cleaned = (fullName || '').trim().replace(/[\/,._\-@#$%]+/g, ' ')
      const parts = cleaned.split(/\s+/)
      const firstRaw = parts[0] || ''
      const lastRaw = parts.slice(1).join(' ') || ''
      const first_name = firstRaw.toLowerCase().replace(/[^a-z]/g, '')
      const last_name = lastRaw.toLowerCase().replace(/[^a-z]/g, '')
      const response = await findEmailAction({
        domain: companyDomain,
        first_name,
        last_name,
      })

      if (response.success) {
        setResult(response.result!)
        // Add to history (in a real app, this would come from the server)
        const newHistoryItem: SearchHistoryItem = {
          id: Date.now().toString(),
          payload: { full_name: fullName, company_domain: companyDomain, role },
          result: response.result!,
          created_at: new Date().toISOString(),
        }
        setHistory(prev => [newHistoryItem, ...prev.slice(0, 9)])
        toast.success('Email search completed!')
        invalidateCreditsData()
      } else {
        toast.error(response.error || 'Failed to find email')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Find Email</h1>
        <p className="text-gray-600 mt-2">
          Find professional email addresses using a person&apos;s name and company domain.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Search Form */}
        <Card>
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
            <form action={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  placeholder="e.g., John Doe"
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <Label htmlFor="companyDomain">Company Domain *</Label>
                <Input
                  id="companyDomain"
                  name="companyDomain"
                  placeholder="e.g., company.com"
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <Label htmlFor="role">Role (Optional)</Label>
                <Input
                  id="role"
                  name="role"
                  placeholder="e.g., Marketing Manager"
                  disabled={isLoading}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Finding Email...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Find Email
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-6">
          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Search Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.email ? (
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
                        const s = result.verificationStatus || 'unknown'
                        const statusLabel = s === 'valid' ? 'Valid' : s === 'risky' ? 'Risky' : s === 'invalid' ? 'Invalid' : 'Unknown'
                        return `Status: ${statusLabel}`
                      })()}
                    </div>
                    {(() => {
                      const s = result.verificationStatus || 'unknown'
                      const reason = result.verificationReason || ''
                      const msg =
                        s === 'risky'
                          ? 'This inbox exists, but Gmail is temporarily limiting verification.'
                          : s === 'invalid'
                          ? 'Mailbox is not deliverable (server rejected).'
                          : s === 'unknown'
                          ? 'Verification could not be completed (SMTP blocked or not reachable).'
                          : ''
                      return msg ? <div className="text-sm text-gray-500">{msg}</div> : null
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-600">No email found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Search History */}
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
                    <div key={item.id} className="border-l-4 border-blue-200 pl-4 py-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">
                            {item.payload.full_name} @ {item.payload.company_domain}
                          </p>
                          {item.result.email ? (
                            <div className="space-y-1">
                              <p className="text-sm text-gray-600 font-mono">{item.result.email}</p>
                              <p className="text-xs text-gray-500">
                                {(() => {
                                  const c = Number(item.result.confidence || 0)
                                  const pct = c <= 1 ? Math.round(c * 100) : Math.round(c)
                                  const s = item.result.verificationStatus || 'unknown'
                                  const statusLabel = s === 'valid' ? 'Valid' : s === 'risky' ? 'Risky' : s === 'invalid' ? 'Invalid' : 'Unknown'
                                  return `Confidence: ${pct}% • Status: ${statusLabel}`
                                })()}
                              </p>
                              {(() => {
                                const s = item.result.verificationStatus || 'unknown'
                                const msg =
                                  s === 'risky'
                                    ? 'Gmail is temporarily limiting verification.'
                                    : s === 'invalid'
                                    ? 'Mailbox is not deliverable.'
                                    : s === 'unknown'
                                    ? 'Verification blocked or unreachable.'
                                    : ''
                                return msg ? <p className="text-xs text-gray-400">{msg}</p> : null
                              })()}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">No email found</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
