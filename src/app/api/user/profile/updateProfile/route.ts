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
    const normalized: Record<string, unknown> = { ...incoming }
    // Normalize credits fields to cover different backend expectations
    if (incoming['credits_find'] != null || incoming['findCredits'] != null) {
      const val = Number(incoming['credits_find'] ?? incoming['findCredits'])
      if (!Number.isNaN(val)) {
        normalized['credits_find'] = val
        normalized['findCredits'] = val
      }
    }
    if (incoming['credits_verify'] != null || incoming['verifyCredits'] != null) {
      const val = Number(incoming['credits_verify'] ?? incoming['verifyCredits'])
      if (!Number.isNaN(val)) {
        normalized['credits_verify'] = val
        normalized['verifyCredits'] = val
      }
    }
    if (typeof incoming['full_name'] === 'string') {
      normalized['full_name'] = (incoming['full_name'] as string).trim()
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
