/**
 * Single source of truth for the Mailsfinder plan catalog.
 *
 * Prices, credit volumes, daily caps and API limits here are the *marketing*
 * figures shown on the pricing and upgrade pages. Anything describing the
 * signed-in user's own account (their balance, their daily cap, their rate
 * limit) must be read from the profile/credits API instead — a grandfathered
 * subscriber does not match any catalog row. See `dailyCapOf` / `apiRateLimitOf`.
 *
 * Checkout payloads follow the live backend contract:
 *   { plan: 'starter' | 'growth' | 'agency', billing: 'monthly' | 'annual' }
 *   { plan: 'lifetime' }
 *   { plan: 'payg', package: 'quick_boost' | 'starter_surge' | ... }
 */

import type { Profile } from '@/lib/profile'

export type PaidPlanKey = 'starter' | 'growth' | 'agency'
export type CatalogPlanKey = 'free' | PaidPlanKey | 'lifetime'
export type BillingChoice = 'monthly' | 'annual'

export interface PlanPricing {
  /** Headline price shown as the big number. */
  price: number
  /** Suffix next to the price, e.g. "/ month". */
  period: string
  /** Line under the price, e.g. "Billed $95.88 / year". */
  note?: string
}

export interface PlanDefinition {
  key: CatalogPlanKey
  name: string
  blurb: string
  /** Monthly credit allowance. Null for Free (daily-only) . */
  creditsPerMonth: number | null
  /** Total one-off pool, for Lifetime. */
  creditsPool?: number
  /** Verifications per day included with the plan. */
  dailyCap: number
  /** Requests per minute for the REST API; 0 means no API access. */
  apiRateLimit: number
  monthly: PlanPricing
  annual?: PlanPricing
  features: string[]
  /** Highlighted as the recommended tier. */
  popular?: boolean
}

export const PLAN_CATALOG: Record<CatalogPlanKey, PlanDefinition> = {
  free: {
    key: 'free',
    name: 'Free',
    blurb: 'Try the finder and verifier with a fresh allowance every day.',
    creditsPerMonth: null,
    dailyCap: 100,
    apiRateLimit: 0,
    monthly: { price: 0, period: 'forever' },
    features: [
      '100 credits / day',
      'Email Finder & Verifier',
      'Credits reset daily',
      'No API access',
    ],
  },
  starter: {
    key: 'starter',
    name: 'Starter',
    blurb: 'Essential toolkit for founders and solo SDRs validating target accounts.',
    creditsPerMonth: 75_000,
    dailyCap: 3_000,
    apiRateLimit: 0,
    monthly: { price: 9.99, period: '/ month' },
    annual: { price: 7.99, period: '/ month', note: 'Billed $95.88 / year' },
    features: [
      '75,000 credits / month',
      '3,000 verifications / day',
      'Email Finder & Verifier',
      'Bulk CSV enrichment',
      'No API access',
    ],
  },
  growth: {
    key: 'growth',
    name: 'Growth',
    blurb: 'For sales teams running continuous outbound at meaningful volume.',
    creditsPerMonth: 200_000,
    dailyCap: 8_000,
    apiRateLimit: 30,
    monthly: { price: 19.99, period: '/ month' },
    annual: { price: 15.99, period: '/ month', note: 'Billed $191.88 / year' },
    features: [
      '200,000 credits / month',
      '8,000 verifications / day',
      'Everything in Starter',
      'REST API access — 30 req/min',
      'Priority email support',
    ],
    popular: true,
  },
  agency: {
    key: 'agency',
    name: 'Agency',
    blurb: 'High-throughput provisioning for agencies and multi-team programs.',
    creditsPerMonth: 600_000,
    dailyCap: 20_000,
    apiRateLimit: 60,
    monthly: { price: 49, period: '/ month' },
    annual: { price: 39, period: '/ month', note: 'Billed $468 / year' },
    features: [
      '600,000 credits / month',
      '20,000 verifications / day',
      'Everything in Growth',
      'REST API access — 60 req/min',
      'Priority support',
    ],
  },
  lifetime: {
    key: 'lifetime',
    name: 'Lifetime',
    blurb: 'A single payment for a credit pool that never expires.',
    creditsPerMonth: null,
    creditsPool: 1_000_000,
    dailyCap: 25_000,
    apiRateLimit: 30,
    monthly: { price: 249, period: 'one time' },
    features: [
      '1,000,000 credits (lifetime pool)',
      '25,000 verifications / day',
      'Pool never expires',
      'REST API access — 30 req/min',
      'No recurring billing',
    ],
  },
}

