'use client'

import { useState, type RefObject } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  Play,
  UploadCloud,
  Users,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BatchPreview {
  /** Rows parsed out of the file. */
  total: number
  /** Unique, syntactically valid addresses — what actually gets submitted. */
  unique: number
  /** Duplicates dropped during de-duplication. */
  duplicates: number
  /** Rows whose address failed the basic syntax check. */
  invalid: number
}

function SummaryStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div title={hint} className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate text-base font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

export function BulkUploadPanel({
  fileInputRef,
  onFileInputChange,
  onFileDropped,
  fileName,
  batch,
  columnCount,
  creditBalance,
  isProcessing,
  hasFile,
  onStart,
  onClear,
  className,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onFileDropped: (file: File) => void
  fileName: string
  batch: BatchPreview
  columnCount: number
  creditBalance?: number
  isProcessing: boolean
  hasFile: boolean
  onStart: () => void
  onClear: () => void
  className?: string
}) {
  const [isDragging, setIsDragging] = useState(false)

  const openFilePicker = () => fileInputRef.current?.click()

  const estimated = batch.unique
  const lowBalance =
    typeof creditBalance === 'number' && estimated > 0 && creditBalance < estimated

  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-[var(--primary)] dark:bg-white/5">
            <Users className="h-4 w-4" />
          </span>
          Verify your list
        </CardTitle>
        <CardDescription>
          Upload a CSV or Excel file with an <span className="font-medium text-foreground">Email</span> column.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Hidden native input — owned by the page, unchanged behaviour */}
        <Label htmlFor="file-upload" className="sr-only">
          Choose file
        </Label>
        <Input
          id="file-upload"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={onFileInputChange}
          ref={fileInputRef}
          className="hidden"
        />

        {!hasFile ? (
          /* ---------------- Dropzone ---------------- */
          <div
            role="button"
            tabIndex={isProcessing ? -1 : 0}
            aria-disabled={isProcessing}
            aria-label="Upload a CSV or Excel file"
            onClick={() => {
              if (!isProcessing) openFilePicker()
            }}
            onKeyDown={(e) => {
              if (isProcessing) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openFilePicker()
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!isProcessing) setIsDragging(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!isProcessing) setIsDragging(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDragging(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setIsDragging(false)
              if (isProcessing) return
              const file = e.dataTransfer?.files?.[0]
              if (file) onFileDropped(file)
            }}
            className={cn(
              'group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:py-14',
              isDragging
                ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                : 'hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/[0.03]',
              isProcessing && 'pointer-events-none opacity-60'
            )}
          >
            <span
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/60 text-[var(--primary)] transition-transform duration-200 dark:bg-white/5',
                isDragging ? 'scale-105' : 'group-hover:scale-105'
              )}
            >
              <UploadCloud className="h-6 w-6" />
            </span>
            <p className="mt-4 text-base font-semibold text-foreground">
              Drop your CSV or Excel file here
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or{' '}
              <span className="font-semibold text-[var(--primary)] underline underline-offset-4">
                browse your computer
              </span>
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Supports .csv, .xlsx and .xls · must include an &quot;Email&quot; column
            </p>
          </div>
        ) : (
          /* ---------------- File summary ---------------- */
          <div className="animate-fade-slide-in overflow-hidden rounded-xl border border-border">
            <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 dark:bg-white/[0.03]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-[var(--primary)] dark:bg-white/5">
                <FileSpreadsheet className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground" title={fileName}>
                  {fileName || 'Uploaded file'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {batch.total.toLocaleString()} row{batch.total === 1 ? '' : 's'} ·{' '}
                  {columnCount.toLocaleString()} column{columnCount === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClear}
                disabled={isProcessing}
                aria-label="Remove file"
                title="Remove file"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-4">
              <SummaryStat
                label="Unique emails"
                value={batch.unique.toLocaleString()}
                hint="Duplicates and malformed addresses are removed before submitting."
              />
              <SummaryStat label="Duplicates" value={batch.duplicates.toLocaleString()} />
              <SummaryStat
                label="Est. credits"
                value={`up to ${estimated.toLocaleString()}`}
                hint="Risky and unknown results are not billed, so the final charge may be lower."
              />
              <SummaryStat
                label="Your balance"
                value={
                  typeof creditBalance === 'number' ? creditBalance.toLocaleString() : '--'
                }
              />
            </div>

            {batch.invalid > 0 && (
              <p className="px-4 pb-3 text-xs text-muted-foreground">
                {batch.invalid.toLocaleString()} row{batch.invalid === 1 ? '' : 's'} had no valid
                email address and will be marked invalid.
              </p>
            )}

            {lowBalance && (
              <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex-1">
                  This list may cost more credits than you have.{' '}
                  <Link href="/credits" className="font-semibold underline underline-offset-2">
                    Buy credits
                  </Link>
                </span>
              </div>
            )}

            <div className="border-t border-border px-4 py-4">
              <Button
                size="lg"
                onClick={onStart}
                disabled={isProcessing || batch.total === 0}
                className="w-full sm:w-auto"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start verification
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
