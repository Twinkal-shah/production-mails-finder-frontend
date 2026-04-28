import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ job_id: string }> }
) {
  const { job_id } = await params
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/email/job/${encodeURIComponent(job_id)}/download`
  const cookie = req.headers.get('cookie') || ''
  const authHeader = req.headers.get('authorization') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const token = authHeader ? undefined : await getAccessTokenFromCookies()

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(token && !authHeader ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    const contentType = res.headers.get('content-type') || 'text/csv'
    const body = await res.arrayBuffer()
    return new NextResponse(body, {
      status: res.status,
      headers: {
        'content-type': contentType,
        ...(res.headers.get('content-disposition')
          ? { 'content-disposition': res.headers.get('content-disposition')! }
          : {}),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Proxy error', message: (error as Error).message },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
