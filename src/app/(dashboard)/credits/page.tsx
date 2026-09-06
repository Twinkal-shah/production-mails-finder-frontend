'use client'

import { useState, useMemo, memo, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  Coins,
  ShieldCheck,
  CalendarClock,
  Check,
  Download,
  Receipt,
  RefreshCw,
  PlusCircle,
  Calendar,
  TrendingUp,
  Zap,
  CreditCard as CreditCardIcon,
} from 'lucide-react'
import { useCreditsData } from '@/hooks/useCreditsData'
import { Bar } from 'react-chartjs-2'
import { isAuthenticated, saveRedirectUrl } from '@/lib/auth'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement
)

interface CreditTransaction {
  id: string
  user_id: string
  lemonsqueezy_order_id?: string
  lemonsqueezy_subscription_id?: string
  product_name: string
  product_type: string
  amount: number
  credits_find_added: number
  credits_verify_added: number
  status: string
  webhook_event: string
  metadata?: Record<string, unknown>
  created_at: string
}

// Removed unused interfaces - UserProfile and CreditUsage are now imported from hooks

const PLANS = {
  free: {
    name: 'Free',
    price: '$0',
    duration: 'forever',
    features: ['Email Finder & Verifier only', '100 credits/day', 'No API access', 'No domain search', 'No export'],
    color: 'bg-gray-100 text-gray-800',
    icon: Calendar
  },
  monthly: {
    name: 'Monthly',
    price: '$9.99',
    duration: 'per month',
    features: [
      'Everything in Free',
      'Full Finder / Verifier / Enrichment APIs',
      'Domain search',
      '25,000 exports / month',
      'Unlimited Signals',
      '600 req/min'
    ],
    color: 'bg-blue-100 text-blue-800',
    icon: TrendingUp
  },
  lifetime: {
    name: 'Lifetime',
    price: '$249',
    duration: 'one-time',
    features: [
      'Finder / Verifier APIs',
      'Domain search',
      '5,000 exports / month',
      '1,000 Enrichment calls / month',
      '25 Signals / month',
      '300 req/min'
    ],
    color: 'bg-green-100 text-green-800',
    icon: TrendingUp
  },
  payg: {
    name: 'Pay As You Go',
    price: 'From $5',
    duration: 'one-time',
    features: [
      'Email Finder & Verifier only',
      'No APIs',
      'No domain search',
      'No exports',
      '60 req/min'
    ],
    color: 'bg-purple-100 text-purple-800',
    icon: Coins
  }
}

interface PurchaseItem {
  _id?: string
  id?: string
  product_name?: string
  product?: string
  amount?: number
  total?: number
  status?: string
  payment_status?: string
  createdAt?: string
  created_at?: string
  date?: string
}


function CreditsPageComponent() {
  const [loadingStates, setLoadingStates] = useState<{[key: string]: boolean}>({})
  const [isCreatingPortal, setIsCreatingPortal] = useState(false)
  const router = useRouter()
  
  // Check authentication on component mount
  useEffect(() => {
    if (!isAuthenticated()) {
      // Save current URL for redirect after login
      saveRedirectUrl(window.location.pathname + window.location.search)
      // Redirect to login page
      router.push('/auth/login')
    }
  }, [router])
  
  // Use React Query for data fetching with caching
  const { profile, transactions, creditUsage, isLoading, isError, error } = useCreditsData()
  // Normalize plan name (API returns e.g. "Monthly"; keys in PLANS are lowercase)
const planKey = (profile?.plan || 'free').toString().trim().toLowerCase() as keyof typeof PLANS;
const currentPlan = PLANS[planKey] || PLANS.free;

// ------------------ Purchase history (fetch from dedicated API) ------------------
  /* Auto-refill preference. Stored in this browser only — there is no backend
     endpoint for it yet, so the panel says so rather than implying it is live. */
  const [autoRefillOn, setAutoRefillOn] = useState(false)
  const [refillPack, setRefillPack] = useState(100000)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('autoRefillPref')
      if (raw) {
        const v = JSON.parse(raw) as { on?: boolean; pack?: number }
        if (typeof v.on === 'boolean') setAutoRefillOn(v.on)
        if (typeof v.pack === 'number') setRefillPack(v.pack)
      }
    } catch {}
  }, [])
  const saveAutoRefill = () => {
    try {
      localStorage.setItem('autoRefillPref', JSON.stringify({ on: autoRefillOn, pack: refillPack }))
      toast.success('Preference saved on this device. Automatic billing is not active yet.')
    } catch {
      toast.error('Could not save preference')
    }
  }

const [purchaseHistory, setPurchaseHistory] = useState<PurchaseItem[]>([])

const [isPurchaseLoading, setIsPurchaseLoading] = useState(true)

