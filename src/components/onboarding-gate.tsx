'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isOnboardingCompleted } from '@/lib/onboarding'

/**
 * Sends first-time free-plan users to the setup wizard at /onboarding.
 * Uses the same trigger the previous tour modal did (free plan + no
 * completion flag for this email); renders nothing itself.
 */
export function OnboardingGate({ userProfile }: { userProfile: { email: string; plan: string } }) {
  const router = useRouter()

  useEffect(() => {
    if (!userProfile.email || userProfile.plan !== 'free') return
    if (isOnboardingCompleted(userProfile.email)) return
    router.replace('/onboarding')
  }, [userProfile.email, userProfile.plan, router])

  return null
}
