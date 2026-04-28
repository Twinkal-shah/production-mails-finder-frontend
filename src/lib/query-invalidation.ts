'use client'

import { useQueryClient } from '@tanstack/react-query'

// Hook to get query invalidation functions
export function useQueryInvalidation() {
  const queryClient = useQueryClient()

  const invalidateCreditsData = () => {
    // Invalidate all credit-related queries for immediate updates
    queryClient.invalidateQueries({ queryKey: ['userProfile'] })
    queryClient.invalidateQueries({ queryKey: ['creditUsageHistory'] })
    queryClient.invalidateQueries({ queryKey: ['transactionHistory'] })
  }

  const invalidateUserProfile = () => {
    queryClient.invalidateQueries({ queryKey: ['userProfile'] })
  }

  const invalidateCreditUsage = () => {
    queryClient.invalidateQueries({ queryKey: ['creditUsageHistory'] })
  }

  const invalidateJobHistory = () => {
    queryClient.invalidateQueries({ queryKey: ['email', 'jobs'] })
  }

  const invalidateActiveJobs = () => {
    queryClient.invalidateQueries({ queryKey: ['email', 'jobs', 'active'] })
  }

  const invalidateRecentResults = (type?: 'find' | 'verify') => {
    if (type) {
      queryClient.invalidateQueries({ queryKey: ['email', 'recent-results', type] })
    } else {
      queryClient.invalidateQueries({ queryKey: ['email', 'recent-results'] })
    }
  }

  return {
    invalidateCreditsData,
    invalidateUserProfile,
    invalidateCreditUsage,
    invalidateJobHistory,
    invalidateActiveJobs,
    invalidateRecentResults,
  }
}

// Utility function to invalidate queries from server actions
export function invalidateCreditsQueries() {
  // This will be used in server actions to trigger client-side invalidation
  // The actual invalidation will happen on the client side when the component re-renders
  return {
    shouldInvalidate: true,
    timestamp: Date.now()
  }
}