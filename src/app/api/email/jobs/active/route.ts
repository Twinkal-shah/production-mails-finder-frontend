import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function GET(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/email/jobs/active`
  const cookie = req.headers.get('cookie') || ''
  const authHeader = req.headers.get('authorization') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const token = authHeader ? undefined : await getAccessTokenFromCookies()

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(token && !authHeader ? { Authorization: `Bearer ${token}` } : {}),
      },
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
