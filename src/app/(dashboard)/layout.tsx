import { DashboardLayout } from '@/components/dashboard-layout'
import { getCurrentUserFromCookies } from '@/lib/auth-server'
import { cookies } from 'next/headers'
import { apiGet } from '@/lib/api'
import { redirect } from 'next/navigation'

// Force dynamic rendering for all dashboard pages
export const dynamic = 'force-dynamic'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  // In server components, we need to handle the request differently
  // Let's use a simpler approach by fetching directly from backend
  const user = await getCurrentUserFromCookies()
  
  // Debug: Log the user data from cookies
  console.log('Server-side user from cookies:', user)
  
  // Debug: Check what cookies are actually present
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  console.log('All cookies:', allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 50) + '...' })))
  
  if (!user) {
    redirect('/auth/login')
  }
  
  // User found via cookies, proceed normally
  // Try to fetch full profile data from backend
  let fullProfile = null
  let serverFind = 0
  let serverVerify = 0
  try {
    // Get access token from cookies to make authenticated request
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('access_token')?.value
    
    if (accessToken) {
      console.log('Fetching full profile via proxy API...')
      const profileRes = await apiGet<Record<string, unknown>>('/api/user/profile/getProfile', { useProxy: true })
      if (profileRes.ok && profileRes.data) {
        const d = profileRes.data as Record<string, unknown>
        fullProfile = (d && typeof d === 'object' && 'data' in d) ? (d['data'] as Record<string, unknown>) : d
      }
    }
    const creditsRes = await apiGet<Record<string, unknown>>('/api/user/credits', { useProxy: true })
    if (creditsRes.ok && creditsRes.data) {
      const d = creditsRes.data as Record<string, unknown>
      serverFind = Number(d['credits_find'] ?? d['find'] ?? 0)
      serverVerify = Number(d['credits_verify'] ?? d['verify'] ?? 0)
    }
  } catch (error) {
    console.error('Failed to fetch full profile:', error)
  }
  
  // Use the user data from cookies to create the profile
  // Backend returns: { _id, email, firstName, lastName } (your backend format)
  // Frontend expects: { full_name, email, credits, etc. }
if (!serverFind && !serverVerify) {
  serverFind = Number(fullProfile?.credits_find ?? user.credits_find ?? 0)
  serverVerify = Number(fullProfile?.credits_verify ?? user.credits_verify ?? 0)
}

  const u = user as Record<string, unknown>
  const fp = (fullProfile ?? null) as (Record<string, unknown> | null)
  const emailVal = typeof (fp?.email) === 'string' ? (fp!.email as string) : (typeof u.email === 'string' ? (u.email as string) : '')
  const fullNameFP = typeof (fp?.full_name) === 'string' ? (fp!.full_name as string) : ''
  const fullNameU = `${typeof u.firstName === 'string' ? (u.firstName as string) : ''} ${typeof u.lastName === 'string' ? (u.lastName as string) : ''}`.trim()
  const computedName = fullNameFP || fullNameU || (emailVal ? emailVal.split('@')[0] : '')

  const userProfile = {
    full_name: computedName || null,
    credits: serverFind + serverVerify,
    email: emailVal,
    company: typeof (fp?.company) === 'string' ? (fp!.company as string) : (typeof u.company === 'string' ? (u.company as string) : null),
    plan: typeof (fp?.plan) === 'string' ? (fp!.plan as string) : (typeof u.plan === 'string' ? (u.plan as string) : 'free'),
    plan_expiry: typeof (fp?.plan_expiry) === 'string' ? (fp!.plan_expiry as string) : (typeof u.plan_expiry === 'string' ? (u.plan_expiry as string) : null),
    credits_find: serverFind,
    credits_verify: serverVerify
  }

  return (
    <DashboardLayout userProfile={userProfile}>
      {children}
    </DashboardLayout>
  )
}
