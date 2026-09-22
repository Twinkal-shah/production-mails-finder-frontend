import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function POST(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/user/profile/onboarding`

  const cookie = req.headers.get('cookie') || ''
  const authHeader = req.headers.get('authorization') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const accessToken = authHeader ? undefined : await getAccessTokenFromCookies()

  try {
    const incoming = await req.json().catch(() => ({}))
    const body = typeof incoming === 'object' && incoming !== null ? (incoming as Record<string, unknown>) : {}

    // Forward only the wizard's own fields. The backend rejects unknown keys,
    // so a stray field would fail the whole save.
    const allowed = [
      'companyName',
      'companySize',
      'role',
      'needs',
      'volume',
      'lifetimeDealInterest',
      'source',
      'sandboxVerified',
      'skipped',
      'completedAt',
    ] as const
    const normalized: Record<string, unknown> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) normalized[key] = body[key]
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(accessToken && !authHeader ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(normalized),
    })

    const text = await res.text()
    const contentType = res.headers.get('content-type') || 'application/json'
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
