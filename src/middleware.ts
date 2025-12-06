import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const pathname = url.pathname
  const hasAccessToken = !!request.cookies.get('access_token')?.value
  const isAuthPath = pathname.startsWith('/auth')
  const isStaticAsset = pathname.startsWith('/_next') || pathname === '/favicon.svg'
  const isApiRoute = pathname.startsWith('/api')
  
  if (pathname === '/') {
    url.pathname = hasAccessToken ? '/find' : '/auth/login'
    return NextResponse.redirect(url)
  }

  if (!isApiRoute && !isStaticAsset && !isAuthPath && !hasAccessToken) {
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
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
