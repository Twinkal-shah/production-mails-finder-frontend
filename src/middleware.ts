import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const pathname = url.pathname
  
  // Always redirect root to /find to show dashboard directly
  if (pathname === '/') {
    url.pathname = '/find'
    return NextResponse.redirect(url)
  }

  // Only guard protected dashboard pages; leave auth and public pages untouched
  const protectedPaths = ['/find', '/bulk-finder', '/verify', '/credits', '/api-calls', '/video-tutorials']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))
  const isAuthPage = pathname.startsWith('/auth')

  if (isProtected && !isAuthPage) {
    const token = request.cookies.get('access_token')?.value
    const hasUserCookie = !!request.cookies.get('user_data')?.value

    if (token || hasUserCookie) {
      try {
        const apiUrl = `${request.nextUrl.origin}/api/user/profile/getProfile`
        const res = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(request.headers.get('cookie') ? { Cookie: request.headers.get('cookie') as string } : {})
          }
        })

        if (res.status === 404) {
          const redirectUrl = new URL('/auth/login', request.url)
          redirectUrl.searchParams.set('signup', '1')
          const response = NextResponse.redirect(redirectUrl)
          response.cookies.set('access_token', '', { path: '/', maxAge: 0, sameSite: 'lax' })
          response.cookies.set('user_data', '', { path: '/', maxAge: 0, sameSite: 'lax' })
          return response
        }
      } catch {
        // If validation request fails, let page render; other mechanisms will handle
        return NextResponse.next()
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.svg (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.svg).*)',
  ],
}