useEffect(() => {
  const fetchPurchaseHistory = async () => {
    setIsPurchaseLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

      const res = await fetch('/api/purchase/getMyPurchaseHistory', {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json'
        }
      })

     const text = await res.text()
let parsed: unknown = {}
try {
  parsed = text ? JSON.parse(text) : {}
} catch (err) {
  parsed = {}
}

type ApiShape = { success?: boolean; data?: unknown }

// helper type-guards
const isPurchaseArray = (v: unknown): v is PurchaseItem[] => Array.isArray(v) && v.every(item => typeof item === 'object' && item !== null)

const isApiObject = (v: unknown): v is ApiShape => typeof v === 'object' && v !== null

if (isPurchaseArray(parsed)) {
  // API returned array directly
  setPurchaseHistory(parsed)
} else if (isApiObject(parsed)) {
  const obj = parsed as ApiShape
  if (obj.success === true && isPurchaseArray(obj.data)) {
    setPurchaseHistory(obj.data)
  } else if (isPurchaseArray(obj.data)) {
    // fallback when success flag missing but data is an array
    setPurchaseHistory(obj.data)
  } else {
    setPurchaseHistory([])
    console.warn('Unexpected purchase history response (object without data array)', parsed)
  }
} else {
  setPurchaseHistory([])
  console.warn('Unexpected purchase history response (not array or object)', parsed)
}


    } catch (err) {
      console.error('Failed to fetch purchase history', err)
      setPurchaseHistory([])
    } finally {
      setIsPurchaseLoading(false)
    }
  }

  fetchPurchaseHistory()
}, [])
// -------------------------------------------------------------------------------


  
  
  // Memoize chart data to prevent unnecessary recalculations
  /**
   * Reads a per-engine value from a usage row.
   *
   * The daily-usage endpoint is a pass-through, so the key names vary. This
   * checks the row itself and any nested breakdown object, matching on a
   * normalised key (case- and separator-insensitive). Returns null when the
   * backend genuinely does not report the split — the UI then says so rather
   * than inventing a number.
   */
  const readSplit = (row: Record<string, unknown>, wanted: string[]): number | null => {
    const norm = (k: string) => k.toLowerCase().replace(/[^a-z]/g, '')
    const targets = wanted.map(norm)
    const scan = (obj: Record<string, unknown>): number | null => {
      for (const [k, v] of Object.entries(obj)) {
        if (!targets.includes(norm(k))) continue
        if (typeof v === 'number' && Number.isFinite(v)) return v
        if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
      }
      return null
    }
    const direct = scan(row)
    if (direct !== null) return direct
    for (const nestedKey of ['breakdown', 'byEngine', 'by_engine', 'engines', 'usage', 'details']) {
      const nested = row[nestedKey]
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const hit = scan(nested as Record<string, unknown>)
        if (hit !== null) return hit
      }
    }
    return null
  }

  const [usagePeriod, setUsagePeriod] = useState<'current' | 'previous'>('current')

  const filledUsage = useMemo(() => {
    const days = 14
    const offset = usagePeriod === 'previous' ? 14 : 0
    type Row = { total: number; find: number | null; verify: number | null }
    const map = new Map<string, Row>()
    for (const raw of creditUsage as Array<Record<string, unknown>>) {
      const k = new Date(String(raw.date)).toISOString().split('T')[0]
      map.set(k, {
        total: Number(raw.totalCreditsUsed ?? 0),
        find: readSplit(raw, [
          'findCredits', 'find_credits', 'credits_find', 'find', 'finderCredits',
          'findCreditsUsed', 'find_credits_used', 'creditsFind', 'finder', 'emailFinder', 'search',
        ]),
        verify: readSplit(raw, [
          'verifyCredits', 'verify_credits', 'credits_verify', 'verify', 'verifierCredits',
          'verifyCreditsUsed', 'verify_credits_used', 'creditsVerify', 'verifier', 'emailVerifier', 'verification',
        ]),
      })
    }
    const out: Array<{ date: string; totalCreditsUsed: number; find: number | null; verify: number | null }> = []
    const now = new Date()
    for (let i = days - 1 + offset; i >= offset; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const k = d.toISOString().split('T')[0]
      const row = map.get(k)
      out.push({
        date: k,
        totalCreditsUsed: row?.total ?? 0,
        find: row?.find ?? null,
        verify: row?.verify ?? null,
      })
    }
    return out
  }, [creditUsage, usagePeriod])

  /** True only when the backend actually reports a per-engine split. */
  const hasEngineSplit = useMemo(
    () => filledUsage.some((d) => d.find !== null || d.verify !== null),
    [filledUsage]
  )

  /** Totals for whichever period the tabs have selected. */
  const periodTotals = useMemo(() => {
    const used = filledUsage.reduce((a, d) => a + d.totalCreditsUsed, 0)
    const peak = filledUsage.reduce((a, d) => Math.max(a, d.totalCreditsUsed), 0)
    const activeDays = filledUsage.filter((d) => d.totalCreditsUsed > 0).length
    return { used, peak, avg: activeDays > 0 ? used / activeDays : 0 }
  }, [filledUsage])

  const engineTotals = useMemo(() => {
    const find = filledUsage.reduce((a, d) => a + (d.find ?? 0), 0)
    const verify = filledUsage.reduce((a, d) => a + (d.verify ?? 0), 0)
    const sum = find + verify
    return {
      find,
      verify,
      findPct: sum > 0 ? (find / sum) * 100 : 0,
      verifyPct: sum > 0 ? (verify / sum) * 100 : 0,
    }
  }, [filledUsage])

  const chartData = useMemo(() => {
    const labels = filledUsage.map((_, i) => String(i + 1).padStart(2, '0'))
    if (hasEngineSplit) {
      return {
        labels,
        datasets: [
          {
            label: 'Email Finder Core',
            data: filledUsage.map((d) => d.find ?? 0),
            backgroundColor: '#b71d40',
            borderRadius: 4,
            stack: 'usage',
          },
          {
            label: 'Verification Engine',
            data: filledUsage.map((d) => d.verify ?? 0),
            backgroundColor: '#94a3b8',
            borderRadius: 4,
            stack: 'usage',
          },
        ],
      }
    }
    return {
      labels,
      datasets: [
        {
          label: 'Credits Used',
          data: filledUsage.map((item) => item.totalCreditsUsed),
          backgroundColor: '#b71d40',
          borderRadius: 4,
          stack: 'usage',
        },
      ],
    }
  }, [filledUsage, hasEngineSplit])

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom' as const,
          labels: {
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            pointStyle: 'circle' as const,
            padding: 18,
            font: { size: 11 },
          },
        },
        title: { display: false },
      },
      scales: {
        y: { stacked: true, beginAtZero: true, display: false, grid: { display: false } },
        x: {
          stacked: true,
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 10 }, color: '#64748B', maxRotation: 0 },
        },
      },
    }),
    []
  )

  // If profile is missing, continue rendering without redirect.
  // The UI below guards profile-dependent sections and will show defaults.
  
  // Handle errors
  if (isError) {
    console.error('Error loading data:', error)
    toast.error('Failed to load data')
  }

  const [pending, startTransition] = useTransition()

  // Extract the backend-provided checkout URL. Supports multiple response shapes:
  //   1. { checkout_url }                              — simplified wrapper
  //   2. { data: { checkout_url } }                    — wrapped simplified
  //   3. { data: { data: { attributes: { url } } } }   — current backend shape
  //      (LemonSqueezy response passed through inside a { success, data } envelope)
  //   4. { data: { attributes: { url } } }             — raw LemonSqueezy shape (fallback)
  const extractCheckoutUrl = (json: unknown): string | undefined => {
    if (!json || typeof json !== 'object') return undefined
    const j = json as Record<string, unknown>
    if (typeof j.checkout_url === 'string') return j.checkout_url
    if (typeof j.url === 'string') return j.url
    const data = j.data
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      if (typeof d.checkout_url === 'string') return d.checkout_url
      if (typeof d.url === 'string') return d.url
      // Current backend shape: data.data.attributes.url
      const inner = d.data
      if (inner && typeof inner === 'object') {
        const innerAttrs = (inner as Record<string, unknown>).attributes
        if (innerAttrs && typeof innerAttrs === 'object') {
          const ia = innerAttrs as Record<string, unknown>
          if (typeof ia.url === 'string') return ia.url
          if (typeof ia.checkout_url === 'string') return ia.checkout_url
        }
      }
      // Legacy raw-LemonSqueezy shape: data.attributes.url
      const attrs = d.attributes
      if (attrs && typeof attrs === 'object') {
        const a = attrs as Record<string, unknown>
        if (typeof a.url === 'string') return a.url
        if (typeof a.checkout_url === 'string') return a.checkout_url
      }
    }
    return undefined
  }

  const postCheckout = async (payload: Record<string, string>): Promise<string> => {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))
    // Debug: surface the full response shape so URL-extraction issues are
    // obvious in the browser console. Safe to leave — contains no secrets.
    console.log('[checkout] response:', json)
    if (!res.ok) {
      const message =
        (json && typeof json === 'object' && typeof (json as Record<string, unknown>).message === 'string'
          ? ((json as Record<string, unknown>).message as string)
          : undefined) || `Checkout failed (HTTP ${res.status})`
      throw new Error(message)
    }
    const url = extractCheckoutUrl(json)
    if (!url) throw new Error('Checkout URL missing')
    return url
  }

  const handleSubscribe = (planName: 'monthly' | 'annual' | 'lifetime') => {
    const loadingKey = `plan-${planName}`
    setLoadingStates(prev => ({ ...prev, [loadingKey]: true }))
    // Build payload for the backend pricing taxonomy:
    //  - Monthly subscription  -> { plan: 'monthly', billing: 'monthly' }
    //  - Annual subscription   -> { plan: 'monthly', billing: 'annual' }
    //  - Lifetime              -> { plan: 'lifetime' }
    const payload: Record<string, string> =
      planName === 'lifetime'
        ? { plan: 'lifetime' }
        : { plan: 'monthly', billing: planName === 'annual' ? 'annual' : 'monthly' }
    startTransition(async () => {
      try {
        const url = await postCheckout(payload)
        window.location.href = url
      } catch (error) {
        console.error('Error creating subscription checkout:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to create checkout session')
      } finally {
        setLoadingStates(prev => ({ ...prev, [loadingKey]: false }))
      }
    })
  }

  const handleBuyCredits = (creditPackage: { credits: number }) => {
    // Map credit count to the PAYG package label expected by the backend.
    const paygPackageMap: Record<number, '10k' | '22k' | '42k' | '100k' | '250k'> = {
      10000: '10k',
      22000: '22k',
      42000: '42k',
      100000: '100k',
      250000: '250k',
    }
    const pkgLabel = paygPackageMap[creditPackage.credits]
    if (!pkgLabel) {
      toast.error('Invalid credit package')
      return
    }
    const loadingKey = `credits-${creditPackage.credits}`
    setLoadingStates(prev => ({ ...prev, [loadingKey]: true }))
    startTransition(async () => {
      try {
        const url = await postCheckout({ plan: 'payg', package: pkgLabel })
        window.location.href = url
      } catch (error) {
        console.error('Error creating custom credit checkout:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to create checkout session')
      } finally {
        setLoadingStates(prev => ({ ...prev, [loadingKey]: false }))
      }
    })
  }

  // Fetches the user's profile through the Next proxy and returns the
  // `lemonsqueezy_portal_url` that the backend has stored for this user.
  // The backend (post-LS integration) supplies this URL directly — we must
  // NOT call LemonSqueezy's API ourselves, as that would return an
  // app.lemonsqueezy.com URL instead of the custom billing.mailsfinder.com URL.
  //
  // Returns `{ url }` on success or `{ error, status }` on failure so callers
  // can decide between toast vs. redirect (e.g. 401 → login).
  const fetchPortalUrl = async (): Promise<{ url?: string; error?: string; status?: number }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
    const res = await fetch('/api/user/profile/getProfile', {
      method: 'GET',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'application/json',
      },
    })
    const text = await res.text()
    let parsed: unknown = null
    try { parsed = text ? JSON.parse(text) : null } catch { parsed = null }
    console.log('[billing] profile response:', parsed)

    if (res.status === 401 || res.status === 403) {
      return { error: 'Not authenticated. Please login first.', status: res.status }
    }
    if (!res.ok) {
      return { error: `Failed to load profile (HTTP ${res.status})`, status: res.status }
    }

    // Extract `lemonsqueezy_portal_url` from the known response shapes:
    //   - { success, data: { lemonsqueezy_portal_url } }   ← current backend
    //   - { lemonsqueezy_portal_url }                       ← flat fallback
    const readString = (o: unknown, ...keys: string[]): string | undefined => {
      let cur: unknown = o
      for (const k of keys) {
        if (!cur || typeof cur !== 'object') return undefined
        cur = (cur as Record<string, unknown>)[k]
      }
      return typeof cur === 'string' && cur.length > 0 ? cur : undefined
    }
    const portalUrl =
      readString(parsed, 'data', 'lemonsqueezy_portal_url') ||
      readString(parsed, 'lemonsqueezy_portal_url')

    if (!portalUrl) {
      return { error: 'No billing portal URL available for your account yet. Try again after your next payment event.', status: res.status }
    }
    return { url: portalUrl }
  }

  const openBillingPortal = async (successMessage: string) => {
    setIsCreatingPortal(true)
    try {
      const { url, error, status } = await fetchPortalUrl()
      if (status === 401 || status === 403) {
        toast.error(error || 'Not authenticated. Please login first.')
        saveRedirectUrl(window.location.pathname + window.location.search)
        router.push('/auth/login')
        return
      }
      if (error || !url) {
        toast.error(error || 'Billing portal URL unavailable')
        return
      }
      // Loud log so we can verify *exactly* what URL is being handed to the
      // browser. If the new tab still lands on app.lemonsqueezy.com/dashboard
      // while this log shows a billing.mailsfinder.com URL, the redirect is
      // happening on LemonSqueezy's side (not in our code).
      console.log('[billing] opening portal URL:', url)
      if (url.startsWith('/')) {
        router.push(url)
      } else {
        // Same-tab navigation — avoids popup blocker and lets the user see
        // the final URL in the address bar to confirm LemonSqueezy-side
        // redirect behavior. They can Back-button to return.
        window.location.href = url
      }
      toast.success(successMessage)
    } catch (err) {
      console.error('[billing] failed:', err)
      toast.error('Failed to load billing portal. Check console for details.')
    } finally {
      setIsCreatingPortal(false)
    }
  }

  const handleManageBilling = () => openBillingPortal('Redirecting to billing portal...')
  const handleCancelSubscription = () => openBillingPortal('Redirecting to billing portal to manage your subscription...')

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getOperationLabel = (transaction: CreditTransaction) => {
    // Map webhook events to user-friendly labels
    switch (transaction.webhook_event) {
      case 'order_created':
      case 'subscription_payment_success':
        return 'Credit Purchase'
      case 'subscription_created':
        return 'Subscription Started'
      case 'subscription_cancelled':
        return 'Subscription Cancelled'
      case 'subscription_expired':
        return 'Subscription Expired'
      default:
        // Fallback to product type or product name
        if (transaction.product_type) {
          return transaction.product_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
        }
        return transaction.product_name || 'Transaction'
    }
  }

  const pricingPlans = [
    {
      name: 'Monthly',
      price: 9.99,
      period: 'month',
      findCredits: 300000,
      verifyCredits: 300000,
      popular: true,
      features: [
        '300,000 credits / cycle',
        'Full Finder / Verifier / Enrichment APIs',
        'Domain search',
        '25,000 exports / month',
        'Unlimited Signals',
        '600 req/min',
        'Priority email support'
      ]
    },
    {
      name: 'Annual',
      price: 7.99,
      period: 'month',
      findCredits: 300000,
      verifyCredits: 300000,
      popular: false,
      features: [
        '300,000 credits / cycle',
        'Billed $95.88 / year',
        'Full Finder / Verifier / Enrichment APIs',
        'Domain search',
        '25,000 exports / month',
        'Unlimited Signals',
        '600 req/min',
        'Priority email support'
      ]
    },
    {
      name: 'Lifetime',
      price: 249,
      period: 'lifetime',
      findCredits: 2000000,
      verifyCredits: 2000000,
      popular: false,
      features: [
        '2,000,000 credits (lifetime pool)',
        'Finder / Verifier APIs',
        'Domain search',
        '5,000 exports / month',
        '1,000 Enrichment calls / month',
        '25 Signals / month',
        '300 req/min',
        'Lifetime access'
      ]
    }
  ]

  const customCreditPackages = [
    {
      credits: 10000,
      price: 5,
      description: '10,000 credits for email finding and verification'
    },
    {
      credits: 22000,
      price: 9,
      description: '22,000 credits for email finding and verification'
    },
    {
      credits: 42000,
      price: 14.99,
      description: '42,000 credits for email finding and verification'
    },
    {
      credits: 100000,
      price: 29,
      description: '100,000 credits for email finding and verification'
    },
    {
      credits: 250000,
      price: 59,
      description: '250,000 credits for email finding and verification'
    }
  ]

  // For free plans, assume they are not expired (plan expiry logic removed)
  const daysRemaining = profile?.plan === 'free' ? 3 : 0
  const isExpired = false

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header skeleton */}
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>

        {/* Current Balance skeleton */}
        <Card>
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse flex items-center justify-between">
              <div>
                <div className="h-10 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-24 mb-1"></div>
                <div className="h-3 bg-gray-200 rounded w-28"></div>
              </div>
              <div className="text-right">
                <div className="h-5 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two column cards skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Current Plan skeleton */}
          <Card>
            <CardHeader>
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-6 bg-gray-200 rounded w-20 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-12"></div>
                </div>
                <div className="h-16 bg-gray-200 rounded"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>

          {/* Chart skeleton */}
          <Card>
            <CardHeader>
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="animate-pulse">
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Plans skeleton */}
        <Card>
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-64 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom Credit Packages skeleton */}
        <Card>
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-40 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Billing Management skeleton */}
        <Card>
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse">
              <div className="h-10 bg-gray-200 rounded w-32"></div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions skeleton */}
        <Card>
          <CardHeader>
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  /* --- Real usage stats derived from the daily credit-usage series --- */
  const usageStats = (() => {
    const series = Array.isArray(creditUsage)
      ? (creditUsage as Array<{ date: string; totalCreditsUsed?: number }>)
      : []
    const dayMs = 86400000
    const now = Date.now()
    let last30 = 0
    let peak = 0
    let days = 0
    for (const d of series) {
      const used = Number(d?.totalCreditsUsed) || 0
      const t = new Date(String(d?.date || '').slice(0, 10)).getTime()
      if (Number.isNaN(t)) continue
      if (now - t <= 30 * dayMs) {
        last30 += used
        days += 1
        if (used > peak) peak = used
      }
    }
    const avgPerDay = days > 0 ? last30 / days : 0
    const balance = Math.max(Number(profile?.available_credits ?? 0), 0)
    const exhaustionDays = avgPerDay > 0 ? Math.floor(balance / avgPerDay) : null
    return { last30, peak, avgPerDay, exhaustionDays, balance }
  })()

  const renewalDate = profile?.plan_expiry ? new Date(profile.plan_expiry) : null

  /* Real per-bucket balances and quota caps from the profile API. */
  const buckets = (profile?.balances ?? {}) as Record<string, { balance?: number } | undefined>
  const bucketRows = (['monthly', 'lifetime', 'payg', 'free'] as const)
    .map((k) => ({ key: k, value: Number(buckets?.[k]?.balance ?? 0) }))
    .filter((b) => b.value > 0)
  const caps = profile?.caps
  const msToRenewal = renewalDate ? renewalDate.getTime() - Date.now() : null
  const daysToRenewal = msToRenewal === null ? null : Math.ceil(msToRenewal / 86400000)
  const renewalPassed = msToRenewal !== null && msToRenewal <= 0

  const exportInvoicesCsv = () => {
    if (purchaseHistory.length === 0) {
      toast.error('No invoices to export yet')
      return
    }
    const header = ['Date', 'Description', 'Amount', 'Payment Status']
    const lines = purchaseHistory.map((p) =>
      [
        formatDate(p.createdAt ?? p.created_at ?? p.date ?? ''),
        p.product_name ?? p.product ?? 'Purchase',
        `$${p.amount ?? p.total ?? 0}`,
        p.status ?? p.payment_status ?? 'completed',
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
    a.download = 'invoices.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="credits-page flex flex-col gap-8">
      {/* ------------------------------ Header ------------------------------ */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            <span>Enterprise Quota</span>
            <span aria-hidden="true">/</span>
            <span className="capitalize text-brand">{currentPlan.name}</span>
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">
            Billing &amp; Quotas
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Monitor credit burn-rate velocity, subscription status, and centralized fiscal invoices.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <Link
            href="/upgrade"
            className="h-9 px-3.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 font-semibold text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300 transition-colors flex items-center gap-2 shadow-2xs"
          >
            <RefreshCw className="h-4 w-4 text-gray-500" />
            Change Subscription
          </Link>
          <Link
            href="/upgrade"
            className="h-9 px-3.5 bg-brand text-white font-bold text-xs rounded-lg hover:bg-brand-hover transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <PlusCircle className="h-4 w-4" />
            Buy Credit Pack
          </Link>
        </div>
      </div>

      {/* --------------------------- Summary cards --------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Current plan */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-[18px] w-[18px] text-brand" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Current Plan
            </span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-lg font-bold text-ink dark:text-white">{currentPlan.name}</h3>
            <span className="inline-flex items-center gap-1.5 h-6 rounded-full border px-2.5 text-[11px] font-semibold bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-[#059669]/15 dark:border-[#059669]/30">
              <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
              Active
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-2xl font-bold text-ink dark:text-white">{currentPlan.price}</span>
            <span className="text-xs text-gray-400 font-medium">{currentPlan.duration}</span>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/10 space-y-1.5">
            {(currentPlan.features || []).slice(0, 3).map((feature: string) => (
              <div key={feature} className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-[#059669] mt-0.5 shrink-0" />
                <span className="text-[11px] text-gray-500 dark:text-gray-400">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Available balance */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="h-[18px] w-[18px] text-brand" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Available Balance
            </span>
          </div>
          <p className="text-2xl font-bold text-ink dark:text-white tabular-nums">
            {usageStats.balance.toLocaleString()}{' '}
            <span className="text-sm font-medium text-gray-400">Credits</span>
          </p>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500 dark:text-gray-400">Used (last 30 days)</span>
              <span className="font-semibold text-ink dark:text-white tabular-nums">
                {usageStats.last30.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500 dark:text-gray-400">Est. exhaustion</span>
              <span className="font-semibold text-ink dark:text-white tabular-nums">
                {usageStats.exhaustionDays === null
                  ? 'No recent usage'
                  : `${usageStats.exhaustionDays.toLocaleString()} days`}
              </span>
            </div>
          </div>
        </div>

        {/* Billing cycle */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-[18px] w-[18px] text-brand" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Billing Cycle
            </span>
          </div>
          <p className="text-lg font-bold text-ink dark:text-white">
            {renewalDate
              ? renewalDate.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'No renewal date'}
          </p>
          {daysToRenewal !== null && (
            renewalPassed ? (
              <span className="mt-2 inline-flex w-fit items-center h-6 rounded-full border border-[#FDE68A] dark:border-[#D97706]/30 bg-[#FFFBEB] dark:bg-[#D97706]/15 px-2.5 text-[11px] font-semibold text-[#D97706]">
                Renewal date passed
              </span>
            ) : (
              <span className="mt-2 inline-flex w-fit items-center h-6 rounded-full border border-brand-border dark:border-brand/30 bg-brand-light dark:bg-brand/15 px-2.5 text-[11px] font-semibold text-brand">
                In {daysToRenewal} {daysToRenewal === 1 ? 'day' : 'days'}
              </span>
            )
          )}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500 dark:text-gray-400">Plan</span>
              <span className="font-semibold text-ink dark:text-white capitalize">
                {(profile?.plan || 'free').toString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500 dark:text-gray-400">Billing</span>
              <span className="font-semibold text-ink dark:text-white">
                Handled by our payment provider
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------- Consumption + side rail ---------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <div className="lg:col-span-2 bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-6 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink dark:text-white">
              Credit Consumption Breakdown
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Cumulative monthly distribution across search queries and MX/SMTP verification passes.
            </p>
          </div>
          <div className="flex items-center bg-[#F1F5F9] dark:bg-white/5 p-1 rounded-lg shrink-0">
            {([['current','Current Month'],['previous','Previous']] as const).map(([k,label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setUsagePeriod(k)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  usagePeriod === k
                    ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-2xs'
                    : 'text-gray-500 hover:text-ink dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-[#F8FAFC] dark:bg-white/5 p-4">
            <p className="text-[13px] text-ink-muted dark:text-gray-400">Email Finder Core</p>
            <p className="mt-1 text-2xl font-bold text-ink dark:text-white tabular-nums">
              {hasEngineSplit ? engineTotals.find.toLocaleString() : '—'}
            </p>
            <p className="text-[13px] font-semibold text-brand mt-1">
              {hasEngineSplit ? `${engineTotals.findPct.toFixed(1)}% of aggregate` : 'Not reported'}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-[#F8FAFC] dark:bg-white/5 p-4">
            <p className="text-[13px] text-ink-muted dark:text-gray-400">Email Verifier Engine</p>
            <p className="mt-1 text-2xl font-bold text-ink dark:text-white tabular-nums">
              {hasEngineSplit ? engineTotals.verify.toLocaleString() : '—'}
            </p>
            <p className="text-[13px] font-medium text-ink-muted mt-1">
              {hasEngineSplit ? `${engineTotals.verifyPct.toFixed(1)}% of aggregate` : 'Not reported'}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-[#F8FAFC] dark:bg-white/5 p-4">
            <p className="text-[13px] text-ink-muted dark:text-gray-400">Unit Lead Cost</p>
            <p className="mt-1 text-2xl font-bold text-ink dark:text-white">1 Credit</p>
            <p className="text-[13px] font-medium text-emerald-600 mt-1">Per valid returned lead</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Daily Volumetric Velocity (Last 14 Days)
            </span>
            <span className="text-[11px] text-gray-400 tabular-nums">
              Peak: {periodTotals.peak.toLocaleString()} credits/day
            </span>
          </div>
          {creditUsage.length > 0 ? (
            <div className="h-72 rounded-xl bg-[#F8FAFC] dark:bg-white/5 p-4">
              <Bar data={chartData} options={chartOptions} />
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-center gap-1.5 rounded-lg bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10">
              <p className="text-sm font-semibold text-ink dark:text-white">No usage recorded yet</p>
              <p className="text-xs text-gray-400">
                Run a find or verify and your daily consumption appears here.
              </p>
            </div>
          )}
        </div>

        {/* Balance by bucket + quota caps — real values from the profile API */}
        {(bucketRows.length > 0 || caps) && (
          <div className="flex flex-col gap-2.5 pt-1">
            {bucketRows.map((b) => (
              <div
                key={b.key}
                className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-9 w-9 shrink-0 rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-brand flex items-center justify-center">
                    <Coins className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink dark:text-white capitalize">
                      {b.key} credits
                    </p>
                    <p className="text-[11px] text-gray-400">Spendable balance in this bucket</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-ink dark:text-white tabular-nums shrink-0">
                  {b.value.toLocaleString()}
                </span>
              </div>
            ))}

            {caps && typeof caps.enrichment_monthly_cap === 'number' && (
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-9 w-9 shrink-0 rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-brand flex items-center justify-center">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink dark:text-white">Enrichment calls</p>
                    <p className="text-[11px] text-gray-400">Monthly allowance</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-ink dark:text-white tabular-nums shrink-0">
                  {Number(caps.enrichment_used ?? 0).toLocaleString()} /{' '}
                  {Number(caps.enrichment_monthly_cap).toLocaleString()}
                </span>
              </div>
            )}

            {caps && typeof caps.signals_monthly_cap === 'number' && (
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-lg bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-9 w-9 shrink-0 rounded-lg bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-brand flex items-center justify-center">
                    <Calendar className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink dark:text-white">Signals</p>
                    <p className="text-[11px] text-gray-400">Monthly allowance</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-ink dark:text-white tabular-nums shrink-0">
                  {Number(caps.signals_used ?? 0).toLocaleString()} /{' '}
                  {Number(caps.signals_monthly_cap).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --------------------------- Right rail --------------------------- */}
      <div className="flex flex-col gap-5">
        {/* Auto-Recharge */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-[18px] w-[18px] text-brand" />
              <span className="text-sm font-bold text-ink dark:text-white">Auto-Recharge</span>
            </div>
            <span className="inline-flex items-center gap-1.5 h-6 rounded-full border px-2.5 text-[11px] font-semibold bg-[#FFFBEB] text-[#D97706] border-[#FDE68A] dark:bg-[#D97706]/15 dark:border-[#D97706]/30 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D97706]" />
              Not active yet
            </span>
          </div>

          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            Prevent API disruptions by loading credits before exhaustion.
          </p>

          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink dark:text-white">Auto Refill Guard</p>
              <p className="text-[11px] text-gray-400">Trigger when balance is low</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoRefillOn}
              onClick={() => setAutoRefillOn((v) => !v)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                autoRefillOn ? 'bg-brand' : 'bg-gray-300 dark:bg-white/20'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  autoRefillOn ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="refill-pack" className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Refill Increment
            </label>
            <select
              id="refill-pack"
              value={refillPack}
              onChange={(e) => setRefillPack(Number(e.target.value))}
              className="h-10 w-full px-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-ink dark:text-white outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            >
              {customCreditPackages.map((pkg) => (
                <option key={pkg.credits} value={pkg.credits}>
                  Add {pkg.credits.toLocaleString()} credits for ${pkg.price}
                </option>
              ))}
            </select>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Saved on this device. Automatic charging is not enabled yet — top up manually from
            Upgrade Plan.
          </p>

          <button
            type="button"
            onClick={saveAutoRefill}
            className="w-full h-10 rounded-lg bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 text-ink dark:text-white font-semibold text-xs hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            Save Auto-Refill Settings
          </button>
        </div>

        {/* Payment Method */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold text-ink dark:text-white">Payment Method</span>
            <button
              type="button"
              onClick={handleManageBilling}
              disabled={isCreatingPortal}
              className="text-[11px] font-bold text-brand hover:underline shrink-0 disabled:opacity-60"
            >
              {isCreatingPortal ? 'Opening…' : 'Update Card'}
            </button>
          </div>

          <div className="rounded-xl bg-ink text-white p-4 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <CreditCardIcon className="h-6 w-6 text-white/70" />
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 border border-white/20 px-2 py-0.5 rounded">
                On file
              </span>
            </div>
            <p className="font-mono-code text-sm text-white/90 tracking-widest">
              •••• •••• •••• ••••
            </p>
            <div className="flex items-center justify-between text-[11px] text-white/60">
              <span className="truncate">{profile?.full_name || 'Cardholder'}</span>
              <span>Managed securely</span>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Card details are held by our payment provider and are not stored here. Use Update Card to
            manage them in the billing portal.
          </p>
        </div>
      </div>
      </div>

      {/* ------------------------ Invoices & history ------------------------ */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink dark:text-white">
              Invoices &amp; Billing History
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Billing receipts, download records and reconciliation trail.
            </p>
          </div>
          <button
            type="button"
            onClick={exportInvoicesCsv}
            className="h-8 px-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-[#F8FAFC] dark:hover:bg-white/10 text-ink dark:text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs shrink-0 w-fit"
          >
            <Download className="h-4 w-4" />
            Export All (CSV)
          </button>
        </div>

        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card overflow-hidden">
          {isPurchaseLoading ? (
            <p className="text-gray-400 text-center text-xs py-10">Loading billing history…</p>
          ) : purchaseHistory.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center gap-2">
              <span className="h-10 w-10 rounded-full bg-[#F1F5F9] dark:bg-white/5 text-gray-400 flex items-center justify-center">
                <Receipt className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-ink dark:text-white">No invoices yet</p>
              <p className="text-xs text-gray-400 max-w-xs">
                Purchases and subscription payments will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[720px]">
                <thead>
                  <tr className="bg-[#F8FAFC] dark:bg-white/5 border-b border-gray-200 dark:border-white/10 text-gray-400 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5">Description</th>
                    <th className="py-3 px-5">Amount</th>
                    <th className="py-3 px-5">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10 text-xs">
                  {purchaseHistory.map((p) => {
                    const paid = String(p.status ?? p.payment_status ?? 'completed').toLowerCase()
                    const isPaid = paid === 'completed' || paid === 'paid' || paid === 'success'
                    return (
                      <tr
                        key={p._id ?? p.id ?? JSON.stringify(p)}
                        className="hover:bg-[#F8FAFC] dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="py-3.5 px-5 text-ink-muted whitespace-nowrap">
                          {formatDate(p.createdAt ?? p.created_at ?? p.date ?? '')}
                        </td>
                        <td className="py-3.5 px-5 font-medium text-ink dark:text-white">
                          {p.product_name ?? p.product ?? 'Purchase'}
                        </td>
                        <td className="py-3.5 px-5 font-mono-code font-semibold text-ink dark:text-white tabular-nums">
                          ${p.amount ?? p.total ?? 0}
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-flex items-center gap-1.5 h-6 rounded-full border px-2.5 text-[11px] font-semibold capitalize ${
                              isPaid
                                ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-[#059669]/15 dark:border-[#059669]/30'
                                : 'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A] dark:bg-[#D97706]/15 dark:border-[#D97706]/30'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${isPaid ? 'bg-[#059669]' : 'bg-[#D97706]'}`}
                            />
                            {isPaid ? 'Paid' : paid}
                          </span>
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
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
const CreditsPage = memo(CreditsPageComponent)

export default CreditsPage
