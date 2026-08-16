'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, Download, FileText, XCircle } from 'lucide-react'
import type { BulkVerificationJob } from '../types'

function JobStatus({ status }: { status: BulkVerificationJob['status'] }) {
  if (status === 'completed') {
    return (
      <Badge className="border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
        Completed
      </Badge>
    )
  }
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>
  return <Badge variant="secondary">{status === 'processing' ? 'Processing' : 'Pending'}</Badge>
}

function JobIcon({ status }: { status: BulkVerificationJob['status'] }) {
  if (status === 'completed') {
    return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
  }
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
  return <Clock className="h-4 w-4 text-[var(--primary)]" />
}

export function VerifyJobHistory({
  jobs,
  onDownload,
}: {
  jobs: BulkVerificationJob[]
  onDownload: (job: BulkVerificationJob) => void
}) {
  if (jobs.length === 0) return null

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-[var(--primary)] dark:bg-white/5">
            <FileText className="h-4 w-4" />
          </span>
          Bulk verification jobs
        </CardTitle>
        <CardDescription>Your recent bulk verification jobs</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="divide-y divide-border">
          {jobs.map((job) => (
            <div
              key={job.jobId}
              className="flex flex-col gap-3 px-1 py-3.5 transition-colors hover:bg-muted/40 dark:hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0">
                  <JobIcon status={job.status} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {job.filename || `Job ${job.jobId}`}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    {(job.processedEmails || 0).toLocaleString()} / {job.totalEmails.toLocaleString()} emails
                    {job.createdAt ? ` · ${new Date(job.createdAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
                <JobStatus status={job.status} />
                {job.status === 'completed' && job.emailsData && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDownload(job)}
                    aria-label="Download job results"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="ml-1.5 hidden sm:inline">CSV</span>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
