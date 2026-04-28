'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { apiGet, apiDelete } from '@/lib/api'
import type { RecentFindResult, RecentVerifyResult } from '@/types/jobs'

function parseResultsResponse<T>(data: unknown): T[] {
  if (!data) return []
  const root = data as Record<string, unknown>
  const arr = Array.isArray(root.data) ? root.data : Array.isArray(data) ? (data as unknown[]) : []
  return arr as T[]
}

export function useRecentFindResults() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['email', 'recent-results', 'find'],
    queryFn: async () => {
      const res = await apiGet<unknown>('/api/email/recent-results?type=find&limit=10', { useProxy: true })
      if (!res.ok) return []
      return parseResultsResponse<RecentFindResult>(res.data)
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  const addResult = (result: RecentFindResult) => {
    queryClient.setQueryData<RecentFindResult[]>(
      ['email', 'recent-results', 'find'],
      (old = []) => [result, ...old].slice(0, 10)
    )
  }

  return { ...query, addResult }
}

export function useRecentVerifyResults() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['email', 'recent-results', 'verify'],
    queryFn: async () => {
      const res = await apiGet<unknown>('/api/email/recent-results?type=verify&limit=10', { useProxy: true })
      if (!res.ok) return []
      return parseResultsResponse<RecentVerifyResult>(res.data)
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  const addResult = (result: RecentVerifyResult) => {
    queryClient.setQueryData<RecentVerifyResult[]>(
      ['email', 'recent-results', 'verify'],
      (old = []) => [result, ...old].slice(0, 10)
    )
  }

  return { ...query, addResult }
}

export function useClearRecentResults(type: 'find' | 'verify') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await apiDelete(`/api/email/recent-results?type=${type}`, { useProxy: true })
      if (!res.ok) throw new Error('Failed to clear history')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'recent-results', type] })
    },
  })
}
