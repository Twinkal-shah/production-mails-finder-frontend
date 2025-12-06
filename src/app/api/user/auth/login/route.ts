import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function POST(req: NextRequest) {
  const backend = getBackendBaseUrl()
  const url = `${backend}/api/user/auth/login`
  const cookie = req.headers.get('cookie') || ''
  
  try {
    const body = await req.text()
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        'content-type': 'application/json'
      },
      body,
    })
    
    const contentType = res.headers.get('content-type') || 'application/json'
    const text = await res.text()
    
    // Parse the response to get user data
    let responseData
    try {
      responseData = JSON.parse(text)
      console.log('Backend login response:', responseData)
    } catch {
      // If response is not JSON, return as-is
      return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
    }
    
    // Handle different backend response formats
    let accessToken: string | undefined, user: unknown
    
    // Preferred: { data: { user, access_token | token } }
    if (responseData && typeof responseData === 'object' && 'data' in responseData) {
      const d = (responseData as Record<string, unknown>).data as Record<string, unknown>
      const t1 = d?.access_token
      const t2 = d?.token
      const u1 = d?.user
      if (typeof t1 === 'string' || typeof t2 === 'string') {
        accessToken = (typeof t1 === 'string' ? t1 : (typeof t2 === 'string' ? t2 : undefined))
        user = u1 ?? user
        console.log('Detected backend format inside data')
      }
    }
    // Alternate: { access_token | token, user }
    if (!accessToken && responseData && typeof responseData === 'object') {
      const t3 = (responseData as Record<string, unknown>).access_token
      const t4 = (responseData as Record<string, unknown>).token
      const u2 = (responseData as Record<string, unknown>).user
      if (typeof t3 === 'string' || typeof t4 === 'string') {
        accessToken = (typeof t3 === 'string' ? (t3 as string) : (typeof t4 === 'string' ? (t4 as string) : undefined))
        user = u2 ?? user
        console.log('Detected top-level token format')
      }
    }
    // As a last resort, accept any non-empty string token and try to read user from text
    if (!accessToken && typeof responseData === 'string' && responseData.length > 0) {
      accessToken = responseData
      console.log('Detected raw token string format')
    }
    
    // If login was successful and we have the data, set cookies
    if (res.ok && accessToken && user) {
      console.log('Setting cookies with user data:', user)
      const response = NextResponse.json(responseData, { status: res.status })
      
      // Set HTTP-only cookies for server-side authentication
      response.cookies.set('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
      
      response.cookies.set('user_data', JSON.stringify(user), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      })
      
      return response
    }
    
    // Return original response if not successful
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
