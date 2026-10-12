import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

/**
 * Tells the backend which visitor this request is for. Without it the backend sees this
 * server as the caller for every browser, and its per-IP limits on the OTP endpoints would
 * become one shared bucket for the whole site.
 *
 * The visitor's address is the LAST X-Forwarded-For entry: that is the one our own nginx
 * appends from Cloudflare's real-IP header (deploy/nginx.conf), while earlier entries can
 * be whatever the browser chose to send. It travels in a dedicated header because the
 * backend's edge (Caddy) rewrites X-Forwarded-For from untrusted callers.
 */
function forwardedClientHeaders(req: NextRequest): Record<string, string> {
  // Production sits behind Cloudflare, which stamps the visitor in CF-Connecting-IP and
  // every hop passes that header through untouched; it is the most reliable source.
  const chain = (req.headers.get('x-forwarded-for') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const visitor =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    chain[chain.length - 1] ||
    ''
  return visitor ? { 'x-mf-client-ip': visitor } : {}
}

/**
 * Proxy for re-sending an e-mail verification code. Forwards the verification token
 * untouched and returns the backend's answer as-is; no session is involved, so nothing
 * is stored here.
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
  const url = `${backend}/api/user/auth/resend-otp`
  const cookie = req.headers.get('cookie') || ''

  try {
    const body = await req.text()
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...forwardedClientHeaders(req),
        'content-type': 'application/json'
      },
      body,
    })
    const contentType = res.headers.get('content-type') || 'application/json'
    const text = await res.text()
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
