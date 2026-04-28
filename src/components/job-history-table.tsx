'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useJobHistory, useDownloadCSV, useDeleteJob } from '@/hooks/useJobHistory'
import { useQueryClient } from '@tanstack/react-query'
import { Download, RefreshCw, Loader2, FileText, AlertCircle, Trash2 } from 'lucide-react'
import type { JobHistoryItem } from '@/types/jobs'

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

function StatusCell({ job }: { job: JobHistoryItem }) {
  if (job.status === 'processing') {
    const pct = job.progress.total > 0
      ? Math.round((job.progress.processed / job.progress.total) * 100)
      : 0
    return (
      <div className="flex items-center gap-2 min-w-[120px]">
        <Progress value={pct} className="h-2 flex-1" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">{pct}%</span>
      </div>
    )
  }
  if (job.status === 'completed') {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">Completed</Badge>
  }
  return <Badge variant="destructive">Failed</Badge>
}

function ActionCell({ job }: { job: JobHistoryItem }) {
  const downloadCSV = useDownloadCSV()
  const deleteJob = useDeleteJob()

  return (
    <div className="flex items-center gap-1.5">
      {job.status === 'completed' && (
        <Button
          size="sm"
          variant="outline"
          disabled={downloadCSV.isPending}
          onClick={() => downloadCSV.mutate({ jobId: job.job_id, jobType: job.type })}
        >
          {downloadCSV.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5 hidden sm:inline">CSV</span>
        </Button>
      )}
      {job.status === 'failed' && job.error && (
        <span className="text-xs text-destructive flex items-center gap-1 mr-1" title={job.error}>
          <AlertCircle className="h-3.5 w-3.5" />
        </span>
      )}
      {job.status !== 'processing' && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          disabled={deleteJob.isPending}
          onClick={() => deleteJob.mutate(job.job_id)}
        >
          {deleteJob.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  )
}

export function JobHistoryTable() {
  const { data: jobs, isLoading, isError } = useJobHistory()
  const queryClient = useQueryClient()

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading job history...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isError || !jobs) {
    return null
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No jobs found. Run a bulk find or verify to see your history here.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5" />
          Job History
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['email', 'jobs'] })}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {/* Header */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_80px_120px_80px_100px_120px] gap-3 px-3 pb-2 text-xs font-medium text-muted-foreground border-b">
          <span>Type</span>
          <span>Rows</span>
          <span>Status</span>
          <span>Credits</span>
          <span>Date</span>
          <span>Action</span>
        </div>
        {/* Rows */}
        <div className="divide-y">
          {jobs.map((job) => (
            <div
              key={job.job_id}
              className="grid grid-cols-2 sm:grid-cols-[1fr_80px_120px_80px_100px_120px] gap-3 px-3 py-3 items-center text-sm"
            >
              <span className="font-medium">
                {job.type === 'bulk_find' ? 'Bulk Find' : 'Bulk Verify'}
              </span>
              <span className="text-muted-foreground">{job.progress.total}</span>
              <StatusCell job={job} />
              <span className="text-muted-foreground">
                {job.status === 'completed' ? job.credits_charged : '--'}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatRelativeDate(job.created_at)}
              </span>
              <ActionCell job={job} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
