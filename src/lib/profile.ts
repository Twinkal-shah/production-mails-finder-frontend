import { apiGet } from '@/lib/api'

// New plan taxonomy returned by the backend. Kept as a broad `string` on the
// Profile type below so older/unknown values don't break the UI, but this
// alias documents the canonical set.
export type PlanName = 'free' | 'monthly' | 'lifetime' | 'payg'
export type BillingCycle = 'none' | 'monthly' | 'annual'
export type SubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'past_due'
  | 'expired'
  | 'on_trial'
  | 'paused'
  | 'unpaid'
  | string

export type BucketBalance = {
  balance?: number
  pool?: number
  daily_used?: number
  daily_cap?: number
  resets_at?: string | null
  cycle_end_date?: string | null
}

export type ProfileBalances = {
  monthly?: BucketBalance
  lifetime?: BucketBalance
  payg?: BucketBalance
  free?: BucketBalance
}

export type ProfileCaps = {
  enrichment_monthly_cap?: number
  enrichment_used?: number
  signals_monthly_cap?: number
  signals_used?: number
  database_export_30d_cap?: number
}

export type Profile = {
  id: string
  full_name?: string
  email?: string
  company?: string | null
  plan?: string | null
  plan_expiry?: string | null
  // --- New fields from the updated backend (all optional, read-through) ---
  billing_cycle?: BillingCycle
  subscription_status?: SubscriptionStatus
  balances?: ProfileBalances
  caps?: ProfileCaps
  // Unified spendable total — derived from the four buckets by the backend.
  // Use this instead of summing credits_find + credits_verify (those are now
  // both equal to this value, and summing them double-counts).
  available_credits?: number
  // --- Legacy fields — still populated by the backend and still read by
  // existing UI (navbar badge, user dropdown, credits page). Keep them. ---
  credits?: number
  credits_find?: number
  credits_verify?: number
  lemonsqueezy_customer_id?: string | null
}

export async function getProfileData(): Promise<Profile | null> {
  const res = await apiGet<Record<string, unknown>>('/api/user/profile/getProfile', { useProxy: true })
  if (!res.ok || !res.data) return null
  const d = res.data as Record<string, unknown>
  const profile = (d && typeof d === 'object' && 'data' in d ? (d.data as Profile) : (d as unknown as Profile))
  return profile || null
}

export async function getProfileDataClient(): Promise<Profile | null> {
  try {
    const res = await apiGet<Record<string, unknown>>('/api/user/profile/getProfile', { useProxy: true })
    if (!res.ok || !res.data) return null
    const d = res.data as Record<string, unknown>
    const profile = (d && typeof d === 'object' && 'data' in d ? (d.data as Profile) : (d as unknown as Profile))
    return profile || null
  } catch {
    return null
  }
}

