'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Download, Loader2, RotateCcw, XCircle } from 'lucide-react'

/**
 * Live progress for an in-flight bulk run. Mirrors the two phases the existing
 * poll loop already reports: indeterminate (SMTP warm-up) then determinate.
 */
export function VerifyProgressCard({
  statusText,
  progress,
  isIndeterminate,
  processedCount,
  totalCount,
  duplicateInfo,
}: {
  statusText: string
  progress: number
  isIndeterminate: boolean
  processedCount: number
  totalCount: number
  duplicateInfo: string
}) {
  return (
    <Card className="animate-fade-slide-in shadow-sm">
      <CardContent>
        <div className="space-y-4" role="status" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[var(--primary)]" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-foreground">
                  {statusText || 'Verifying emails...'}
                </p>
                <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                  {processedCount.toLocaleString()} / {totalCount.toLocaleString()} emails
                  {duplicateInfo ? ` · ${duplicateInfo}` : ''}
                </p>
              </div>
            </div>
            {!isIndeterminate && (
              <span className="shrink-0 text-2xl font-bold tabular-nums text-[var(--primary)]">
                {Math.round(progress)}%
              </span>
            )}
          </div>

          {isIndeterminate ? (
            <Progress indeterminate className="h-2.5 w-full" />
          ) : (
            <Progress value={progress} className="h-2.5 w-full" />
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            SMTP checks can take a few minutes on large lists. You can leave this page — the job
            keeps running and will show up in your history.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function VerifyFailedCard({
  errorMessage,
  canDownloadPartial,
  onRetry,
  onDownloadPartial,
}: {
  errorMessage?: string
  canDownloadPartial: boolean
  onRetry: () => void
  onDownloadPartial: () => void
}) {
  return (
    <Card className="animate-fade-slide-in border-l-4 border-l-red-500 shadow-sm">
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">Verification failed</p>
              {errorMessage && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {errorMessage}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {canDownloadPartial && (
              <Button variant="outline" onClick={onDownloadPartial}>
                <Download className="mr-2 h-4 w-4" />
                Download partial
              </Button>
            )}
            <Button onClick={onRetry}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
