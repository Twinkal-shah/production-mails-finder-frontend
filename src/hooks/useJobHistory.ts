'use client'

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { apiGet, apiDelete } from '@/lib/api'
import { toast } from 'sonner'
import type { JobHistoryItem } from '@/types/jobs'

function parseJobsResponse(data: unknown): JobHistoryItem[] {
  if (!data) return []
  const root = data as Record<string, unknown>
  const arr = Array.isArray(root.data) ? root.data : Array.isArray(data) ? (data as unknown[]) : []
  return arr as JobHistoryItem[]
}

export function useJobHistory(limit = 50) {
  return useQuery({
    queryKey: ['email', 'jobs', limit],
    queryFn: async () => {
      const res = await apiGet<unknown>(`/api/email/jobs?limit=${limit}`, { useProxy: true })
      if (!res.ok) throw new Error('Failed to fetch job history')
      return parseJobsResponse(res.data)
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useDownloadCSV() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ jobId, jobType }: { jobId: string; jobType: string }) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      const response = await fetch(`/api/email/job/${encodeURIComponent(jobId)}/download`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = jobType === 'bulk_find' ? 'bulk-find-results.csv' : 'bulk-verify-results.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'jobs'] })
    },
  })
}

export function useDeleteJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiDelete(`/api/email/job/${encodeURIComponent(jobId)}`, { useProxy: true })
      if (!res.ok) throw new Error('Failed to delete job')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email', 'jobs'] })
      toast.success('Job deleted')
    },
    onError: () => {
      toast.error('Failed to delete job')
    },
  })
}
