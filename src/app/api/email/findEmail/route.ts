import { NextRequest, NextResponse } from 'next/server'
import { getBackendBaseUrl } from '@/lib/api'

export async function POST(request: NextRequest) {
  try {
    const ENV = (process.env.NEXT_PUBLIC_API_ENV || '').trim().toLowerCase()
    const BASE_URL_ENV = ENV === 'staging' ? (process.env.NEXT_PUBLIC_API_URL_STAGING || '').trim() : ''
    const backend = (BASE_URL_ENV || getBackendBaseUrl()).replace(/\/+$/, '')
    const url = `${backend}/api/email/findEmail`

    const cookieHeader = request.headers.get('cookie') || ''
    const body = await request.json()
    console.log('Forwarding cookies:', cookieHeader)
    const accessToken = cookieHeader
      .split('; ')
      .find(row => row.startsWith('access_token='))
      ?.split('=')[1]

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        Authorization: accessToken ? `Bearer ${accessToken}` : ''
      },
      body: JSON.stringify(body),
    })

    const text = await res.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = { success: res.ok, message: text }
    }
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Find Email API Error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
