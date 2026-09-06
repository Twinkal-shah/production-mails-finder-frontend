import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

/**
 * Proxy for the dashboard's verified-email counters.
 *
 * The counts themselves are produced by the backend, which owns the
 * verification records and the authenticated user's id. This route only
 * forwards the request with the caller's credentials, exactly like the
 * sibling email routes.
 *
 * Expected backend contract — GET /api/email/verification-stats
 *   200 { "today": <number>, "last_30_days": <number> }
 * Counting rules live in the backend: successful verifications only, across
 * single + bulk + API, scoped to the authenticated user.
 *
 * If the backend route does not exist yet it returns 404 and the dashboard
 * shows an unavailable state rather than a wrong number.
 */

async function getAuthHeaders(req: NextRequest) {
  const cookie = req.headers.get('cookie') || ''
  const authHeader = req.headers.get('authorization') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const token = authHeader ? undefined : await getAccessTokenFromCookies()
  return {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(token && !authHeader ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function GET(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/email/verification-stats`

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: await getAuthHeaders(req),
    })
    const contentType = res.headers.get('content-type') || 'application/json'
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': contentType },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Proxy error', message: (error as Error).message },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
