import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function GET(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/user/profile/getCredits`
  const cookie = req.headers.get('cookie') || ''
  const auth = req.headers.get('authorization') || ''
  const { getCurrentUserFromCookies } = await import('@/lib/auth-server')
  try {
    const origin = req.nextUrl.origin
    const creditsProfileRes = await fetch(`${origin}/api/user/profile/getCredits`, {
      method: 'GET',
      headers: {
        ...(cookie && { Cookie: cookie }),
        ...(auth && { Authorization: auth }),
      },
      cache: 'no-store',
    })
    if (creditsProfileRes.ok) {
      const cd = await creditsProfileRes.json()
      const inner = (cd && typeof cd === 'object' && 'data' in cd ? cd.data : cd) || {}
      const findRaw = Number(inner.credits_find ?? inner.find ?? inner.findCredits ?? 0)
      const verifyRaw = Number(inner.credits_verify ?? inner.verify ?? inner.verifyCredits ?? 0)
      const find = Math.max(findRaw, 0)
      const verify = Math.max(verifyRaw, 0)
      // Backend returns the unified spendable total in `available_credits`.
      // credits_find and credits_verify both echo that same number now, so
      // summing them double-counts. Prefer available_credits; fall back to
      // the larger of the legacy values, NOT the sum.
      const availableRaw = Number(inner.available_credits)
      const total = Number.isFinite(availableRaw) && availableRaw >= 0
        ? availableRaw
        : Math.max(find, verify)
      return NextResponse.json({
        available_credits: total,
        credits_find: find,
        credits_verify: verify,
        find,
        verify,
        total_credits: total,
      })
    }

    const profileRes = await fetch(`${origin}/api/user/profile/getProfile`, {
      method: 'GET',
      headers: {
        ...(cookie && { Cookie: cookie }),
        ...(auth && { Authorization: auth }),
      },
      cache: 'no-store',
    })
    if (profileRes.ok) {
      const d = await profileRes.json()
      const inner = (d && typeof d === 'object' && 'data' in d ? d.data : d) || {}
      const find = Number(inner.credits_find ?? inner.find ?? inner.findCredits ?? 0)
      const verify = Number(inner.credits_verify ?? inner.verify ?? inner.verifyCredits ?? 0)
      const availableRaw = Number(inner.available_credits)
      const total = Number.isFinite(availableRaw) && availableRaw >= 0
        ? availableRaw
        : Math.max(find, verify)
      return NextResponse.json({
        available_credits: total,
        credits_find: find,
        credits_verify: verify,
        find,
        verify,
        total_credits: total,
      })
    }

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...(cookie && { Cookie: cookie }),
        ...(auth && { Authorization: auth }),
      },
      cache: 'no-store',
    })
  const contentType = res.headers.get('content-type') || 'application/json'
  const text = await res.text()
  if (res.status === 404) {
      const response = NextResponse.json({ status: 404, success: false, message: 'User not found' }, { status: 401 })
      response.cookies.set('access_token', '', { httpOnly: true, sameSite: 'lax', maxAge: 0 })
      response.cookies.set('user_data', '', { httpOnly: true, sameSite: 'lax', maxAge: 0 })
      return response
    }
    if (res.status === 429) {
      const user = await getCurrentUserFromCookies()
      const find = Math.max(Number(user?.credits_find ?? 0), 0)
      const verify = Math.max(Number(user?.credits_verify ?? 0), 0)
      const total = Math.max(find, verify)
      return NextResponse.json({
        available_credits: total,
        credits_find: find,
        credits_verify: verify,
        find,
        verify,
        total_credits: total
      }, { status: 200 })
    }
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    try {
      const user = await getCurrentUserFromCookies()
      const find = Math.max(Number(user?.credits_find ?? 0), 0)
      const verify = Math.max(Number(user?.credits_verify ?? 0), 0)
      const total = Math.max(find, verify)
      return NextResponse.json({
        available_credits: total,
        credits_find: find,
        credits_verify: verify,
        find,
        verify,
        total_credits: total
      }, { status: 200 })
    } catch {
      return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
    }
  }
}

export const runtime = 'nodejs'
