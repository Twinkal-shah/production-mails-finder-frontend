import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function POST(req: NextRequest) {
  let backend = getBackendBaseUrl()
  try {
    const appHost = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase()
    const backendHost = (() => { try { return new URL(backend).host.toLowerCase() } catch { return '' } })()
    if (backendHost && appHost && backendHost === appHost) {
      backend = 'https://server.mailsfinder.com'
    }
  } catch {}
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
    let accessToken, refreshTokenNew, user
    
    // Check for your backend format: { data: { user, access_token } }
    if (responseData.data && responseData.data.user && responseData.data.access_token) {
      accessToken = responseData.data.access_token
      refreshTokenNew = responseData.data.refresh_token
      user = responseData.data.user
      console.log('Detected your backend format with data wrapper')
    }
    // Check for standard format: { accessToken, user }
    else if (responseData.accessToken && responseData.user) {
      accessToken = responseData.accessToken
      refreshTokenNew = responseData.refreshToken
      user = responseData.user
      console.log('Detected standard format')
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

      // Set refresh token cookie if provided by backend
      if (typeof refreshTokenNew === 'string' && refreshTokenNew.length > 0) {
        response.cookies.set('refresh_token', refreshTokenNew, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30 // 30 days
        })
      }
      
      return response
    }
    
    // Return original response if not successful
    return new NextResponse(text, { status: res.status, headers: { 'content-type': contentType } })
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', message: (error as Error).message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
