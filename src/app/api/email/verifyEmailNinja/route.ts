import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

/**
 * Proxy for the Mailtester Ninja single verify endpoint.
 * Unlike the legacy verifyEmail route (form-urlencoded), the Ninja endpoint
 * takes a JSON body: { "email": "..." }.
 */
export async function POST(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/email/verifyEmailNinja`
  const cookie = req.headers.get('cookie') || ''
  const auth = req.headers.get('authorization') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const accessToken = await getAccessTokenFromCookies()

  try {
    const inboundType = req.headers.get('content-type') || ''
    let email = ''
    if (inboundType.includes('application/json')) {
      const json = await req.json().catch(() => ({})) as { email?: unknown }
      email = typeof json.email === 'string' ? json.email : ''
    } else {
      // Accept form-encoded callers too, so anything still posting the legacy
      // shape keeps working against the new endpoint.
      const text = await req.text()
      email = new URLSearchParams(text).get('email') || ''
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(auth ? { Authorization: auth } : {}),
        ...(accessToken && !auth ? { Authorization: `Bearer ${accessToken}` } : {}),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ email }),
    })

    const contentType = res.headers.get('content-type') || 'application/json'
    const text = await res.text()
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
