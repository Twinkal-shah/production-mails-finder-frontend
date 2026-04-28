'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useActiveJobs, useJobPolling } from '@/hooks/useActiveJobs'
import { useDownloadCSV } from '@/hooks/useJobHistory'
import { Download, Loader2, CheckCircle, XCircle } from 'lucide-react'

function ActiveJobCard({ jobId }: { jobId: string }) {
  const { data: job, isLoading } = useJobPolling(jobId)
  const downloadCSV = useDownloadCSV()

  if (isLoading || !job) {
    return (
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm text-muted-foreground">Loading job status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const pct = job.progress.total > 0
    ? Math.round((job.progress.processed / job.progress.total) * 100)
    : 0
  const typeLabel = job.type === 'bulk_find' ? 'Bulk Find' : 'Bulk Verify'

  if (job.status === 'completed') {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">{typeLabel} completed</p>
                <p className="text-xs text-muted-foreground">
                  {job.progress.total} rows processed
                  {job.credits_charged ? ` · ${job.credits_charged} credits` : ''}
                </p>
              </div>
            </div>
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
              <span className="ml-1.5">Download CSV</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (job.status === 'failed') {
    return (
      <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-medium">{typeLabel} failed</p>
              <p className="text-xs text-destructive">{job.error || 'Unknown error'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Processing
  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <div>
              <p className="text-sm font-medium">{typeLabel} in progress</p>
              <p className="text-xs text-muted-foreground">
                {job.progress.processed} / {job.progress.total} processed
              </p>
            </div>
          </div>
          <Badge variant="secondary">{pct}%</Badge>
        </div>
        <Progress value={pct} className="h-2" />
      </CardContent>
    </Card>
  )
}

export function ActiveJobsBanner() {
  const { activeJobs, isLoading } = useActiveJobs()

  if (isLoading || activeJobs.length === 0) return null

  return (
    <div className="space-y-3">
      {activeJobs.map((job) => (
        <ActiveJobCard key={job.job_id} jobId={job.job_id} />
      ))}
    </div>
  )
}
