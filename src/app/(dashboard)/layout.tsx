import { DashboardLayout } from '@/components/dashboard-layout'
import { getCurrentUserFromCookies } from '@/lib/auth-server'
import { cookies } from 'next/headers'
import { apiGet } from '@/lib/api'

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
  
  // Remove server-side debug logs to prevent runtime errors in edge
  
  // If no user found via cookies, don't redirect immediately
  // Let the client-side handle authentication
 if (!user) {
  return (
    <DashboardLayout userProfile={{
      full_name: '',
      email: '',
      company: null,
      plan: 'free',
      plan_expiry: null,

      // ⭐ Prevent flicker — do NOT initialize credits to 0
      credits: undefined as unknown as number,
      credits_find: undefined as unknown as number,
      credits_verify: undefined as unknown as number,
    }}>

        {children}
      </DashboardLayout>
    )
  }
  
  // User found via cookies, proceed normally
  // Try to fetch full profile data from backend
  let fullProfile = null
  let serverFind = 0
  let serverVerify = 0
  let serverAvailable: number | undefined
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
      const av = Number(d['available_credits'])
      if (Number.isFinite(av) && av >= 0) serverAvailable = av
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

  // Prefer the unified `available_credits` from the backend; fall back to the
  // larger of the two legacy values (NOT the sum — both echo the same total
  // post-migration, so summing double-counts).
  const fullProfileAvailable = Number((fullProfile as Record<string, unknown> | null)?.available_credits)
  const totalCredits =
    typeof serverAvailable === 'number'
      ? serverAvailable
      : Number.isFinite(fullProfileAvailable) && fullProfileAvailable >= 0
        ? fullProfileAvailable
        : Math.max(serverFind, serverVerify)

  const userProfile = {
    full_name: fullProfile?.full_name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.full_name || null,
    credits: totalCredits,
    email: fullProfile?.email || user.email || '',
    company: fullProfile?.company ?? user.company ?? null,
    plan: fullProfile?.plan || user.plan || 'free',
    plan_expiry: fullProfile?.plan_expiry ?? user.plan_expiry ?? null,
    available_credits: totalCredits,
    credits_find: serverFind,
    credits_verify: serverVerify
  }

  return (
    <DashboardLayout userProfile={userProfile}>
      {children}
    </DashboardLayout>
  )
}
