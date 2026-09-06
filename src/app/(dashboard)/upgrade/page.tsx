'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Check, Minus, Loader2, Zap, Database, ArrowRight } from 'lucide-react'
import { useUserProfile } from '@/hooks/useCreditsData'

export const dynamic = 'force-dynamic'

/**
 * Upgrade Plan — built to the Stitch "Upgrade Plan" screen.
 *
 * Pricing, plan names and credit packs are the real ones already used by the
 * Billing & Quota page, and checkout goes through the same `/api/checkout`
 * endpoint with the same payload shapes. No pricing or packaging changes.
 */

type PlanKey = 'monthly' | 'annual' | 'lifetime'

const PRICING_PLANS: Array<{
  key: PlanKey
  name: string
  price: number
  period: string
  note?: string
  blurb: string
  featuresLabel: string
  features: string[]
  popular: boolean
}> = [
  {
    key: 'monthly',
    name: 'Monthly',
    price: 9.99,
    period: '/ month',
    blurb: 'Essential toolkit for founders and solo SDRs validating targeted accounts.',
    featuresLabel: 'Included in Monthly',
    features: [
      '300,000 credits / cycle',
      'Full Finder / Verifier / Enrichment APIs',
      'Domain search',
      '25,000 exports / month',
      'Unlimited Signals',
      '600 req/min',
      'Priority email support',
    ],
    popular: true,
  },
  {
    key: 'annual',
    name: 'Annual',
    price: 7.99,
    period: '/ month',
    note: 'Billed $95.88 / year',
    blurb: 'The same monthly plan, billed yearly for a lower effective rate.',
    featuresLabel: 'Everything in Monthly, plus:',
    features: [
      '300,000 credits / cycle',
      'Billed $95.88 / year',
      'Full Finder / Verifier / Enrichment APIs',
      'Domain search',
      '25,000 exports / month',
      'Unlimited Signals',
      '600 req/min',
      'Priority email support',
    ],
    popular: false,
  },
  {
    key: 'lifetime',
    name: 'Lifetime',
    price: 249,
    period: 'one time',
    blurb: 'A single payment for a lifetime credit pool — no recurring billing.',
    featuresLabel: 'One-time purchase includes:',
    features: [
      '2,000,000 credits (lifetime pool)',
      'Finder / Verifier APIs',
      'Domain search',
      '5,000 exports / month',
      '1,000 Enrichment calls / month',
      '25 Signals / month',
      '300 req/min',
      'Lifetime access',
    ],
    popular: false,
  },
]

const CREDIT_PACKS = [
  { credits: 10000, price: 5, label: 'Quick Boost', blurb: 'Great for immediate list cleansing before an outbound campaign.' },
  { credits: 22000, price: 9, label: 'Starter Surge', blurb: 'A step up for steady weekly prospecting volume.' },
  { credits: 42000, price: 14.99, label: 'Growth Surge', blurb: 'For SDR pods scrubbing monthly inbound or event lists.' },
  { credits: 100000, price: 29, label: 'Scale Volume', blurb: 'High-volume enrichment across large target accounts.' },
  { credits: 250000, price: 59, label: 'Max Volume', blurb: 'Bulk provisioning for sustained multi-team campaigns.' },
]

const PAYG_PACKAGE_MAP: Record<number, '10k' | '22k' | '42k' | '100k' | '250k'> = {
  10000: '10k',
  22000: '22k',
  42000: '42k',
  100000: '100k',
  250000: '250k',
}

/* --- checkout URL extraction: identical shapes to the Billing page --- */
function extractCheckoutUrl(json: unknown): string | undefined {
  if (!json || typeof json !== 'object') return undefined
  const j = json as Record<string, unknown>
  if (typeof j.checkout_url === 'string') return j.checkout_url
  if (typeof j.url === 'string') return j.url
  const data = j.data
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.checkout_url === 'string') return d.checkout_url
    if (typeof d.url === 'string') return d.url
    const inner = d.data
    if (inner && typeof inner === 'object') {
      const innerAttrs = (inner as Record<string, unknown>).attributes
      if (innerAttrs && typeof innerAttrs === 'object') {
        const ia = innerAttrs as Record<string, unknown>
        if (typeof ia.url === 'string') return ia.url
        if (typeof ia.checkout_url === 'string') return ia.checkout_url
      }
    }
    const attrs = d.attributes
    if (attrs && typeof attrs === 'object') {
      const a = attrs as Record<string, unknown>
      if (typeof a.url === 'string') return a.url
      if (typeof a.checkout_url === 'string') return a.checkout_url
    }
  }
  return undefined
}

