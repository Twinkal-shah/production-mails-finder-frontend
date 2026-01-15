import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function POST(req: NextRequest) {
  let backend = getBackendBaseUrl()
  try {
    const appHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase()
    const backendHost = (() => { try { return new URL(backend).host.toLowerCase() } catch { return '' } })()
    if (backendHost && appHost && backendHost === appHost) {
      backend = 'https://server.mailsfinder.com'
    }
  } catch {}
  const url = `${backend}/api/user/auth/reset-password`
  const cookie = req.headers.get('cookie') || ''
  try {
    const body = await req.text()
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          'content-type': 'application/json'
        },
        body
      })
    } catch {
      const local = (process.env.NEXT_PUBLIC_LOCAL_URL || 'http://localhost:8000').replace(/\/+$/, '')
      const fallbackUrl = `${local}/api/user/auth/reset-password`
      res = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          'content-type': 'application/json'
        },
        body
      })
    }
    const contentType = res.headers.get('content-type') || 'application/json'
    const text = await res.text()
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'

