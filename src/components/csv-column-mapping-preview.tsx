'use client'

import { AlertTriangle, CheckCircle2, Columns3 } from 'lucide-react'
import {
  FIELD_LABELS,
  previewFields,
  requiredFields,
  type ColumnDetectionResult,
  type DetectableField,
} from '@/lib/csv-column-detection'
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
  className,
}: {
  detection: ColumnDetectionResult
  className?: string
}) {
  const required = requiredFields(detection.mode)
  const fields = previewFields(detection.mode)
  const ambiguousFields = new Set<DetectableField>(detection.ambiguous.map(a => a.field))

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

      {detection.missing.length > 0 && (
        <div className="flex items-start gap-2 border-t border-red-300 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-800 dark:bg-red-950/20 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">
            Missing required column{detection.missing.length === 1 ? '' : 's'}:{' '}
            <span className="font-semibold">
              {detection.missing.map(f => FIELD_LABELS[f]).join(', ')}
            </span>
            . Add {detection.missing.length === 1 ? 'it' : 'them'} to your file and upload again —
            processing will not start until{' '}
            {detection.missing.length === 1 ? 'it is' : 'they are'} found.
            {detection.mode === 'find' &&
              (detection.missing.includes('firstName') || detection.missing.includes('lastName')) && (
                <> A single Full Name column works too — it is split automatically.</>
              )}
          </span>
        </div>
      )}

      {detection.ambiguous.length > 0 && (
        <div className="flex items-start gap-2 border-t border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1 space-y-1">
            <p>We will not guess between equally matching columns:</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {detection.ambiguous.map(entry => (
                <li key={entry.field}>
                  <span className="font-semibold">{FIELD_LABELS[entry.field]}</span> matches{' '}
                  {entry.candidates.map(c => `"${c}"`).join(' and ')}. Rename or remove one and
                  upload again.
                </li>
              ))}
            </ul>
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
