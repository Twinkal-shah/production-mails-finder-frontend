import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

// `monthly` stays accepted only so existing grandfathered links keep working;
// it is not offered anywhere in the UI. New checkouts use starter/growth/agency.
type Plan = 'starter' | 'growth' | 'agency' | 'monthly' | 'lifetime' | 'payg'
type Billing = 'monthly' | 'annual'
type PaygPackage =
  | 'quick_boost'
  | 'starter_surge'
  | 'growth_surge'
  | 'scale_volume'
  | 'max_volume'

const SUBSCRIPTION_PLANS: Plan[] = ['starter', 'growth', 'agency', 'monthly']
const VALID_PLANS: Plan[] = [...SUBSCRIPTION_PLANS, 'lifetime', 'payg']
const VALID_PACKAGES: PaygPackage[] = [
  'quick_boost',
  'starter_surge',
  'growth_surge',
  'scale_volume',
  'max_volume',
]

export async function POST(req: NextRequest) {
  const token = (await cookies()).get('access_token')?.value
  if (!token) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }

  let plan: Plan | undefined
  let billing: Billing | undefined
  let pkg: PaygPackage | undefined
  let incomingVariantId: string | undefined

  try {
    const json = await req.json()
    if (VALID_PLANS.includes(json?.plan)) {
      plan = json.plan as Plan
    }
    if (json?.billing === 'monthly' || json?.billing === 'annual') {
      billing = json.billing
    }
    if (VALID_PACKAGES.includes(json?.package)) {
      pkg = json.package as PaygPackage
    }
    if (typeof json?.variantId === 'string') {
      incomingVariantId = json.variantId
    }
  } catch {}

  if (!plan) {
    return NextResponse.json(
      { message: `Unknown plan. Valid plans are: ${VALID_PLANS.join(', ')}.` },
      { status: 400 }
    )
  }
  if (plan === 'payg' && !pkg) {
    return NextResponse.json(
      { message: `Unknown credit pack. Valid packs are: ${VALID_PACKAGES.join(', ')}.` },
      { status: 400 }
    )
  }

  // Resolve the LemonSqueezy variant ID server-side. The backend can also
  // resolve it from (plan, billing, package) — variantId here is an optional
  // escape hatch. The starter/growth/agency tiers have no variant env vars, so
  // they are deliberately left for the backend to resolve.
  let variantId: string | undefined = incomingVariantId
  if (!variantId) {
    if (plan === 'monthly' && billing === 'annual') {
      variantId = process.env.LEMONSQUEEZY_ANNUAL_VARIANT_ID
    } else if (plan === 'monthly') {
      variantId = process.env.LEMONSQUEEZY_MONTHLY_VARIANT_ID
    } else if (plan === 'lifetime') {
      variantId = process.env.LEMONSQUEEZY_LIFETIME_VARIANT_ID
    }
    // PAYG deliberately resolves no variant here. The LEMONSQUEEZY_PAYG_*
    // env vars are keyed by the previous credit amounts (10K/22K/42K/...),
    // which no longer match the current packs, so forwarding one would
    // override the backend with a stale variant. The backend resolves the
    // right variant from (plan, package) — same as the subscription tiers.
  }

  const payload: Record<string, unknown> = { plan }
  // Subscriptions carry a billing cycle; the backend defaults to monthly.
  if (SUBSCRIPTION_PLANS.includes(plan)) payload.billing = billing ?? 'monthly'
  if (plan === 'payg' && pkg) payload.package = pkg
  if (variantId) payload.variantId = variantId

  // Resolve backend URL the same way the rest of the app does — respects
  // NEXT_PUBLIC_API_ENV (staging / production / local) so dev hits the staging
  // server that has the new pricing endpoints, not production.
  const backend = getBackendBaseUrl()
  // NOTE: backend route intentionally uses the misspelling `lemonsqeezy` (not
  // `lemonsqueezy`). Do not "fix" it — the frontend must match the server path.
  const res = await fetch(`${backend}/api/transaction/lemonsqeezy/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const contentType = res.headers.get('content-type') || 'application/json'
  const text = await res.text()
  return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
}

export const runtime = 'nodejs'
