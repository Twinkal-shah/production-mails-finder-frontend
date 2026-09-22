'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Zap, Database, ArrowRight, ShieldCheck, Info } from 'lucide-react'
import { useUserProfile } from '@/hooks/useCreditsData'
import {
  CREDIT_PACKS,
  PRICING_PLANS,
  ROLLOVER_NOTICE,
  isLegacyMonthly,
  normalizePlan,
  planLabel,
  type BillingChoice,
  type CatalogPlanKey,
  type CreditPack,
  type PlanDefinition,
} from '@/lib/plans'

export const dynamic = 'force-dynamic'

/**
 * Upgrade Plan.
 *
 * Plan definitions come from the shared catalog in `lib/plans` so this page and
 * Billing & Quota can never drift apart. Checkout uses the live backend
 * contract: { plan, billing } for subscriptions, { plan: 'lifetime' } for the
 * one-time purchase and { plan: 'payg', package } for credit packs.
 */

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
  const [billingCycle, setBillingCycle] = useState<BillingChoice>('monthly')
  const [, startTransition] = useTransition()

  const currentPlan = normalizePlan(profile?.plan)
  const legacy = isLegacyMonthly(currentPlan)

  /** Starts a checkout for a catalog plan. Free is a no-op — nothing to buy. */
  const handleSubscribe = (plan: PlanDefinition) => {
    if (plan.key === 'free') return
    const loadingKey = `plan-${plan.key}`
    setLoadingStates((prev) => ({ ...prev, [loadingKey]: true }))
    const payload: Record<string, string> =
      plan.key === 'lifetime'
        ? { plan: 'lifetime' }
        : { plan: plan.key, billing: billingCycle }
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

  const handleBuyCredits = (pack: CreditPack) => {
    const loadingKey = `credits-${pack.package}`
    setLoadingStates((prev) => ({ ...prev, [loadingKey]: true }))
    startTransition(async () => {
      try {
        const url = await postCheckout({ plan: 'payg', package: pack.package })
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
            Scale verified B2B leads and real-time SMTP handshakes with predictable monthly credit
            volumes. Every paid plan includes bulk CSV enrichment.
          </p>
        </div>

        {/* Billing cycle switcher — applies to Starter, Growth and Agency */}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 items-stretch pt-2 w-full">
        {PRICING_PLANS.map((plan) => {
          const pricing = plan.key !== 'lifetime' && billingCycle === 'annual' && plan.annual
            ? plan.annual
            : plan.monthly
          const isCurrent = currentPlan === (plan.key as CatalogPlanKey)
          const isLoading = !!loadingStates[`plan-${plan.key}`]
          const isFree = plan.key === 'free'
          const highlight = plan.popular && !isCurrent

          return (
            <div
              key={plan.key}
              className={`bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 relative ${
                highlight || isCurrent
                  ? 'border-2 border-brand shadow-lg xl:-translate-y-2'
                  : 'border border-gray-200 dark:border-white/10 shadow-card hover:shadow-card-hover hover:border-gray-300 dark:hover:border-white/20'
              }`}
            >
              {(highlight || isCurrent) && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-brand text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-2xs tracking-wide uppercase whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  <span>{isCurrent ? 'Current Plan' : 'Most Popular'}</span>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span
                    className={`text-xs uppercase font-bold tracking-wider ${
                      highlight || isCurrent ? 'text-brand' : 'text-ink-muted'
                    }`}
                  >
                    {plan.name}
                  </span>

                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-ink dark:text-white">$</span>
                    <span className="text-3xl font-bold text-ink dark:text-white tabular-nums">
                      {pricing.price}
                    </span>
                    <span className="text-xs font-medium text-ink-muted">{pricing.period}</span>
                  </div>

                  {/* Annual headline is per-month; the billed total sits beneath. */}
                  <span className="text-[11px] font-semibold text-ink-muted h-4">
                    {pricing.note ?? (plan.key === 'lifetime' ? 'One-time payment' : '')}
                  </span>

                  <p className="text-xs leading-relaxed text-ink-muted dark:text-gray-400 mt-1 min-h-[48px]">
                    {plan.blurb}
                  </p>
                </div>

                <div
                  className={`h-px w-full ${
                    highlight || isCurrent ? 'bg-brand-border dark:bg-brand/30' : 'bg-gray-200 dark:bg-white/10'
                  }`}
                />

                <div className="flex flex-col gap-2.5">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand mt-0.5 shrink-0" />
                      <span className="text-[13px] text-ink dark:text-gray-100 font-medium leading-snug">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-2">
                <button
                  type="button"
                  onClick={() => handleSubscribe(plan)}
                  disabled={isLoading || isCurrent || isFree}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-sm transition-colors text-center flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                    highlight
                      ? 'bg-brand text-white hover:bg-brand-hover shadow-2xs'
                      : 'bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 text-ink dark:text-white hover:bg-gray-100 dark:hover:bg-white/10'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Redirecting…
                    </>
                  ) : isCurrent ? (
                    'Your current plan'
                  ) : isFree ? (
                    'Included by default'
                  ) : (
                    <>
                      Choose {plan.name}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Grandfathered subscribers keep their allowance but can't re-buy it. */}
      {legacy && (
        <div className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-card p-5 flex items-start gap-3">
          <Info className="h-[18px] w-[18px] text-ink-muted mt-0.5 shrink-0" />
          <p className="text-[13px] leading-5 text-ink-muted dark:text-gray-400">
            You are on the <strong className="text-ink dark:text-white">{planLabel(currentPlan)}</strong> plan.
            It is no longer sold, but your allowance continues as-is. Choosing any plan above moves
            you across from your next billing cycle.
          </p>
        </div>
      )}

      {/* Credits expire — say so plainly rather than letting users find out. */}
      <div className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-card p-5 flex items-start gap-3">
        <Info className="h-[18px] w-[18px] text-brand mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold text-ink dark:text-white">Credits do not roll over</h3>
          <p className="text-[13px] leading-5 text-ink-muted dark:text-gray-400">{ROLLOVER_NOTICE}</p>
        </div>
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
            const loadingKey = `credits-${pack.package}`
            const isLoading = !!loadingStates[loadingKey]
            const perCredit = pack.price / pack.credits
            return (
              <div
                key={pack.package}
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
