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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/email/job/${encodeURIComponent(job_id)}`

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/email/job/${encodeURIComponent(job_id)}`

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
