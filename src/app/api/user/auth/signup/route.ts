import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function POST(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/user/auth/signup`
  const cookie = req.headers.get('cookie') || ''
  try {
    const inboundType = req.headers.get('content-type') || ''
    let outBody: string
    
    // Normalize payload to support different backend expectations
    if (inboundType.includes('application/json')) {
      const json = await req.json().catch(async () => {
        const txt = await req.text()
        try { return JSON.parse(txt) } catch { return {} }
      }) as Record<string, unknown>
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
      if (first) payload.firstName = first
      if (last) payload.lastName = last
      if (phone && phone.trim()) payload.phone = phone.trim()
      if (company && company.trim()) payload.company = company.trim()
      outBody = JSON.stringify(payload)
    } else {
      // Fallback: forward as-is
      const txt = await req.text()
      outBody = txt
    }
    
    // Debug: Log what we're sending to backend
    console.log('Signup proxy - Sending to backend:', outBody)
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        'content-type': 'application/json'
      },
      body: outBody,
    })
    
    // Debug: Log backend response
    const responseText = await res.text()
    console.log('Signup proxy - Backend response:', res.status, responseText)
    
    const contentType = res.headers.get('content-type') || 'application/json'
    return new NextResponse(responseText, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    console.error('Signup proxy error:', error)
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