/** Paid subscription tiers, in display order. */
export const SUBSCRIPTION_PLANS: PlanDefinition[] = [
  PLAN_CATALOG.starter,
  PLAN_CATALOG.growth,
  PLAN_CATALOG.agency,
]

/** Everything shown on the pricing grid, in display order. */
export const PRICING_PLANS: PlanDefinition[] = [
  PLAN_CATALOG.free,
  PLAN_CATALOG.starter,
  PLAN_CATALOG.growth,
  PLAN_CATALOG.agency,
  PLAN_CATALOG.lifetime,
]

export type PaygPackageKey =
  | 'quick_boost'
  | 'starter_surge'
  | 'growth_surge'
  | 'scale_volume'
  | 'max_volume'

export interface CreditPack {
  package: PaygPackageKey
  credits: number
  price: number
  label: string
  blurb: string
}

/**
 * Pay-as-you-go packs. Prices are unchanged; every credit amount changed with
 * the new pricing, and the checkout keys are now the pack names rather than
 * the old credit-count shorthand ('10k', '22k', ...).
 */
export const CREDIT_PACKS: CreditPack[] = [
  { package: 'quick_boost', credits: 5_000, price: 5, label: 'Quick Boost', blurb: 'Great for immediate list cleansing before an outbound campaign.' },
  { package: 'starter_surge', credits: 10_000, price: 9, label: 'Starter Surge', blurb: 'A step up for steady weekly prospecting volume.' },
  { package: 'growth_surge', credits: 20_000, price: 14.99, label: 'Growth Surge', blurb: 'For SDR pods scrubbing monthly inbound or event lists.' },
  { package: 'scale_volume', credits: 50_000, price: 29, label: 'Scale Volume', blurb: 'High-volume enrichment across large target accounts.' },
  { package: 'max_volume', credits: 125_000, price: 59, label: 'Max Volume', blurb: 'Bulk provisioning for sustained multi-team campaigns.' },
]

/** Stated on the pricing page so expiry is never a surprise. */
export const ROLLOVER_NOTICE =
  'Credits do not roll over. Free credits reset every day; Starter, Growth and Agency credits expire at the end of each billing cycle and the next cycle starts at exactly the plan amount. Lifetime and pay-as-you-go credits are pools that never expire.'

/* ----------------------------- plan identity ----------------------------- */

/** Normalised plan id from a profile, e.g. "Growth" -> "growth". */
export function normalizePlan(plan: unknown): string {
  return (plan ?? 'free').toString().trim().toLowerCase()
}

/**
 * Display label for any plan the backend may report, including the
 * grandfathered `monthly` tier which is no longer for sale.
 */
export function planLabel(plan: unknown): string {
  const key = normalizePlan(plan)
  if (key === 'monthly' || key === 'annual') return 'Monthly (legacy)'
  if (key === 'payg') return 'Pay As You Go'
  const known = PLAN_CATALOG[key as CatalogPlanKey]
  return known ? known.name : key.charAt(0).toUpperCase() + key.slice(1)
}

/** A legacy subscriber on the retired $9.99 / 300,000 plan. */
export function isLegacyMonthly(plan: unknown): boolean {
  const key = normalizePlan(plan)
  return key === 'monthly' || key === 'annual'
}

