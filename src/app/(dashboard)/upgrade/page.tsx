'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Zap, Database, ArrowRight, ShieldCheck } from 'lucide-react'
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

/**
 * Two products: the Monthly subscription (billed monthly or annually) and the
 * one-time Lifetime purchase. Annual is a billing option on Monthly, not a
 * separate plan — the same `plan: 'monthly'` is sent with `billing: 'annual'`.
 *
 * Prices, credit volumes and feature lists are unchanged.
 */
const SUBSCRIPTION = {
  name: 'Monthly',
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
  billing: {
    monthly: { price: 9.99, period: '/ month', note: undefined as string | undefined },
    annual: { price: 7.99, period: '/ month', note: 'Billed $95.88 / year' },
  },
}

const LIFETIME = {
  key: 'lifetime' as const,
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
}

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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
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
    <div className="max-w-6xl mx-auto flex flex-col gap-12">
      {/* ------------------------------- Hero ------------------------------- */}
      <div className="flex flex-col items-center text-center gap-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 text-brand">
          <Zap className="h-[15px] w-[15px]" />
          <span className="text-xs font-bold tracking-wider uppercase">Flexible Allocation</span>
        </div>
        <div className="flex flex-col gap-2 max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold text-ink dark:text-white tracking-tight">
            Simple, Transparent Plans for High-Precision Prospecting
          </h1>
          <p className="text-base text-ink-muted dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Scale verified B2B leads, real-time SMTP handshakes, and enterprise data enrichment with
            predictable, rollover-ready credit volumes.
          </p>
        </div>

        {/* Billing cycle switcher — applies to the Monthly plan */}
        <div className="mt-2 inline-flex items-center p-1 rounded-full bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 shadow-inner">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            aria-pressed={billingCycle === 'monthly'}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              billingCycle === 'monthly'
                ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-2xs'
                : 'text-ink-muted hover:text-ink dark:hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            aria-pressed={billingCycle === 'annual'}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              billingCycle === 'annual'
                ? 'bg-white dark:bg-white/10 text-ink dark:text-white shadow-2xs'
                : 'text-ink-muted hover:text-ink dark:hover:text-white'
            }`}
          >
            <span>Annual</span>
            <span className="bg-brand-light dark:bg-brand/15 text-brand border border-brand-border dark:border-brand/30 text-[11px] font-bold px-2 py-0.5 rounded-full">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* --------------------------- Tier comparison --------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch pt-2 max-w-4xl mx-auto w-full">
        {/* ---- Monthly subscription (billed monthly or annually) ---- */}
        {(() => {
          const cycle = SUBSCRIPTION.billing[billingCycle]
          const planKey: PlanKey = billingCycle === 'annual' ? 'annual' : 'monthly'
          const isCurrent = currentPlan === 'monthly' || currentPlan === 'annual'
          const isLoading = !!loadingStates[`plan-${planKey}`]
          return (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-7 flex flex-col justify-between transition-all duration-200 relative border-2 border-brand shadow-lg md:-translate-y-2">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-brand text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-2xs tracking-wide uppercase whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span>{isCurrent ? 'Current Plan • Most Popular' : 'Most Popular'}</span>
              </div>

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase font-bold tracking-wider text-brand">
                      {SUBSCRIPTION.name}
                    </span>
                    {cycle.note && (
                      <span className="text-[11px] font-semibold text-brand bg-brand-light dark:bg-brand/15 px-2 py-0.5 rounded border border-brand-border dark:border-brand/30 whitespace-nowrap">
                        {cycle.note}
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold text-ink dark:text-white">$</span>
                    <span className="text-4xl font-bold text-ink dark:text-white tabular-nums">
                      {cycle.price}
                    </span>
                    <span className="text-sm font-medium text-ink-muted">{cycle.period}</span>
                  </div>

                  <p className="text-xs leading-relaxed text-ink-muted dark:text-gray-400 mt-1">
                    {SUBSCRIPTION.blurb}
                  </p>
                </div>

                <div className="h-px w-full bg-brand-border dark:bg-brand/30" />

                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                    {SUBSCRIPTION.featuresLabel}
                  </span>
                  {SUBSCRIPTION.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-[18px] w-[18px] text-brand mt-0.5 shrink-0" />
                      <span className="text-sm text-ink dark:text-gray-100 font-medium">{feature}</span>
                    </div>
                  ))}
                  {billingCycle === 'annual' && (
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-[18px] w-[18px] text-brand mt-0.5 shrink-0" />
                      <span className="text-sm text-ink dark:text-gray-100 font-medium">
                        Billed $95.88 / year
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 mt-4">
                <button
                  type="button"
                  onClick={() => handleSubscribe(planKey)}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-colors text-center flex items-center justify-center gap-2 bg-ink text-white hover:bg-neutral-800 shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    <>
                      {isCurrent ? 'Manage Monthly Plan' : `Choose ${billingCycle === 'annual' ? 'Annual' : 'Monthly'}`}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })()}

        {/* ---- Lifetime (one-time) ---- */}
        {(() => {
          const isCurrent = currentPlan === 'lifetime'
          const isLoading = !!loadingStates['plan-lifetime']
          return (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-7 flex flex-col justify-between transition-all duration-200 relative border border-gray-200 dark:border-white/10 shadow-card hover:shadow-card-hover hover:border-gray-300 dark:hover:border-white/20">
              {isCurrent && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-brand text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-2xs tracking-wide uppercase whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span>Current Plan</span>
                </div>
              )}

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase font-bold tracking-wider text-ink-muted">
                      {LIFETIME.name}
                    </span>
                    <span className="text-[11px] font-semibold text-ink-muted bg-[#F8FAFC] dark:bg-white/5 px-2 py-0.5 rounded border border-gray-200 dark:border-white/10 whitespace-nowrap">
                      One-time payment
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-bold text-ink dark:text-white">$</span>
                    <span className="text-4xl font-bold text-ink dark:text-white tabular-nums">
                      {LIFETIME.price}
                    </span>
                    <span className="text-sm font-medium text-ink-muted">{LIFETIME.period}</span>
                  </div>

                  <p className="text-xs leading-relaxed text-ink-muted dark:text-gray-400 mt-1">
                    {LIFETIME.blurb}
                  </p>
                </div>

                <div className="h-px w-full bg-gray-200 dark:bg-white/10" />

                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    {LIFETIME.featuresLabel}
                  </span>
                  {LIFETIME.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-[18px] w-[18px] text-brand mt-0.5 shrink-0" />
                      <span className="text-sm text-ink dark:text-gray-100 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-4">
                <button
                  type="button"
                  onClick={() => handleSubscribe('lifetime')}
                  disabled={isLoading || isCurrent}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-colors text-center flex items-center justify-center gap-2 bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 text-ink dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
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
                      Choose Lifetime
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })()}
      </div>

      {/* ---------------------------- Accuracy banner ---------------------------- */}
      <div className="w-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-card">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-light dark:bg-brand/15 text-brand border border-brand-border dark:border-brand/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-ink dark:text-white">
              99.4% Multi-layer Deliverability Accuracy
            </h2>
            <p className="text-sm text-ink-muted dark:text-gray-400">
              We ping real-time DNS MX, greylisting, disposable domain registries, and live catch-all
              mailboxes.
            </p>
          </div>
        </div>
      </div>

      {/* --------------------------- On-demand packs --------------------------- */}
      <div className="flex flex-col gap-6 pt-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Database className="h-[22px] w-[22px] text-brand" />
              <h2 className="text-2xl font-bold text-ink dark:text-white tracking-tight">
                Need One-Time On-Demand Credits?
              </h2>
            </div>
            <p className="text-sm text-ink-muted dark:text-gray-400">
              No recurring contracts. Credits stack directly onto your active workspace balance.
            </p>
          </div>
          <span className="text-xs font-semibold text-ink-muted bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-full shadow-2xs whitespace-nowrap">
            Instant provisioning • 0s delay
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CREDIT_PACKS.map((pack) => {
            const loadingKey = `credits-${pack.credits}`
            const isLoading = !!loadingStates[loadingKey]
            const perCredit = pack.price / pack.credits
            return (
              <div
                key={pack.credits}
                className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 border border-gray-200 dark:border-white/10 shadow-card flex flex-col justify-between gap-4 hover:shadow-card-hover hover:border-gray-300 dark:hover:border-white/20 transition-all"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                      {pack.label}
                    </span>
                    <span className="text-xs font-semibold text-ink-muted font-mono-code whitespace-nowrap">
                      ${perCredit.toFixed(4)} / credit
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-3xl font-bold text-ink dark:text-white tabular-nums">
                      {pack.credits.toLocaleString()}
                    </span>
                    <span className="text-sm font-semibold text-ink-muted">Credits</span>
                  </div>
                  <p className="text-xs leading-relaxed text-ink-muted dark:text-gray-400">
                    {pack.blurb}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200 dark:border-white/10">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-ink dark:text-white tabular-nums">
                      ${pack.price}
                    </span>
                    <span className="text-xs text-ink-muted font-medium">one-off</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBuyCredits(pack)}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-xl bg-[#F8FAFC] dark:bg-white/5 text-ink dark:text-white border border-gray-200 dark:border-white/10 font-semibold text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Redirecting…
                      </>
                    ) : (
                      `Buy ${pack.credits >= 1000 ? `${Math.round(pack.credits / 1000)}k` : pack.credits} Pack`
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ------------------------------ Footnote ------------------------------ */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-card p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <p className="text-[13px] leading-5 text-ink-muted dark:text-gray-400 max-w-xl">
          Plans and credit packs are billed through our payment provider. Changing plans takes effect
          from your next billing cycle.
        </p>
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
