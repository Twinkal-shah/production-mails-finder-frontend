'use client'

import { useState, useMemo, memo, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Coins, CreditCard, ExternalLink, History, TrendingUp, Calendar, CheckCircle, Plus } from 'lucide-react'
import { useCreditsData } from '@/hooks/useCreditsData'
import { Line } from 'react-chartjs-2'
import { isAuthenticated, saveRedirectUrl } from '@/lib/auth'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
  Filler
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
  const filledUsage = useMemo(() => {
    const days = 30
    const map = new Map<string, number>()
    for (const item of creditUsage as Array<{ date: string; totalCreditsUsed?: number }>) {
      const k = new Date(item.date).toISOString().split('T')[0]
      const v = Number(item.totalCreditsUsed ?? 0)
      map.set(k, v)
    }
    const out: Array<{ date: string; totalCreditsUsed: number }> = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const k = d.toISOString().split('T')[0]
      out.push({ date: k, totalCreditsUsed: map.get(k) ?? 0 })
    }
    return out
  }, [creditUsage])

  const chartData = useMemo(() => ({
    labels: filledUsage.map(item => {
      const date = new Date(item.date)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }),
    datasets: [
      {
        label: 'Credits Used',
        data: filledUsage.map(item => item.totalCreditsUsed),
        borderColor: '#b71d3f',
        backgroundColor: 'rgba(183, 29, 63, 0.10)',
        tension: 0.1,
        fill: true
      }
    ]
  }), [filledUsage])

  // Memoize chart options to prevent unnecessary recalculations
  const chartOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    }
  }), [])
  
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

  return (
    <div className="credits-page max-w-4xl mx-auto space-y-8">

      
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Credits & Billing</h1>
        <p className="text-gray-600 mt-2">
          Manage your credits and billing information.
        </p>
      </div>

      {/* Current Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Current Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
                {profile?.total_credits || 0}
              </p>
              <p className="text-gray-600">Total Available Credits</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-medium">
                Plan: {profile?.plan || 'Free'}
              </p>
              <p className="text-sm text-gray-600">
                Account: {profile?.full_name || 'User'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Plan and Daily Credit Usage Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Your Current Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Your Current Plan
            </CardTitle>
          </CardHeader>
          {/* <CardContent className="space-y-4">
            {profile && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">{PLANS[profile.plan as keyof typeof PLANS]?.name || profile.plan}</h3>
                    <p className="text-gray-600">
                      {PLANS[profile.plan as keyof typeof PLANS]?.price} {PLANS[profile.plan as keyof typeof PLANS]?.duration}
                    </p>
                  </div>
                  <Badge className={PLANS[profile.plan as keyof typeof PLANS]?.color || 'bg-gray-100 text-gray-800'}>
                    {profile.plan.toUpperCase()}
                  </Badge>
                </div>
                
                {profile.plan === 'free' && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      {isExpired 
                        ? "⚠️ Your free trial has expired. Please upgrade to continue using the service."
                        : `⏰ ${daysRemaining} days remaining in your free trial.`
                      }
                    </p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <h4 className="font-medium">Plan Features:</h4>
                  <ul className="space-y-1">
                    {(PLANS[profile.plan as keyof typeof PLANS]?.features || []).map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{profile.credits_find}</p>
                      <p className="text-sm text-gray-600">Find Credits</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{profile.credits_verify}</p>
                      <p className="text-sm text-gray-600">Verify Credits</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent> */}

          <CardContent className="space-y-4">
  {profile && (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold dark:text-gray-100">{currentPlan.name}</h3>
          <p className="text-gray-600 dark:text-gray-300">
            {currentPlan.price} {currentPlan.duration}
          </p>
        </div>
        <Badge className="bg-[var(--primary)] text-white">
          {(profile?.plan ?? 'free').toString().toUpperCase()}
        </Badge>
      </div>
      
      {profile.plan?.toLowerCase() === 'free' && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-700/40">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            {isExpired 
              ? "⚠️ Your free trial has expired. Please upgrade to continue using the service."
              : `⏰ ${daysRemaining} days remaining in your free trial.`}
          </p>
        </div>
      )}
      
      <div className="space-y-2">
        <h4 className="font-medium dark:text-gray-100">Plan Features:</h4>
        <ul className="space-y-1">
          {(currentPlan.features || []).map((feature, index) => (
            <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
      
      <div className="pt-4 border-t">
        <div className="text-center">
          <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{profile.total_credits || 0}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">Available Credits</p>
        </div>
      </div>
    </>
  )}
</CardContent>

        </Card>

        {/* Daily Credit Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Daily Credit Usage
            </CardTitle>
            <CardDescription>
              Track your daily credit consumption over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {creditUsage.length > 0 ? (
              <div className="h-64">
                <Line data={chartData} options={chartOptions} />
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No usage data available yet</p>
                  <p className="text-sm">Start using the service to see your credit usage</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pricing Plans */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Subscription Plans
          </CardTitle>
          <CardDescription>
            Choose a subscription plan that fits your needs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pricingPlans.map((plan) => {
              const isCurrentPlan = profile?.plan?.toLowerCase() === plan.name.toLowerCase()
              return (
                <Card 
                  key={plan.name} 
                  className={`relative ${
                    isCurrentPlan 
                      ? 'border-green-500 border-2 shadow-lg bg-green-50 dark:bg-green-900/25 dark:border-green-400/60' 
                      : plan.popular 
                      ? 'border-[var(--primary)] border-2 shadow-lg' 
                      : ''
                  }`}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-green-500 text-white text-sm px-3 py-1 rounded-full font-medium">
                        Current Plan
                      </span>
                    </div>
                  )}
                  {plan.popular && !isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="text-white text-sm px-3 py-1 rounded-full font-medium" style={{ backgroundColor: 'var(--primary)' }}>
                        Most Popular
                      </span>
                    </div>
                  )}
                  <CardContent className="pt-6">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{plan.name}</h3>
                      <div className="text-3xl font-bold mb-1" style={{ color: 'var(--primary)' }}>
                        ${plan.price}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {plan.period === 'lifetime' ? 'One-time payment' : `per ${plan.period}`}
                      </div>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: 'var(--primary)' }}></div>
                          <span className="text-sm text-gray-600 dark:text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                    
                    {isCurrentPlan ? (
                      <Button 
                        className="w-full"
                        onClick={handleCancelSubscription}
                        disabled={isCreatingPortal}
                        variant="destructive"
                        size="lg"
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        {isCreatingPortal ? 'Processing...' : 'Cancel Subscription'}
                      </Button>
                    ) : (
                      <Button 
                        className="w-full"
                        onClick={() => handleSubscribe(plan.name.toLowerCase() as 'monthly' | 'annual' | 'lifetime')}
                        disabled={loadingStates[`plan-${plan.name}`]}
                        variant={plan.popular ? 'default' : 'outline'}
                        size="lg"
                      >
                        <CreditCard className="mr-2 h-4 w-4" />
                        {loadingStates[`plan-${plan.name}`] ? 'Processing...' : (plan.period === 'lifetime' ? 'Get Lifetime Access' : 'Start Subscription')}
                      </Button>
                    )}
                    
                    {plan.period !== 'lifetime' && !isCurrentPlan && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                        Cancel anytime • No setup fees
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Credit Packages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Custom Credit Packages
          </CardTitle>
          <CardDescription>
            One-time credit purchases for immediate use
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {customCreditPackages.map((creditPackage, index) => (
              <div key={index} className="bg-gray-50 rounded-lg border p-4 hover:shadow-md transition-shadow">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {creditPackage.credits.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mb-3">Credits</div>
                  <div className="text-xl font-bold mb-3" style={{ color: 'var(--primary)' }}>
                    ${creditPackage.price}
                  </div>
                  <p className="text-xs text-gray-600 mb-4">
                    {creditPackage.description}
                  </p>
                  <Button
                    onClick={() => handleBuyCredits(creditPackage)}
                    disabled={loadingStates[`credits-${creditPackage.credits}`]}
                    className="w-full"
                    size="sm"
                  >
                    {loadingStates[`credits-${creditPackage.credits}`] ? 'Processing...' : 'Buy Credits'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Billing Management */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Management</CardTitle>
          <CardDescription>
            Manage your payment methods and billing history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline"
            onClick={handleManageBilling}
            disabled={isCreatingPortal}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Manage Billing
          </Button>
        </CardContent>
      </Card>

      {/* Transaction History */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Transactions
          </CardTitle>
          <CardDescription>
            Your last 10 credit transactions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No transactions yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Date</th>
                    <th className="text-left p-2 font-medium">Operation</th>
                    <th className="text-left p-2 font-medium">Amount</th>
                    <th className="text-left p-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b">
                      <td className="p-2 text-sm">
                        {formatDate(transaction.created_at)}
                      </td>
                      <td className="p-2">
                        <span className="text-sm font-medium">
                          {getOperationLabel(transaction)}
                        </span>
                      </td>
                      <td className="p-2">
                        <span className={`text-sm font-medium ${
                          transaction.amount > 0 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}${transaction.amount}
                        </span>
                      </td>
                      <td className="p-2 text-sm text-gray-600">
                        <div className="space-y-1">
                          <div>{transaction.product_name}</div>
                          {transaction.credits_find_added > 0 && (
                            <div className="text-xs text-green-600">
                              +{transaction.credits_find_added} Find Credits
                            </div>
                          )}
                          {transaction.credits_verify_added > 0 && (
                            <div className="text-xs text-green-600">
                              +{transaction.credits_verify_added} Verify Credits
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            Status: {transaction.status}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card> */}

      {/* Payment History (sourced from purchase API) */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <History className="h-5 w-5" />
      Payment History
    </CardTitle>
    <CardDescription>
      See your previous purchases & subscription payments.
    </CardDescription>
  </CardHeader>

  <CardContent>
    {isPurchaseLoading ? (
      <p className="text-gray-500 text-center py-8">Loading purchase history...</p>
    ) : purchaseHistory.length === 0 ? (
      <p className="text-gray-500 text-center py-8">No payments found.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 font-medium">Date</th>
              <th className="text-left p-2 font-medium">Product</th>
              <th className="text-left p-2 font-medium">Amount</th>
              <th className="text-left p-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {purchaseHistory.map((p) => (
              <tr key={p._id ?? p.id ?? JSON.stringify(p)} className="border-b">
                <td className="p-2 text-sm">
                  {formatDate(p.createdAt ?? p.created_at ?? p.date ?? '')}
                </td>

                <td className="p-2 text-sm">{p.product_name ?? p.product ?? 'Purchase'}
</td>

                <td className="p-2">
                  <span className="text-sm font-medium text-green-600">
                    ${p.amount ?? p.total ?? 0}
                  </span>
                </td>

                <td className="p-2 text-sm text-gray-600">
                  {p.status ?? p.payment_status ?? 'completed'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </CardContent>
</Card>

    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
const CreditsPage = memo(CreditsPageComponent)

export default CreditsPage
