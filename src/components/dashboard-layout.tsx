'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, LogOut, Search, Users, CheckCircle, Code2 } from 'lucide-react'
import { apiGet } from '@/lib/api'
import { OnboardingFlow } from '@/components/onboarding-flow'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useCreditsData'

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
  }
}

 

export function DashboardLayout({ children, userProfile }: DashboardLayoutProps) {
  const [isDark, setIsDark] = useState(false)
  const initialCredits =
  Math.max(userProfile.credits_find || 0, 0) + Math.max(userProfile.credits_verify || 0, 0)

const [currentProfile, setCurrentProfile] = useState({
  ...userProfile,
  credits: initialCredits   // 👈 override immediately
})
  const router = useRouter()
  const pathname = usePathname()
  const { data: queryProfile } = useUserProfile()

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
      const totalCredits = Math.max(queryProfile.credits_find || 0, 0) + Math.max(queryProfile.credits_verify || 0, 0)
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
          try {
            const res = await apiGet<Record<string, unknown>>('/api/user/credits', { useProxy: true })
            if (res.ok && res.data) {
              const d = res.data as Record<string, unknown>
              findCredits = Math.max(Number(d['find'] ?? d['credits_find'] ?? findCredits), 0)
              verifyCredits = Math.max(Number(d['verify'] ?? d['credits_verify'] ?? verifyCredits), 0)
            }
          } catch {}
          const totalCredits = Math.max(findCredits, 0) + Math.max(verifyCredits, 0)

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
            const totalCredits = Math.max(findCredits, 0) + Math.max(verifyCredits, 0)

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
    <div className="flex h-screen bg-background transition-colors duration-500 ease-out">
      {/* Onboarding Flow */}
      <OnboardingFlow userProfile={currentProfile} />
      
      

      

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-0">
        {/* Top bar */}
        <header className="bg-white dark:bg-[#0f0f0f] shadow-sm border-b dark:border-white/10 transition-colors duration-500 ease-out">
          <div className="mx-auto max-w-6xl w-full flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-4">
              <Link href="/home" className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" style={{ color: 'var(--primary)' }}>
                    <path d="M20 4H4a2 2 0 0 0-2 2v.5l10 6 10-6V6a2 2 0 0 0-2-2Zm0 4.236-8 4.8-8-4.8V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.236Z"/>
                  </svg>
                </span>
                <span className="text-lg font-black tracking-tight">Mailsfinder</span>
              </Link>
              <div className="flex items-center space-x-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center">
                      <User className="h-5 w-5" />
                    </Button>
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
                          <span>Find Credits:</span>
                          <span className="font-medium">{Math.max(currentProfile.credits_find || 0, 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Verify Credits:</span>
                          <span className="font-medium">{Math.max(currentProfile.credits_verify || 0, 0)}</span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Link href="/user" className="hidden sm:block hover:underline">
                  {currentProfile.full_name || 'User'}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Toggle theme"
                  className="ml-2 hover:bg-white/10 dark:hover:bg-white/10"
                  onClick={toggleTheme}
                >
                  {isDark ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5 fill-yellow-400" aria-hidden="true"><path d="M12 3a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-5a1 1 0 0 1 1 1v0a1 1 0 1 1-2 0v0a1 1 0 0 1 1-1ZM4 12a1 1 0 0 1 1-1v0a1 1 0 1 1 0 2v0a1 1 0 0 1-1-1Zm14.95 6.536a1 1 0 0 1-1.414 1.414l-1.414-1.414a1 1 0 1 1 1.414-1.414l1.414 1.414ZM7.879 7.879a1 1 0 0 1-1.415-1.415L7.879 5.05a1 1 0 0 1 1.415 1.415L7.879 7.88ZM5.05 16.121a1 1 0 0 1 1.415-1.415l1.414 1.414a1 1 0 1 1-1.415 1.415L5.05 16.121ZM16.121 7.879a1 1 0 0 1 1.415-1.415l1.414 1.414a1 1 0 1 1-1.415 1.415L16.12 7.88Z"></path></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5 text-gray-900 dark:text-white" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
                  )}
                </Button>
              </div>
            </div>
            <div className="border border-[var(--primary)] text-foreground bg-transparent px-3 py-1 rounded-full text-sm font-medium">
              Credits: {Math.max(currentProfile.credits_find || 0, 0) + Math.max(currentProfile.credits_verify || 0, 0)}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8 md:pt-8 pb-24">
         {children}
        </main>
      </div>

      {/* Bottom Navigation */}
      <nav
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-xl border bg-white/90 dark:bg-[#121212]/95 backdrop-blur px-4 py-2 shadow-xl"
        aria-label="Primary"
      >
        <ul className="flex items-center gap-2 sm:gap-4">
          {[
            { href: '/home', label: 'Home', icon: 'home' },
            { href: '/find', label: 'Find Email', icon: 'search' },
            { href: '/bulk-finder', label: 'Bulk Find', icon: 'users' },
            { href: '/verify', label: 'Verify Email', icon: 'check' },
            { href: '/api-calls', label: 'API', icon: 'code' },
            { href: '/user', label: 'Account', icon: 'user' },
          ].map((item) => {
            const isAccount = item.icon === 'user'
            const active = isAccount
              ? (pathname.startsWith('/user') || pathname.startsWith('/credits'))
              : pathname.startsWith(item.href)
            return (
              <li key={item.href} className={isAccount ? 'relative group' : ''}>
                {isAccount ? (
                  <>
                    <div
                      className={`group relative flex flex-col items-center justify-center rounded-[10px] px-3 sm:px-4 py-2 transition-all duration-200 ease-out motion-reduce:transition-none hover:scale-[1.03] active:scale-[0.98] ${
                        active
                          ? 'text-[var(--primary)]'
                          : 'text-[#5a4042] dark:text-[#e2bebf] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {active && <span aria-hidden className="absolute -top-0.5 h-[2px] w-6 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />}
                      <span className={`h-5 w-5 transition-transform duration-200 ${active ? 'text-[var(--primary)]' : 'text-gray-400 dark:text-gray-400'} group-hover:scale-105`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"/></svg>
                      </span>
                      <span className="mt-1 text-xs">Account</span>
                    </div>
                    {/* Invisible hover bridge to maintain hover across the gap */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+0px)] h-3 w-48 hidden group-hover:block bg-transparent z-[59]" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+12px)] hidden group-hover:block z-[60] w-48 rounded-xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-[#121212]/95 shadow-lg backdrop-blur-sm p-1 space-y-1">
                      <Link href="/credits" className="block rounded-md px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50">
                        Credits & Billing
                      </Link>
                      <Link href="/user" className="block rounded-md px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50">
                        Settings
                      </Link>
                    </div>
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={`group relative flex flex-col items-center justify-center rounded-[10px] px-3 sm:px-4 py-2 transition-all duration-200 ease-out motion-reduce:transition-none hover:scale-[1.03] active:scale-[0.98] ${
                      active
                        ? 'text-[var(--primary)]'
                        : 'text-[#5a4042] dark:text-[#e2bebf] hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    {active && <span aria-hidden className="absolute -top-0.5 h-[2px] w-6 rounded-full" style={{ backgroundColor: 'var(--primary)' }} />}
                    <span className={`h-5 w-5 transition-transform duration-200 ${active ? 'text-[var(--primary)]' : 'text-gray-500 dark:text-gray-300'} group-hover:scale-105`}>
                      {item.icon === 'home' && (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                      )}
                      {item.icon === 'search' && (
                        <Search className="h-5 w-5" />
                      )}
                      {item.icon === 'check' && (
                        <CheckCircle className="h-5 w-5" />
                      )}
                      {item.icon === 'users' && (
                        <Users className="h-5 w-5" />
                      )}
                      {item.icon === 'code' && (
                        <Code2 className="h-5 w-5" />
                      )}
                    </span>
                    <span className="mt-1 text-xs">{item.label}</span>
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
