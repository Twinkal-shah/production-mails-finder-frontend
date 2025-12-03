import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const backend = process.env.NEXT_PUBLIC_LOCAL_URL || 'http://server.mailsfinder.com:8081/.'
  const url = `${backend}/api/user/auth/signup`
  const cookie = req.headers.get('cookie') || ''
  try {
    const body = await req.text()
    
    // Debug: Log what we're sending to backend
    console.log('Signup proxy - Sending to backend:', body)
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        'content-type': 'application/json'
      },
      body,
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
