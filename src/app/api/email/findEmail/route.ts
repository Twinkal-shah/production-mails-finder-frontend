import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function POST(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/email/findEmail`
  const cookie = req.headers.get('cookie') || ''
  const auth = req.headers.get('authorization') || ''
  const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
  const accessToken = await getAccessTokenFromCookies()
  
  try {
    const inboundType = req.headers.get('content-type') || ''
    let outBody: string
    let outType: string
    let derivedFullName = ''
    let derivedDomain = ''
    if (inboundType.includes('application/json')) {
      const json = await req.json() as { full_name?: string; domain?: string; role?: string; first_name?: string; last_name?: string }
      let first = ''
      let last = ''
      if (json.first_name || json.last_name) {
        first = (json.first_name || '').trim()
        last = (json.last_name || '').trim()
      } else if (json.full_name) {
        const parts = json.full_name.trim().split(/\s+/)
        first = parts[0] || ''
        last = parts.slice(1).join(' ') || ''
      }
      const params = new URLSearchParams()
      if (json.domain) params.set('domain', json.domain.trim())
      if (first) params.set('first_name', first)
      if (last) params.set('last_name', last)
      const roleTrimmed = (json.role || '').trim()
      const roleLower = roleTrimmed.toLowerCase()
      if (roleTrimmed && roleLower !== 'undefined' && roleLower !== '$undefined' && roleLower !== 'null' && roleLower !== 'none') {
        params.set('role', roleTrimmed)
      }
      outBody = params.toString()
      outType = 'application/x-www-form-urlencoded'
      derivedDomain = (json.domain || '').trim()
      derivedFullName = (first || last) ? `${first}${last ? ' ' + last : ''}`.trim() : (json.full_name || '').trim()
    } else {
      outBody = await req.text()
      outType = inboundType || 'application/x-www-form-urlencoded'
      try {
        const p = new URLSearchParams(outBody || '')
        const first = (p.get('first_name') || '').trim()
        const last = (p.get('last_name') || '').trim()
        derivedDomain = (p.get('domain') || '').trim()
        const fullFromParams = (p.get('full_name') || '').trim()
        derivedFullName = fullFromParams || ((first || last) ? `${first}${last ? ' ' + last : ''}`.trim() : '')
      } catch {}
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(auth ? { Authorization: auth } : {}),
        ...(accessToken && !auth ? { Authorization: `Bearer ${accessToken}` } : {}),
        'content-type': outType
      },
      body: outBody,
    })
    
    const contentType = res.headers.get('content-type') || 'application/json'
    const text = await res.text()
    let root: unknown = undefined
    try {
      root = JSON.parse(text)
    } catch {
      root = text
    }
    let payload: Record<string, unknown> = {}
    if (root && typeof root === 'object') {
      const r = root as Record<string, unknown>
      const data = typeof r.data === 'object' && r.data !== null ? (r.data as Record<string, unknown>) : undefined
      const result = typeof r.result === 'object' && r.result !== null ? (r.result as Record<string, unknown>) : undefined
      payload = data || result || r
    }
    const email = typeof payload.email === 'string' ? String(payload.email) : undefined
    const statusRaw = typeof payload.status === 'string' ? String(payload.status) : (root && typeof root === 'object' && typeof (root as Record<string, unknown>).status === 'string' ? String((root as Record<string, unknown>).status) : undefined)
    const domain = typeof payload.domain === 'string' ? String(payload.domain) : derivedDomain || undefined
    const mx = typeof payload.mx === 'string' ? String(payload.mx) : (root && typeof root === 'object' && typeof (root as Record<string, unknown>).mx === 'string' ? String((root as Record<string, unknown>).mx) : undefined)
    const normalizedStatus = (() => {
      const s = (statusRaw || '').toLowerCase()
      if ((email || '').length > 3) return 'valid'
      if (s === 'valid' || s === 'found' || s === 'success') return 'valid'
      if (s === 'invalid' || s === 'not_found' || s === 'failed') return 'invalid'
      return s || 'error'
    })()
    const fullName = derivedFullName || (typeof payload.full_name === 'string' ? String(payload.full_name) : undefined)
    const responseBody = {
      success: !!email || normalizedStatus === 'valid' || normalizedStatus === 'invalid',
      data: {
        email: email || null,
        full_name: fullName || '',
        domain: domain || '',
        mx: mx || '',
        status: normalizedStatus
      }
    }
    return NextResponse.json(responseBody, { status: res.status })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
