'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { apiGet } from '@/lib/api'
import { toast } from 'sonner'
import type { JobHistoryItem, JobDetail } from '@/types/jobs'

const LS_KEY = 'mailsfinder_active_jobs'

function getLocalActiveJobs(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveActiveJob(jobId: string) {
  try {
    const current = getLocalActiveJobs()
    if (!current.includes(jobId)) {
      localStorage.setItem(LS_KEY, JSON.stringify([...current, jobId]))
    }
  } catch {}
}

export function removeActiveJob(jobId: string) {
  try {
    const current = getLocalActiveJobs()
    localStorage.setItem(LS_KEY, JSON.stringify(current.filter(id => id !== jobId)))
  } catch {}
}

function parseActiveResponse(data: unknown): JobHistoryItem[] {
  if (!data) return []
  const root = data as Record<string, unknown>
  const arr = Array.isArray(root.data) ? root.data : Array.isArray(data) ? (data as unknown[]) : []
  return arr as JobHistoryItem[]
}

export function useActiveJobs() {
  const queryClient = useQueryClient()
  const completedRef = useRef(new Set<string>())

  const activeQuery = useQuery({
    queryKey: ['email', 'jobs', 'active'],
    queryFn: async () => {
      const res = await apiGet<unknown>('/api/email/jobs/active', { useProxy: true })
      if (!res.ok) return []
      return parseActiveResponse(res.data)
    },
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: true,
  })

  const activeJobIds = (activeQuery.data || []).map(j => j.job_id)

  // Clean up localStorage to match API truth
  useEffect(() => {
    if (activeQuery.data) {
      const apiIds = new Set(activeQuery.data.map(j => j.job_id))
      const localIds = getLocalActiveJobs()
      const stillActive = localIds.filter(id => apiIds.has(id))
      localStorage.setItem(LS_KEY, JSON.stringify(stillActive))
    }
  }, [activeQuery.data])

  return {
    activeJobs: activeQuery.data || [],
    activeJobIds,
    isLoading: activeQuery.isLoading,
    refetch: activeQuery.refetch,
  }
}

export function useJobPolling(jobId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery<JobDetail>({
    queryKey: ['email', 'job', jobId],
    queryFn: async () => {
      const res = await apiGet<unknown>(`/api/email/job/${encodeURIComponent(jobId!)}`, { useProxy: true })
      if (!res.ok) throw new Error('Failed to fetch job status')
      const root = res.data as Record<string, unknown>
      return (root.data ?? root) as JobDetail
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data && (data.status === 'completed' || data.status === 'failed')) return false
      return 5000
    },
    staleTime: 0,
  })

  // When job finishes, invalidate related queries and clean up
  useEffect(() => {
    if (!query.data || !jobId) return
    const { status } = query.data
    if (status === 'completed' || status === 'failed') {
      removeActiveJob(jobId)
      queryClient.invalidateQueries({ queryKey: ['email', 'jobs'] })
      queryClient.invalidateQueries({ queryKey: ['email', 'jobs', 'active'] })
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
      if (status === 'completed') {
        toast.success(`Bulk job completed successfully`)
      } else {
        toast.error(`Bulk job failed: ${query.data.error || 'Unknown error'}`)
      }
    }
  }, [query.data?.status, jobId, queryClient])

  return query
}
