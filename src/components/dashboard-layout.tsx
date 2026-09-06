'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, Menu, Zap, Search, Settings as SettingsIcon, Sun, Moon } from 'lucide-react'
import { apiGet } from '@/lib/api'
import { OnboardingFlow } from '@/components/onboarding-flow'
import { AppSidebar } from '@/components/app-sidebar'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useCreditsData'

/** Breadcrumb labels for the Stitch top bar, keyed by route. */
const PAGE_LABELS: Record<string, string> = {
  '/home': 'Dashboard',
  '/find': 'Find Email',
  '/bulk-finder': 'Bulk Find',
  '/verify': 'Verify Email',
  '/domain-search': 'Domain Search',
  '/api-calls': 'API & Webhooks',
  '/credits': 'Billing & Quota',
  '/upgrade': 'Upgrade Plan',
  '/job-history': 'Job History',
  '/user': 'Settings',
  '/video-tutorials': 'Video Tutorials',
}

interface DashboardLayoutProps {
  children: React.ReactNode
  userProfile: {
    full_name: string | null
    credits: number
    email: string
    company: string | null
    plan: string
    plan_expiry: string | null
    credits_find: number
    credits_verify: number
    available_credits?: number
  }
}

 

export function DashboardLayout({ children, userProfile }: DashboardLayoutProps) {
  const [isDark, setIsDark] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // Backend now returns the unified spendable total in `available_credits`.
  // Fall back to summing the legacy split for any cached/stale payloads.
  const initialCredits = Math.max(
    Number(userProfile.available_credits ?? ((userProfile.credits_find || 0) + (userProfile.credits_verify || 0))),
    0
  )

const [currentProfile, setCurrentProfile] = useState({
  ...userProfile,
  credits: initialCredits   // 👈 override immediately
})
  const router = useRouter()
  const pathname = usePathname()
  const { data: queryProfile } = useUserProfile()

  // Derived view-model for the Stitch shell (display only — no data changes).
  const creditsDisplay = Math.max(Number(currentProfile.credits || 0), 0)
  const pageLabel =
    PAGE_LABELS[pathname] ??
    Object.entries(PAGE_LABELS).find(([route]) => pathname.startsWith(route + '/'))?.[1] ??
    'Workspace'
  const headerInitials = (() => {
    const source = (currentProfile.full_name || currentProfile.email || 'U').trim()
    const parts = source.split(/[\s@.]+/).filter(Boolean)
    return ((parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')).toUpperCase()
  })()
  const sidebarProfile = {
    full_name: currentProfile.full_name,
    email: currentProfile.email,
    credits: creditsDisplay,
    plan: currentProfile.plan,
  }

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null
    const prefersDark = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)').matches : false
    const enableDark = stored ? stored === 'dark' : prefersDark
    setIsDark(enableDark)
    try {
      const root = document.documentElement
      if (enableDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    } catch {}
  }, [])

  const toggleTheme = () => {
    const next = !isDark
    setIsDark(next)
    try {
      const root = document.documentElement
      if (next) {
        root.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        root.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
    } catch {}
  }

  // Listen for focus events to refresh profile data when user returns from payment
  useEffect(() => {
    if (queryProfile) {
      const qp = queryProfile as typeof queryProfile & { available_credits?: number }
      const totalCredits = Math.max(
        Number(qp.available_credits ?? ((qp.credits_find || 0) + (qp.credits_verify || 0))),
        0
      )
      setCurrentProfile({
        full_name: queryProfile.full_name,
        credits: totalCredits,
        email: queryProfile.email,
        company: currentProfile.company,
        plan: queryProfile.plan,
        plan_expiry: currentProfile.plan_expiry,
        credits_find: Math.max(queryProfile.credits_find || 0, 0),
        credits_verify: Math.max(queryProfile.credits_verify || 0, 0)
      })
    }
  }, [queryProfile])

  useEffect(() => {
    const handleFocus = async () => {
      try {
        console.log('Trying to fetch profile from backend...')
        const profileRes = await apiGet<Record<string, unknown>>('/api/user/profile/getProfile', { useProxy: true })
        if (profileRes.status === 401) {
          try {
            await fetch('/api/user/auth/logout', { method: 'POST' })
          } catch {}
          try {
            localStorage.removeItem('access_token')
            localStorage.removeItem('user_data')
            localStorage.removeItem('auth_token')
            localStorage.removeItem('refresh_token')
          } catch {}
          router.push('/auth/login?signup=1')
          return
        }
        console.log('Backend profile result:', profileRes)
        if (profileRes.ok && profileRes.data) {
          const up = (profileRes.data && typeof profileRes.data === 'object' && 'data' in profileRes.data)
            ? ((profileRes.data as Record<string, unknown>)['data'] as Record<string, unknown>)
            : (profileRes.data as Record<string, unknown>)
          // ⭐ FIX FLICKER: Remove old backend credits field immediately
  if ('credits' in up) {
    delete up.credits
  }
          let findCredits = Math.max(Number(currentProfile.credits_find ?? 0), 0)
          let verifyCredits = Math.max(Number(currentProfile.credits_verify ?? 0), 0)
          let availableCredits: number | undefined
          try {
            const res = await apiGet<Record<string, unknown>>('/api/user/credits', { useProxy: true })
            if (res.ok && res.data) {
              const d = res.data as Record<string, unknown>
              if (d['available_credits'] != null) availableCredits = Number(d['available_credits'])
              findCredits = Math.max(Number(d['find'] ?? d['credits_find'] ?? findCredits), 0)
              verifyCredits = Math.max(Number(d['verify'] ?? d['credits_verify'] ?? verifyCredits), 0)
            }
          } catch {}
          const totalCredits = Math.max(
            Number(availableCredits ?? (findCredits + verifyCredits)),
            0
          )

          const fullNameValue = typeof up.full_name === 'string' ? (up.full_name as string) : (currentProfile.full_name || 'User')
          const emailValue = typeof up.email === 'string' ? (up.email as string) : (currentProfile.email || '')
          const companyValue = typeof up.company === 'string' ? (up.company as string) : (currentProfile.company ?? null)
          const planValue = typeof up.plan === 'string' ? (up.plan as string) : (currentProfile.plan || 'free')
          const planExpiryValue = typeof up.plan_expiry === 'string' ? (up.plan_expiry as string) : (currentProfile.plan_expiry ?? null)
          const newUserProfile = {
            full_name: fullNameValue,
            credits: totalCredits,
            email: emailValue,
            company: companyValue,
            plan: planValue,
            plan_expiry: planExpiryValue,
            credits_find: findCredits,
            credits_verify: verifyCredits
          }
          console.log('Setting profile from backend:', newUserProfile)
          setCurrentProfile(newUserProfile)
          return
        }

        const userDataStr = localStorage.getItem('user_data')
        console.log('Client-side user data from localStorage:', userDataStr)
        if (userDataStr && userDataStr !== 'undefined' && userDataStr !== 'null') {
          try {
            const userData = JSON.parse(userDataStr)
            console.log('Parsed user data:', userData)
            const nameFromLocal = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.full_name || null
            const findCredits = Math.max(Number(currentProfile.credits_find ?? 0), 0)
            const verifyCredits = Math.max(Number(currentProfile.credits_verify ?? 0), 0)
            // credits_find/credits_verify echo the same total post-migration,
            // so taking the larger avoids double-counting if they happen to be equal.
            const totalCredits = Math.max(findCredits, verifyCredits)

            const emailValue = typeof userData.email === 'string' ? userData.email : (currentProfile.email || '')
            const companyValue = typeof userData.company === 'string' ? userData.company : (currentProfile.company ?? null)
            const planValue = typeof userData.plan === 'string' ? userData.plan : (currentProfile.plan || 'free')
            const planExpiryValue = typeof userData.plan_expiry === 'string' ? userData.plan_expiry : (currentProfile.plan_expiry ?? null)
            const newUserProfile = {
              full_name: nameFromLocal || currentProfile.full_name || 'User',
              credits: totalCredits,
              email: emailValue,
              company: companyValue,
              plan: planValue,
              plan_expiry: planExpiryValue,
              credits_find: findCredits,
              credits_verify: verifyCredits
            }
            console.log('New user profile from localStorage:', newUserProfile)
            setCurrentProfile(newUserProfile)
            return
          } catch (parseError) {
            console.error('Error parsing user data from localStorage:', parseError)
          }
        } else {
          console.log('No user_data found in localStorage')
        }

        setCurrentProfile({
          full_name: 'Guest User',
          credits: 0,
          email: 'Please log in to access features',
          company: null,
          plan: 'free',
          plan_expiry: null,
          credits_find: 0,
          credits_verify: 0
        })
      } catch (error) {
        console.error('Failed to refresh profile data:', error)
      }
    }

    // Also try to fetch profile immediately on mount
    console.log('Dashboard layout mounted, fetching profile...')
    handleFocus()

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const handleSignOut = async () => {
    try {
      // Call logout API to clear server cookies
      await fetch('/api/user/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      // Clear localStorage items
      localStorage.removeItem('access_token')
      localStorage.removeItem('user_data')
      
      // Clear any other potential auth-related items
      localStorage.removeItem('auth_token')
      localStorage.removeItem('refresh_token')
      
      // Clear sessionStorage redirect URL
      sessionStorage.removeItem('redirect_after_login')
      
      // Show success toast
      toast.success('Signed out successfully')
      
      // Redirect to login page after a short delay to show toast
      setTimeout(() => {
        router.push('/auth/login')
      }, 1000)
    } catch (error) {
      console.error('Error during sign out:', error)
      toast.error('Error signing out')
      // Still redirect to login even if clearing storage fails
      setTimeout(() => {
        router.push('/auth/login')
      }, 1000)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas dark:bg-[#1b1c1b] text-ink dark:text-white transition-colors duration-300 ease-out">
      {/* Onboarding Flow */}
      <OnboardingFlow userProfile={currentProfile} />

      {/* Sidebar — fixed rail on desktop */}
      <div className="hidden lg:flex h-full">
        <AppSidebar profile={sidebarProfile} onSignOut={handleSignOut} />
      </div>

      {/* Sidebar — slide-over drawer on mobile/tablet */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="relative h-full animate-fade-slide-in">
            <AppSidebar
              profile={sidebarProfile}
              onSignOut={handleSignOut}
              onNavigate={() => setMobileNavOpen(false)}
              onClose={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}
      
      

      

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 h-full overflow-hidden">
        {/* Top bar */}
        <header className="h-16 shrink-0 bg-white dark:bg-[#0f0f0f] border-b border-gray-200 dark:border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4 z-20 transition-colors duration-300 ease-out">
          {/* Left: mobile menu + breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-1.5 -ml-1 rounded-lg text-gray-500 hover:text-ink dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-gray-400 dark:text-gray-500 font-medium hidden sm:inline">Platform</span>
              <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">/</span>
              <span className="font-semibold text-ink dark:text-white truncate">{pageLabel}</span>
            </nav>
          </div>

          {/* Right: credits, primary action, theme, account */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
              <Zap className="h-4 w-4 text-brand" />
              <span className="text-xs font-bold text-ink dark:text-white tabular-nums">
                {creditsDisplay.toLocaleString()}
              </span>
              <span className="text-[11px] text-gray-400 font-medium">Credits</span>
              <Link href="/credits" className="text-[11px] font-bold text-brand hover:underline ml-1">
                Top up
              </Link>
            </div>

            <Link
              href="/find"
              className="h-8 px-3 bg-brand text-white rounded-lg text-xs font-bold hover:bg-brand-hover transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Search className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">New Lookup</span>
            </Link>

            <div className="h-4 w-px bg-gray-200 dark:bg-white/10 mx-0.5 hidden sm:block" />

            <button
              type="button"
              aria-label="Toggle theme"
              onClick={toggleTheme}
              className="p-1.5 text-gray-500 hover:text-ink dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="w-8 h-8 rounded-full bg-brand-light dark:bg-brand/20 text-brand border border-brand-border dark:border-brand/30 flex items-center justify-center text-xs font-bold hover:border-brand/50 transition-colors"
                >
                  {headerInitials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 dark:bg-[#121212] dark:text-gray-100">
                <div className="px-3 py-2 text-sm">
                  <div className="font-medium">{currentProfile.full_name || 'User'}</div>
                  <div className="text-gray-500 dark:text-gray-400">{currentProfile.email}</div>
                  {currentProfile.company && (
                    <div className="text-gray-500 dark:text-gray-400 text-xs">{currentProfile.company}</div>
                  )}
                </div>
                <DropdownMenuSeparator />
                <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Plan:</span>
                    <span className="capitalize font-medium">{currentProfile.plan}</span>
                  </div>
                  {currentProfile.plan_expiry && (
                    <div className="flex justify-between mt-1">
                      <span>Expires:</span>
                      <span>{new Date(currentProfile.plan_expiry).toLocaleDateString()}</span>
                    </div>
                  )}
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Credits:</span>
                      <span className="font-medium">{creditsDisplay}</span>
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/user">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-canvas dark:bg-[#1b1c1b] transition-colors duration-300 ease-out">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>

    </div>
  )
}