async function postCheckout(payload: Record<string, string>): Promise<string> {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
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

export default function UpgradePlanPage() {
  const { data: profile } = useUserProfile()
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()

  const currentPlan = (profile?.plan || 'free').toString().trim().toLowerCase()

  const handleSubscribe = (planName: PlanKey) => {
    const loadingKey = `plan-${planName}`
    setLoadingStates((prev) => ({ ...prev, [loadingKey]: true }))
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
        setLoadingStates((prev) => ({ ...prev, [loadingKey]: false }))
      }
    })
  }

  const handleBuyCredits = (creditPackage: { credits: number }) => {
    const pkgLabel = PAYG_PACKAGE_MAP[creditPackage.credits]
    if (!pkgLabel) {
      toast.error('Invalid credit package')
      return
    }
    const loadingKey = `credits-${creditPackage.credits}`
    setLoadingStates((prev) => ({ ...prev, [loadingKey]: true }))
    startTransition(async () => {
      try {
        const url = await postCheckout({ plan: 'payg', package: pkgLabel })
        window.location.href = url
      } catch (error) {
        console.error('Error creating custom credit checkout:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to create checkout session')
      } finally {
        setLoadingStates((prev) => ({ ...prev, [loadingKey]: false }))
      }
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 px-2.5 py-1 rounded-full">
          <Zap className="h-3.5 w-3.5" />
          Flexible Allocation
        </span>
        <h1 className="mt-4 text-2xl sm:text-[32px] leading-tight font-bold tracking-tight text-ink dark:text-white">
          Simple, transparent plans for high-precision prospecting
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          Scale verified B2B leads, real-time SMTP handshakes, and data enrichment with predictable
          credit volumes.
        </p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {PRICING_PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.key
          const loadingKey = `plan-${plan.key}`
          const isLoading = !!loadingStates[loadingKey]
          return (
            <div
              key={plan.key}
              className={[
                'relative flex flex-col rounded-xl bg-white dark:bg-[#1a1a1a] p-6 transition-all',
                plan.popular
                  ? 'border-2 border-brand shadow-card-hover lg:-mt-2 lg:pb-8'
                  : 'border border-gray-200 dark:border-white/10 shadow-card hover:border-gray-300 dark:hover:border-white/20',
              ].join(' ')}
            >
              {(plan.popular || isCurrent) && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-brand text-white px-2.5 py-1 rounded-full shadow-2xs">
                    {isCurrent ? 'Current plan' : 'Most popular'}
                  </span>
                </div>
              )}

              <h2 className="text-[15px] font-bold text-ink dark:text-white">{plan.name}</h2>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-sm font-semibold text-gray-400">$</span>
                <span className="text-[34px] leading-none font-bold tracking-tight text-ink dark:text-white tabular-nums">
                  {plan.price}
                </span>
                <span className="text-xs font-medium text-gray-400 ml-1">{plan.period}</span>
              </div>
              {plan.note && <p className="mt-1.5 text-[11px] font-medium text-gray-400">{plan.note}</p>}

              <p className="mt-3 text-[13px] leading-5 text-gray-500 dark:text-gray-400">{plan.blurb}</p>

              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-white/10 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
                  {plan.featuresLabel}
                </p>
                <ul className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="h-4 w-4 shrink-0 mt-0.5 text-[#059669]" />
                      <span className="text-[13px] leading-5 text-gray-600 dark:text-gray-300">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => handleSubscribe(plan.key)}
                disabled={isLoading || isCurrent}
                className={[
                  'mt-6 h-10 w-full rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed',
                  plan.popular && !isCurrent
                    ? 'bg-brand text-white hover:bg-brand-hover'
                    : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-ink dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300',
                ].join(' ')}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Redirecting…
                  </>
                ) : isCurrent ? (
                  'Your current plan'
                ) : (
                  <>
                    Choose {plan.name}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Credit packs */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink dark:text-white">
              <span className="h-8 w-8 rounded-lg bg-brand-light dark:bg-brand/15 text-brand flex items-center justify-center">
                <Database className="h-4 w-4" />
              </span>
              Need one-time on-demand credits?
            </h2>
            <p className="mt-1.5 text-[13px] text-gray-500 dark:text-gray-400">
              No recurring contracts. Credits stack directly onto your active workspace balance.
            </p>
          </div>
          <Link
            href="/credits"
            className="text-xs font-semibold text-brand hover:underline shrink-0"
          >
            View billing history →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {CREDIT_PACKS.map((pack) => {
            const loadingKey = `credits-${pack.credits}`
            const isLoading = !!loadingStates[loadingKey]
            return (
              <div
                key={pack.credits}
                className="flex flex-col rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 shadow-card p-5 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-card-hover transition-all"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {pack.label}
                </p>
                <p className="mt-2 text-xl font-bold text-ink dark:text-white tabular-nums leading-none">
                  {pack.credits.toLocaleString()}
                </p>
                <p className="text-[11px] font-medium text-gray-400 mt-1">Credits</p>
                <p className="mt-3 text-[12px] leading-[18px] text-gray-500 dark:text-gray-400 flex-1">
                  {pack.blurb}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-lg font-bold text-ink dark:text-white tabular-nums">
                    ${pack.price}
                  </span>
                  <span className="text-[11px] text-gray-400">one-off</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleBuyCredits(pack)}
                  disabled={isLoading}
                  className="mt-3 h-9 w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-[11px] font-bold text-ink dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300 transition-colors flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    `Buy ${pack.credits.toLocaleString()} pack`
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footnote */}
      <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <span className="h-8 w-8 shrink-0 rounded-lg bg-[#F1F5F9] dark:bg-white/5 text-gray-400 flex items-center justify-center">
            <Minus className="h-4 w-4" />
          </span>
          <p className="text-[13px] leading-5 text-gray-500 dark:text-gray-400 max-w-xl">
            Plans and credit packs are billed through our payment provider. Changing plans takes
            effect from your next billing cycle.
          </p>
        </div>
        <Link
          href="/credits"
          className="h-9 px-3.5 shrink-0 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs font-semibold text-ink dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300 transition-colors flex items-center gap-2 shadow-2xs"
        >
          Manage billing
        </Link>
      </div>
    </div>
  )
}
