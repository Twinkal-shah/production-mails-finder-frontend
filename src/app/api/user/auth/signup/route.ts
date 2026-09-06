import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function POST(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/user/auth/signup`
  const cookie = req.headers.get('cookie') || ''
  try {
    const inboundType = req.headers.get('content-type') || ''
    let outBody: string

    // Read the request body exactly once. A stream can only be consumed a
    // single time, so parsing must happen on the buffered text — calling
    // req.json() and then req.text() throws "Body has already been read".
    const inboundText = await req.text()

    // Normalize payload to support different backend expectations
    if (inboundType.includes('application/json')) {
      let json: Record<string, unknown> = {}
      try {
        json = JSON.parse(inboundText) as Record<string, unknown>
      } catch {
        json = {}
      }
      const email = typeof json.email === 'string' ? json.email.trim() : ''
      const password = typeof json.password === 'string' ? json.password : ''
      const fullNameRaw = typeof json.full_name === 'string' ? json.full_name : ''
      const firstNameRaw = typeof (json.first_name ?? json.firstName) === 'string' ? String(json.first_name ?? json.firstName) : ''
      const lastNameRaw = typeof (json.last_name ?? json.lastName) === 'string' ? String(json.last_name ?? json.lastName) : ''
      const phone = typeof json.phone === 'string' ? json.phone : ''
      const company = typeof json.company === 'string' ? json.company : ''
      let first = firstNameRaw.trim()
      let last = lastNameRaw.trim()
      let full = fullNameRaw.trim()
      if (!full && (first || last)) full = [first, last].filter(Boolean).join(' ').trim()
      if (!first && full) {
        const parts = full.trim().split(/\s+/)
        first = parts[0] || ''
        last = parts.slice(1).join(' ') || ''
      }
      const payload: Record<string, unknown> = { email, password }
      const full_name = full || [first, last].filter(Boolean).join(' ').trim()
      if (full_name) payload.full_name = full_name
      // Omit any other fields to satisfy strict backend schema
      outBody = JSON.stringify(payload)
    } else {
      // Fallback: forward as-is
      outBody = inboundText
    }

    // Debug log — never log the password.
    try {
      const preview = { ...(JSON.parse(outBody) as Record<string, unknown>) }
      if ('password' in preview) preview.password = '[redacted]'
      console.log('Signup proxy - Sending to backend:', JSON.stringify(preview))
    } catch {
      console.log('Signup proxy - Sending to backend: [unparseable body]')
    }

    let res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        'content-type': 'application/json'
      },
      body: outBody,
    })
    
    // The response body is also a single-use stream. Buffer it here and reuse
    // that text below, so a 400 that we do NOT retry can still be returned.
    let responseText = await res.text()

    // If backend rejects due to additional properties, retry with minimal payload
    if (res.status === 400) {
      let firstJson: Record<string, unknown> | null = null
      try { firstJson = JSON.parse(responseText) as Record<string, unknown> } catch {}
      const msg = typeof firstJson?.message === 'string' ? (firstJson?.message as string) : responseText
      if (msg && msg.toLowerCase().includes('additional properties')) {
        try {
          const parsed = JSON.parse(outBody) as Record<string, unknown>
          const emailRetry = typeof parsed.email === 'string' ? parsed.email : ''
          const passwordRetry = typeof parsed.password === 'string' ? parsed.password : ''
          const fullNameRetry = typeof parsed.full_name === 'string' && parsed.full_name.trim() 
            ? parsed.full_name 
            : (() => {
                const fn = typeof parsed.firstName === 'string' ? parsed.firstName : ''
                const ln = typeof parsed.lastName === 'string' ? parsed.lastName : ''
                return [fn, ln].filter(Boolean).join(' ').trim()
              })()
          const minimalPayload: Record<string, string> = { email: emailRetry, password: passwordRetry }
          if (fullNameRetry) minimalPayload.full_name = fullNameRetry
          const minimal = JSON.stringify(minimalPayload)
          console.log('Signup proxy - Retrying with minimal payload for:', emailRetry)
          res = await fetch(url, {
            method: 'POST',
            headers: {
              ...(cookie ? { Cookie: cookie } : {}),
              'content-type': 'application/json'
            },
            body: minimal,
          })
          // New response, so refresh the buffered text.
          responseText = await res.text()
        } catch {}
      }
    }

    console.log('Signup proxy - Backend response:', res.status, responseText)
    
    const contentType = res.headers.get('content-type') || 'application/json'
    return new NextResponse(responseText, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    console.error('Signup proxy error:', error)
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
