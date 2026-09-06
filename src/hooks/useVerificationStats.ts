'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'

export interface VerificationStats {
  /** Successful verifications since the start of today. */
  today: number
  /** Successful verifications over the last 30 days. */
  last30: number
}

/**
 * Verified-email counters for the dashboard.
 *
 * The backend owns the counting: it scopes to the authenticated user, counts
 * only successful verifications across single + bulk + API, and decides the
 * day/30-day boundary. This hook only reads the result.
 *
 * Returns `null` when the backend has no such endpoint yet (404) so the UI can
 * show an unavailable state instead of a misleading number. Several key
 * spellings are accepted so the hook keeps working whichever the backend uses.
 */
function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = source[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  }
  return null
}

export function useVerificationStats() {
  return useQuery<VerificationStats | null>({
    queryKey: ['email', 'verification-stats'],
    queryFn: async () => {
      const res = await apiGet<unknown>('/api/email/verification-stats', { useProxy: true })
      if (!res.ok || !res.data) return null

      const root = res.data as Record<string, unknown>
      const body =
        root.data && typeof root.data === 'object'
          ? (root.data as Record<string, unknown>)
          : root

      const today = pickNumber(body, ['today', 'verified_today', 'verifiedToday'])
      const last30 = pickNumber(body, [
        'last_30_days',
        'last30Days',
        'last30',
        'verified_last_30_days',
        'thirty_days',
      ])

      if (today === null && last30 === null) return null
      return { today: today ?? 0, last30: last30 ?? 0 }
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  })
}
