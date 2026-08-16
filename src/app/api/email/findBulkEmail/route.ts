import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function POST(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/email/findBulkEmail`
  const cookie = req.headers.get('cookie') || ''
  const authHeader = req.headers.get('authorization') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const token = authHeader ? undefined : await getAccessTokenFromCookies()

  try {
    // Read the body exactly once. A failed req.json() has already drained the
    // stream, so a follow-up req.text() throws "Body has already been read"
    // and surfaces as a 500 "Proxy error" instead of the real problem.
    const rawBody = await req.text()
    let incoming: unknown
    try { incoming = JSON.parse(rawBody) } catch { incoming = rawBody }

    const body = typeof incoming === 'string' ? incoming : JSON.stringify(incoming)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(token && !authHeader ? { Authorization: `Bearer ${token}` } : {}),
      },
      body
    })

    const contentType = res.headers.get('content-type') || 'application/json'
    const text = await res.text()
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
