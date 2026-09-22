'use client'

/**
 * Onboarding state helpers.
 *
 * Completion is tracked with the same per-email localStorage flag the
 * previous tour modal used (`onboardingCompleted:<email>`), so users who
 * already finished the old tour are not sent through the wizard again.
 */

export interface OnboardingAnswers {
  companyName: string
  companySize: string | null
  role: string | null
  needs: string[]
  volume: string | null
  lifetimeDealInterest: 'yes' | 'no' | null
  source: string | null
  sandboxVerified: boolean
  skipped: boolean
  completedAt: string
}

const completedKey = (email: string) => `onboardingCompleted:${email}`
const answersKey = (email: string) => `onboardingAnswers:${email}`

export function isOnboardingCompleted(email: string): boolean {
  try {
    return localStorage.getItem(completedKey(email)) === 'true'
  } catch {
    return false
  }
}

export function markOnboardingCompleted(email: string) {
  try {
    if (email) localStorage.setItem(completedKey(email), 'true')
  } catch {}
}

export function saveOnboardingAnswers(email: string, answers: OnboardingAnswers) {
  try {
    if (email) localStorage.setItem(answersKey(email), JSON.stringify(answers))
  } catch {}
}

/**
 * Persist the wizard answers to the user's account.
 *
 * localStorage only survives on one browser, so the answers are also stored
 * server-side where they can actually be read later. Best-effort: onboarding
 * must never trap a user because a save failed, so this resolves false rather
 * than throwing.
 */
export async function persistOnboardingAnswers(answers: OnboardingAnswers): Promise<boolean> {
  try {
    const res = await fetch('/api/user/profile/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(answers),
    })
    return res.ok
  } catch {
    return false
  }
}
