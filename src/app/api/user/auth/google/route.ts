import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

/**
 * Proxy for Google Sign-In, mirroring the password login route.
 *
 * The body carries one field — the Google ID token — which is forwarded untouched. The
 * backend verifies it and resolves the account from the token's own email, so nothing here
 * needs to (or may) inspect it.
 *
 * On success the backend returns exactly the shape the password login returns, so the same
 * httpOnly cookies are set here and the client stores the result with the same code.
 */
export async function POST(req: NextRequest) {
  let backend = getBackendBaseUrl()
  try {
    const appHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase()
    const backendHost = (() => { try { return new URL(backend).host.toLowerCase() } catch { return '' } })()
    if (backendHost && appHost && backendHost === appHost) {
      backend = (process.env.NEXT_PUBLIC_API_URL_PROD || process.env.NEXT_PUBLIC_SERVER_URL || backend)
    }
  } catch {}
  const url = `${backend}/api/user/auth/google`
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
        body,
      })
    } catch {
      const local = (process.env.NEXT_PUBLIC_API_URL_LOCAL || process.env.NEXT_PUBLIC_API_URL_STAGING || process.env.NEXT_PUBLIC_LOCAL_URL || process.env.NEXT_PUBLIC_CORE_API_BASE || '').replace(/\/+$/, '')
      const fallbackUrl = `${local}/api/user/auth/google`
      res = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          'content-type': 'application/json'
        },
        body,
      })
    }

    const contentType = res.headers.get('content-type') || 'application/json'
    const text = await res.text()

    let responseData
    try {
      responseData = JSON.parse(text)
    } catch {
      return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
    }

    const accessToken = responseData?.data?.access_token
    const refreshTokenNew = responseData?.data?.refresh_token
    const user = responseData?.data?.user

    if (res.ok && accessToken && user) {
      const response = NextResponse.json(responseData, { status: res.status })

      response.cookies.set('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })

      response.cookies.set('user_data', JSON.stringify(user), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })

      if (typeof refreshTokenNew === 'string' && refreshTokenNew.length > 0) {
        response.cookies.set('refresh_token', refreshTokenNew, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30 // 30 days
        })
      }

      return response
    }

    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
