import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

async function getAuthHeaders(req: NextRequest) {
  const cookie = req.headers.get('cookie') || ''
  const authHeader = req.headers.get('authorization') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const token = authHeader ? undefined : await getAccessTokenFromCookies()
  return {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(token && !authHeader ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function GET(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const type = req.nextUrl.searchParams.get('type') || ''
  const limit = req.nextUrl.searchParams.get('limit') || '10'
  const qs = new URLSearchParams()
  if (type) qs.set('type', type)
  qs.set('limit', limit)
  const url = `${backend}/api/email/recent-results?${qs.toString()}`

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: await getAuthHeaders(req),
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

export async function DELETE(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const type = req.nextUrl.searchParams.get('type') || ''
  const qs = type ? `?type=${encodeURIComponent(type)}` : ''
  const url = `${backend}/api/email/recent-results${qs}`

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: await getAuthHeaders(req),
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
