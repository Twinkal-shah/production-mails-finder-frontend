'use client'

import { useQuery } from '@tanstack/react-query'
import { getTransactionHistory } from '@/app/(dashboard)/credits/actions'
import { useEffect, useState } from 'react'
import { getProfileDataClient } from '@/lib/profile'
import { apiGet } from '@/lib/api'

// Hook for user profile with credits - client-side version
export function useUserProfile() {
  return useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const p = await getProfileDataClient()
      let findCredits = 0
      let verifyCredits = 0
      try {
        const res = await apiGet<Record<string, unknown>>('/api/user/credits', { useProxy: true })
        if (res.ok && res.data) {
          const d = res.data as Record<string, unknown>
          findCredits = Math.max(Number(d['find'] ?? d['credits_find'] ?? 0), 0)
          verifyCredits = Math.max(Number(d['verify'] ?? d['credits_verify'] ?? 0), 0)
        }
      } catch {}
      // Backend now returns `available_credits` as the unified spendable
      // total. credits_find and credits_verify both equal that same value,
      // so summing them double-counts. Prefer available_credits; fall back
      // to the larger of the two legacy values, NOT the sum.
      const availableCredits =
        typeof p?.available_credits === 'number'
          ? p.available_credits
          : Math.max(findCredits, verifyCredits)

      if (p) {
        return {
          id: p.id,
          email: p.email || '',
          full_name: (p.full_name as string) || 'User',
          plan: (p.plan as string) || 'free',
          available_credits: availableCredits,
          // Legacy credit fields — still used by navbar / dropdown / credits page.
          credits_find: Math.max(findCredits, 0),
          credits_verify: Math.max(verifyCredits, 0),
          total_credits: availableCredits,
          // New backend fields — exposed for future consumers, no UI wired yet.
          billing_cycle: p.billing_cycle,
          subscription_status: p.subscription_status,
          balances: p.balances,
          caps: p.caps,
          credits: typeof p.credits === 'number' ? p.credits : undefined,
        }
      }
      return {
        id: 'guest',
        email: 'Please log in',
        full_name: 'Guest User',
        plan: 'free',
        available_credits: 0,
        credits_find: 0,
        credits_verify: 0,
        total_credits: 0,
        billing_cycle: undefined,
        subscription_status: undefined,
        balances: undefined,
        caps: undefined,
        credits: undefined,
      }
    },
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  })
}

// Hook for transaction history
export function useTransactionHistory(limit: number = 10) {
  return useQuery({
    queryKey: ['transactionHistory', limit],
    queryFn: () => getTransactionHistory(),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 3 * 60 * 1000, // 3 minutes
    retry: 2,
  })
}

// Hook for credit usage history
export function useCreditUsageHistory() {
  return useQuery({
    queryKey: ['creditUsageHistory'],
    queryFn: async () => {
      const res = await apiGet<unknown>('/api/credit-usage/daily', { useProxy: true })
      const d = res.ok ? res.data : null
      if (Array.isArray(d)) return d as Array<{ date: string; totalCreditsUsed: number }>
      if (d && typeof d === 'object' && Array.isArray((d as Record<string, unknown>)['data'] as unknown[])) {
        return (d as Record<string, unknown>)['data'] as Array<{ date: string; totalCreditsUsed: number }>
      }
      return []
    },
    staleTime: 30 * 1000, // 30 seconds for more real-time updates
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    refetchInterval: 60 * 1000, // Auto-refetch every minute for real-time updates
    refetchIntervalInBackground: true, // Continue refetching even when tab is not active
  })
}

// Combined hook for all credits data
export function useCreditsData() {
  const profileQuery = useUserProfile()
  const transactionsQuery = useTransactionHistory()
  const usageQuery = useCreditUsageHistory()

  return {
    profile: profileQuery.data,
    transactions: transactionsQuery.data || [],
    creditUsage: usageQuery.data || [],
    isLoading: profileQuery.isLoading || transactionsQuery.isLoading || usageQuery.isLoading,
    isError: profileQuery.isError || transactionsQuery.isError || usageQuery.isError,
    error: profileQuery.error || transactionsQuery.error || usageQuery.error,
    refetch: () => {
      profileQuery.refetch()
      transactionsQuery.refetch()
      usageQuery.refetch()
    }
  }
}
