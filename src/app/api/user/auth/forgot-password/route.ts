import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function POST(req: NextRequest) {
  let backend = getBackendBaseUrl()
  try {
    const appHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase()
    const backendHost = (() => { try { return new URL(backend).host.toLowerCase() } catch { return '' } })()
    if (backendHost && appHost && backendHost === appHost) {
      backend = (process.env.NEXT_PUBLIC_API_URL_PROD || process.env.NEXT_PUBLIC_SERVER_URL || backend)
    }
  } catch {}
  const url = `${backend}/api/user/auth/forgot-password`
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
      const local = (process.env.NEXT_PUBLIC_API_URL_LOCAL || process.env.NEXT_PUBLIC_API_URL_STAGING || process.env.NEXT_PUBLIC_LOCAL_URL || process.env.NEXT_PUBLIC_CORE_API_BASE || '').replace(/\/+$/, '')
      const fallbackUrl = `${local}/api/user/auth/forgot-password`
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
