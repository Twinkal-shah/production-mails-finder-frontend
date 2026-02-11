import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function GET(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/user/profile/getCredits`
  const cookie = req.headers.get('cookie') || ''
  const auth = req.headers.get('authorization') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const { getCurrentUserFromCookies } = await import('@/lib/auth-server')
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
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    try {
      const user = await getCurrentUserFromCookies()
      const find = Math.max(Number(user?.credits_find ?? 0), 0)
      const verify = Math.max(Number(user?.credits_verify ?? 0), 0)
      return NextResponse.json({
        credits_find: find,
        credits_verify: verify,
        find,
        verify,
        total_credits: find + verify
      }, { status: 200 })
    } catch {
      return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
    }
  }
}

export const runtime = 'nodejs'
