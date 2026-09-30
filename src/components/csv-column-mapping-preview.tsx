'use client'

import { AlertTriangle, CheckCircle2, Columns3 } from 'lucide-react'
import {
  FIELD_LABELS,
  previewFields,
  requiredFields,
  type ColumnDetectionResult,
  type DetectableField,
} from '@/lib/csv-column-detection'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Shows which uploaded column was matched to each field the flow needs, before
 * any processing starts. Shared by bulk Verification and bulk Finder so both
 * report detection the same way.
 *
 * When a required field is missing or ambiguous the caller is expected to keep
 * the run disabled; this component only explains why.
 */
export function CsvColumnMappingPreview({
  detection,
  onUploadAnother,
  className,
}: {
  detection: ColumnDetectionResult
  /** Reopens the file picker from the error section. Omit to hide the button. */
  onUploadAnother?: () => void
  className?: string
}) {
  const required = requiredFields(detection.mode)
  const fields = previewFields(detection.mode)
  const ambiguousFields = new Set<DetectableField>(detection.ambiguous.map(a => a.field))
  const hasError = detection.missing.length > 0 || detection.ambiguous.length > 0

  return (
    <div className={cn('rounded-xl border border-border overflow-hidden', className)}>
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 dark:bg-white/[0.03]">
        <Columns3 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Detected columns</p>
        {detection.ok ? (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ready
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Action needed
          </span>
        )}
      </div>

      <dl className="divide-y divide-border">
        {fields.map(field => {
          const detected = detection.mapping[field]
          const isRequired = required.includes(field)
          const isAmbiguous = ambiguousFields.has(field)

          // Optional field with nothing matched: not worth a row.
          if (!detected && !isRequired && !isAmbiguous) return null

          return (
            <div key={field} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2.5">
              <dt className="text-sm font-medium text-foreground">
                {FIELD_LABELS[field]}
                {!isRequired && (
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">optional</span>
                )}
              </dt>
              <span aria-hidden="true" className="text-muted-foreground">
                →
              </span>
              <dd className="min-w-0 flex-1 text-sm">
                {detected ? (
                  <span className="font-mono-code break-all text-foreground">{detected.header}</span>
                ) : isAmbiguous ? (
                  <span className="font-medium text-red-700 dark:text-red-400">ambiguous</span>
                ) : isRequired ? (
                  <span className="font-medium text-red-700 dark:text-red-400">not found</span>
                ) : (
                  <span className="text-muted-foreground">not found</span>
                )}
                {detected?.source === 'split-from-full-name' && (
                  <span className="ml-2 text-xs text-muted-foreground">(split from full name)</span>
                )}
                {detected && detected.alternates.length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    also saw {detected.alternates.join(', ')}
                  </span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>

      {hasError && (
        <div className="border-t border-red-300 bg-red-50 px-4 py-4 dark:border-red-800 dark:bg-red-950/20">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            >
              <AlertTriangle className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1 space-y-2.5">
              <p className="text-sm font-bold text-red-900 dark:text-red-100">
                We couldn&apos;t find the required columns
              </p>

              <p className="text-[13px] leading-relaxed text-red-800 dark:text-red-200">
                Your CSV is missing some required information. Please check your column names
                and upload the file again.
              </p>

              {detection.missing.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-red-900 dark:text-red-100">
                    Missing:
                  </span>
                  {detection.missing.map(field => (
                    <span
                      key={field}
                      className="rounded-md border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900 dark:border-red-800 dark:bg-red-900/40 dark:text-red-100"
                    >
                      {FIELD_LABELS[field]}
                    </span>
                  ))}
                </div>
              )}

              <MissingFieldHelp detection={detection} />

              {detection.ambiguous.length > 0 && (
                <div className="space-y-1 text-[13px] leading-relaxed text-red-800 dark:text-red-200">
                  {detection.ambiguous.map(entry => (
                    <p key={entry.field}>
                      We found more than one column that could be{' '}
                      <span className="font-semibold">{FIELD_LABELS[entry.field]}</span>:{' '}
                      {entry.candidates.map(c => `"${c}"`).join(' and ')}. Please keep just one of
                      them and upload the file again.
                    </p>
                  ))}
                </div>
              )}

              {onUploadAnother && (
                <div className="pt-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onUploadAnother}
                    className="border-red-300 bg-white text-red-800 hover:bg-red-100 hover:text-red-900 dark:border-red-800 dark:bg-transparent dark:text-red-200 dark:hover:bg-red-900/30"
                  >
                    Upload a different CSV
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {detection.headers.length === 0 && (
        <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          No header row was found in this file.
        </div>
      )}
    </div>
  )
}

/**
 * Plain-language next step for each missing field. Wording only — which fields
 * are missing is decided by the detection module, not here.
 */
function MissingFieldHelp({ detection }: { detection: ColumnDetectionResult }) {
  const missing = detection.missing
  if (missing.length === 0) return null

  const needsFirst = missing.includes('firstName')
  const needsLast = missing.includes('lastName')
  const nameLabel = needsFirst && needsLast ? 'First Name and Last Name' : needsFirst ? 'First Name' : 'Last Name'

  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed text-red-800 dark:text-red-200">
      {detection.mode === 'verify' && missing.includes('email') && (
        <p>Please make sure your CSV has a column containing email addresses.</p>
      )}

      {detection.mode === 'find' && (needsFirst || needsLast) && (
        <p>
          Please add {needsFirst && needsLast ? '' : 'a '}
          <span className="font-semibold">{nameLabel}</span>{' '}
          {needsFirst && needsLast ? 'columns' : 'column'}, or use a single{' '}
          <span className="font-semibold">Full Name</span> column. We&apos;ll automatically split
          Full Name into First Name and Last Name.
        </p>
      )}

      {detection.mode === 'find' && missing.includes('domain') && (
        <p>
          Please add a <span className="font-semibold">Domain</span> column with each
          contact&apos;s company website, for example{' '}
          <span className="font-mono-code">acme.com</span>.
        </p>
      )}
    </div>
  )
}
