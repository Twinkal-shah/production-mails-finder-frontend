import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export async function getCurrentUserFromCookies() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    if (!token) return null

    const backend = process.env.NEXT_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_LOCAL_URL || 'http://server.mailsfinder.com:8081/.'
    const res = await fetch(`${backend}/api/user/me`, {
      method: 'GET',
      headers: {
        Cookie: `access_token=${token}`,
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      cache: 'no-store'
    })
    if (!res.ok) return null
    const data = await res.json()
    return data
  } catch (error) {
    console.error('Error getting user from cookies:', error)
    return null
  }
}

// Server-side function to get access token from cookies
export async function getAccessTokenFromCookies() {
  try {
    const cookieStore = await cookies()
    const tokenCookie = cookieStore.get('access_token')
    
    return tokenCookie?.value || null
  } catch (error) {
    console.error('Error getting access token from cookies:', error)
    return null
  }
}

// Server-side function to check if user is authenticated
export async function isAuthenticatedServer() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('access_token')
    const userData = cookieStore.get('user_data')
    
    return !!(accessToken && userData)
  } catch (error) {
    console.error('Error checking server authentication:', error)
    return false
  }
}

// Get user from request headers (for API routes)
export function getUserFromRequest(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return null
    
    // Extract token from Bearer token
    const token = authHeader.replace('Bearer ', '')
    if (!token) return null
    
    // For now, we'll just check if token exists
    // In a real implementation, you'd verify the JWT token here
    return { token }
  } catch (error) {
    console.error('Error getting user from request:', error)
    return null
  }
}
