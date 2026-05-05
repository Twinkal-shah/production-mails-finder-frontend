import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function GET(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/user/profile/getProfile`
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
    if (res.status === 404) {
      const response = NextResponse.json({ status: 404, success: false, message: 'User not found' }, { status: 401 })
      response.cookies.set('access_token', '', { httpOnly: true, sameSite: 'lax', maxAge: 0 })
      response.cookies.set('user_data', '', { httpOnly: true, sameSite: 'lax', maxAge: 0 })
      return response
    }
    if (res.status === 429) {
      const user = await getCurrentUserFromCookies()
      const fullName = user?.full_name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email?.split('@')[0] || 'User'
      const find = Math.max(Number(user?.credits_find ?? 0), 0)
      const verify = Math.max(Number(user?.credits_verify ?? 0), 0)
      const profileFallback = {
        id: user?._id || user?.id || 'client-user',
        full_name: fullName,
        email: user?.email || '',
        company: user?.company ?? null,
        plan: user?.plan || 'free',
        plan_expiry: user?.plan_expiry ?? null,
        available_credits: Math.max(find, verify),
        credits_find: find,
        credits_verify: verify,
      }
      return NextResponse.json(profileFallback, { status: 200 })
    }
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    try {
      const user = await getCurrentUserFromCookies()
      const fullName = user?.full_name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email?.split('@')[0] || 'User'
      const find = Math.max(Number(user?.credits_find ?? 0), 0)
      const verify = Math.max(Number(user?.credits_verify ?? 0), 0)
      const profileFallback = {
        id: user?._id || user?.id || 'client-user',
        full_name: fullName,
        email: user?.email || '',
        company: user?.company ?? null,
        plan: user?.plan || 'free',
        plan_expiry: user?.plan_expiry ?? null,
        available_credits: Math.max(find, verify),
        credits_find: find,
        credits_verify: verify,
      }
      return NextResponse.json(profileFallback, { status: 200 })
    } catch {
      return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
    }
  }
}

export const runtime = 'nodejs'
