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
