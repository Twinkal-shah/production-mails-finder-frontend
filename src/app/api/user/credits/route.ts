import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

// Credit balances must never be cached — not by Next, not by nginx, not by
// Cloudflare. A cached response here is one user's balance shown to everyone.
const NO_STORE = { 'cache-control': 'no-store, no-cache, must-revalidate, max-age=0' }

export async function GET(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const cookie = req.headers.get('cookie') || ''
  const auth = req.headers.get('authorization') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const accessToken = await getAccessTokenFromCookies()

  // Call the backend directly. This route used to fetch its own public origin
  // (`${req.nextUrl.origin}/api/user/profile/getCredits`), which only worked
  // because Vercel resolved that loop internally. Self-hosted behind
  // nginx/Cloudflare the same call leaves the box, comes back through the CDN,
  // and any hiccup on that round trip landed in the catch below — which used to
  // answer 200 with zeros, so every user saw "0 Credits".
  const headers: Record<string, string> = {
    ...(cookie && { Cookie: cookie }),
    ...(auth
      ? { Authorization: auth }
      : accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {}),
  }
  const callBackend = (path: string) =>
    fetch(`${backend}${path}`, { method: 'GET', headers, cache: 'no-store' })

  const shape = (inner: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
    const find = Math.max(Number(inner.credits_find ?? inner.find ?? inner.findCredits ?? 0), 0)
    const verify = Math.max(Number(inner.credits_verify ?? inner.verify ?? inner.verifyCredits ?? 0), 0)
    // Backend returns the unified spendable total in `available_credits`.
    // credits_find and credits_verify both echo that same number now, so
    // summing them double-counts. Prefer available_credits; fall back to
    // the larger of the legacy values, NOT the sum.
    const availableRaw = Number(inner.available_credits)
    const total = Number.isFinite(availableRaw) && availableRaw >= 0 ? availableRaw : Math.max(find, verify)
    return NextResponse.json(
      {
        available_credits: total,
        credits_find: find,
        credits_verify: verify,
        find,
        verify,
        total_credits: total,
        ...extra,
      },
      { headers: NO_STORE }
    )
  }

  try {
    const creditsRes = await callBackend('/api/user/profile/getCredits')

    if (creditsRes.status === 404) {
      const response = NextResponse.json(
        { status: 404, success: false, message: 'User not found' },
        { status: 401, headers: NO_STORE }
      )
      response.cookies.set('access_token', '', { httpOnly: true, sameSite: 'lax', maxAge: 0 })
      response.cookies.set('user_data', '', { httpOnly: true, sameSite: 'lax', maxAge: 0 })
      return response
    }

    if (creditsRes.ok) {
      const cd = await creditsRes.json()
      const inner = ((cd && typeof cd === 'object' && 'data' in cd ? cd.data : cd) || {}) as Record<string, unknown>
      return shape(inner, {
        // Pass through the per-bucket detail getCredits already returns: the
        // Daily Quota Meter reads daily_used / daily_cap / resets_at out of
        // `balances`, and rebuilding the payload without it was why the card
        // rendered "Not reported".
        //
        // `caps` is deliberately NOT forwarded. It is derived from
        // resolveEffectivePlan(), which returns "free" for a legacy `monthly`
        // subscriber whose subscription record is not `active` — so
        // api_rate_limit_per_minute comes back 0 and hasApiAccess() hides the
        // API page from users who do have access. Leaving it absent keeps the
        // frontend on its catalog fallback, which reads those users correctly.
        balances: inner.balances,
      })
    }

    // getCredits unavailable (rate limited, 5xx, …) — try the profile payload,
    // which carries the same balance.
    const profileRes = await callBackend('/api/user/profile/getProfile')
    if (profileRes.ok) {
      const d = await profileRes.json()
      const inner = ((d && typeof d === 'object' && 'data' in d ? d.data : d) || {}) as Record<string, unknown>
      return shape(inner)
    }

    // Neither source could tell us the balance. Answer with the upstream status
    // and NO number. Callers (useUserProfile, dashboard-layout) only read this
    // body when the response is ok, so a failure leaves the balance they
    // already have from getProfile intact instead of overwriting it with 0.
    return NextResponse.json(
      { error: 'credits_unavailable', message: 'Could not read credit balance from the backend.' },
      { status: creditsRes.status === 429 || profileRes.status === 429 ? 429 : 502, headers: NO_STORE }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'credits_unavailable', message: (error as Error).message },
      { status: 502, headers: NO_STORE }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
