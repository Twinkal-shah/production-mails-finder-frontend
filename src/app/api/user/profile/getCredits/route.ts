import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function GET(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/user/profile/getCredits`
  const cookie = req.headers.get('cookie') || ''
  const auth = req.headers.get('authorization') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const accessToken = await getAccessTokenFromCookies()
  
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...(cookie && { Cookie: cookie }),
        ...(auth && { Authorization: auth }),
        ...(accessToken && !auth ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      cache: 'no-store',
    })
    const contentType = res.headers.get('content-type') || 'application/json'
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': contentType, 'cache-control': 'no-store, no-cache, must-revalidate, max-age=0' },
    })
  } catch (error) {
    // Deliberately no numeric fallback. Returning zeros with a 200 here made an
    // unreachable backend look like an empty wallet to every user.
    return NextResponse.json(
      { error: 'credits_unavailable', message: (error as Error).message },
      { status: 502, headers: { 'cache-control': 'no-store, no-cache, must-revalidate, max-age=0' } }
    )
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