/** Catalog entry for a plan, or undefined for legacy / payg / unknown plans. */
export function catalogEntry(plan: unknown): PlanDefinition | undefined {
  return PLAN_CATALOG[normalizePlan(plan) as CatalogPlanKey]
}

/* -------------------------- account-specific reads ------------------------ */

/**
 * The bucket that actually funds this account's usage. Lifetime accounts draw
 * from the lifetime pool; everyone else from the monthly/free cycle bucket.
 */
export function activeBucket(profile: Profile | null | undefined) {
  const key = normalizePlan(profile?.plan)
  const balances = profile?.balances
  if (!balances) return undefined
  if (key === 'lifetime') return balances.lifetime
  if (key === 'free') return balances.free ?? balances.monthly
  if (key === 'payg') return balances.payg
  return balances.monthly
}

/**
 * This account's real daily cap, straight from the API. Never assume the
 * catalog figure — a grandfathered subscriber has a different cap.
 */
export function dailyCapOf(profile: Profile | null | undefined): number | null {
  const cap = activeBucket(profile)?.daily_cap
  return typeof cap === 'number' && cap > 0 ? cap : null
}

/** Credits already spent against today's cap, when the API reports it. */
export function dailyUsedOf(profile: Profile | null | undefined): number | null {
  const used = activeBucket(profile)?.daily_used
  return typeof used === 'number' && used >= 0 ? used : null
}

/**
 * The API rate limit the backend reported for this account, or null when it
 * reported none.
 *
 * "Not reported" is deliberately distinct from an explicit 0. The credits
 * proxy falls back to a caps-less payload when the backend is unreachable, and
 * older payloads may omit the field — treating that as "no API access" would
 * lock a paying subscriber out of keys that still work server-side.
 */
export function apiRateLimitOf(profile: Profile | null | undefined): number | null {
  const limit = profile?.caps?.api_rate_limit_per_minute
  return typeof limit === 'number' ? Math.max(limit, 0) : null
}

/**
 * Rate limit to display: the reported figure, falling back to the catalog
 * value for a known plan. Null when we genuinely cannot say — show nothing
 * rather than invent a number.
 */
export function displayApiRateLimit(profile: Profile | null | undefined): number | null {
  const reported = apiRateLimitOf(profile)
  if (reported !== null) return reported
  return catalogEntry(profile?.plan)?.apiRateLimit ?? null
}

/**
 * Whether to offer API features. Only refuses when we are confident: either
 * the backend said 0, or it said nothing and the plan is a catalog tier with
 * no API. A grandfathered or unrecognised paid plan keeps access — the server
 * remains the real gate and answers 403 if it disagrees.
 */
export function hasApiAccess(profile: Profile | null | undefined): boolean {
  const reported = apiRateLimitOf(profile)
  if (reported !== null) return reported > 0
  const known = catalogEntry(profile?.plan)
  if (known) return known.apiRateLimit > 0
  return normalizePlan(profile?.plan) !== 'payg'
}

/** True when the billing cycle lapsed — the balance shown is already zero. */
export function isCycleExpired(profile: Profile | null | undefined): boolean {
  return profile?.balances?.monthly?.cycle_expired === true
}

/**
 * Human-readable reset time for a daily cap. `resets_at` is UTC midnight; if
 * the API sends an empty string we fall back to naming the boundary.
 */
export function formatResetTime(resetsAt: string | null | undefined): string {
  if (!resetsAt) return 'midnight UTC'
  const date = new Date(resetsAt)
  if (Number.isNaN(date.getTime())) return 'midnight UTC'
  return date.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  })
}

/** The next upgrade target for a plan, used by "no API access" prompts. */
export function upgradeSuggestion(plan: unknown): string {
  const key = normalizePlan(plan)
  if (key === 'free' || key === 'payg') return 'Growth or Agency'
  if (key === 'starter') return 'Growth or Agency'
  if (key === 'growth') return 'Agency'
  return 'Growth or Agency'
}
