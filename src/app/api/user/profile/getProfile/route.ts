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
    if (res.status === 404 || res.status === 429) {
      const user = await getCurrentUserFromCookies()
      const u = (user ?? null) as (Record<string, unknown> | null)
      const emailVal = u && typeof u.email === 'string' ? (u.email as string) : ''
      const fullNameField = u && typeof u.full_name === 'string' ? (u.full_name as string) : ''
      const fullNameFromFields = `${u && typeof u.firstName === 'string' ? (u.firstName as string) : ''} ${u && typeof u.lastName === 'string' ? (u.lastName as string) : ''}`.trim()
      const computedName = fullNameField || fullNameFromFields || (emailVal ? emailVal.split('@')[0] : '') || 'User'
      const profileFallback = {
        id: (u && typeof u._id === 'string' ? (u._id as string) : (u && typeof u.id === 'string' ? (u.id as string) : 'client-user')),
        full_name: computedName,
        email: emailVal,
        company: u && typeof u.company === 'string' ? (u.company as string) : null,
        plan: u && typeof u.plan === 'string' ? (u.plan as string) : 'free',
        plan_expiry: u && typeof u.plan_expiry === 'string' ? (u.plan_expiry as string) : null,
        credits_find: Math.max(Number(u?.credits_find ?? 0), 0),
        credits_verify: Math.max(Number(u?.credits_verify ?? 0), 0)
      }
      return NextResponse.json(profileFallback, { status: 200 })
    }
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
