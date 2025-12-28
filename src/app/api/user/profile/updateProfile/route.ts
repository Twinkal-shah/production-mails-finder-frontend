import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function PUT(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/user/profile/updateProfile`

  const cookie = req.headers.get('cookie') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const accessToken = await getAccessTokenFromCookies()

  try {
    // Must parse JSON properly
    const jsonBody = await req.json()
    const incoming = typeof jsonBody === 'object' && jsonBody !== null ? (jsonBody as Record<string, unknown>) : {}
    const normalized: Record<string, unknown> = {}
    // Only forward allowed fields to avoid backend 400 for additional properties
    if (typeof incoming['full_name'] === 'string') normalized['full_name'] = (incoming['full_name'] as string).trim()
    if (typeof incoming['company'] === 'string') normalized['company'] = (incoming['company'] as string).trim()
    if (typeof incoming['plan'] === 'string') normalized['plan'] = incoming['plan']
    if (typeof incoming['plan_expiry'] === 'string') normalized['plan_expiry'] = incoming['plan_expiry']
    // Normalize credits to canonical field names only
    const cf = incoming['credits_find'] ?? incoming['findCredits']
    const cv = incoming['credits_verify'] ?? incoming['verifyCredits']
    if (cf != null) {
      const val = Number(cf)
      if (!Number.isNaN(val)) normalized['credits_find'] = val
    }
    if (cv != null) {
      const val = Number(cv)
      if (!Number.isNaN(val)) normalized['credits_verify'] = val
    }

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(normalized),
    })

    const text = await res.text()
    const contentType = res.headers.get('content-type') || 'application/json'

    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': contentType }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Proxy error', message: (error as Error).message },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
