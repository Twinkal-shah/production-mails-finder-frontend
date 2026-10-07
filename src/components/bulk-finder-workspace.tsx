'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Upload, Download, Play, CheckCircle, AlertTriangle, UploadCloud, FileText } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
// Job endpoints are not available; direct bulk find only
import { useQueryInvalidation } from '@/lib/query-invalidation'
import { buildBulkFindPayload } from '@/lib/bulk-find-utils'
import { ActiveJobsBanner } from '@/components/active-jobs-banner'
import { humanizeApiError } from '@/lib/api-error'
import { useJobPolling } from '@/hooks/useActiveJobs'
import {
  BackgroundJobRejected,
  clearStoredBackgroundJob,
  downloadCsvString,
  fetchBackgroundJobCsv,
  getStoredBackgroundJob,
  newIdempotencyKey,
  PAUSED_MESSAGE,
  readFinderResultCsv,
  startBackgroundBulkJob,
  storeBackgroundJob,
} from '@/lib/background-bulk'
import {
  detectColumns,
  readCell,
  readNameParts,
  type ColumnDetectionResult,
} from '@/lib/csv-column-detection'
import { CsvColumnMappingPreview } from '@/components/csv-column-mapping-preview'
import { BulkCreditsNotice } from '@/components/bulk-credits-notice'

interface CsvRow {
  'Full Name'?: string
  'Domain'?: string
  'Role'?: string
  [key: string]: unknown
}

const normalizeDomain = (value: string) => {
  let s = (value || '').trim()
  s = s.replace(/^`+|`+$/g, '')
  s = s.replace(/^"+|"+$/g, '')
  s = s.replace(/^'+|'+$/g, '')
  s = s.replace(/\s+/g, '')
  try {
    if (/^[a-zA-Z]+:\/\//.test(s)) {
      const u = new URL(s)
      s = u.hostname
    } else {
      s = s.replace(/[@,/|\\]+/g, '.')
      s = s.split('?')[0]
      s = s.split('#')[0]
    }
  } catch {}
  s = s.replace(/^www\./i, '')
  s = s.replace(/^[\s\.,;]+|[\s\.,;]+$/g, '')
  s = s.toLowerCase()
  s = s.replace(/[^a-z0-9\.\-]/g, '')
  s = s.replace(/\.+/g, '.')
  s = s.replace(/^\.+|\.+$/g, '')
  const isHostname = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(s)
  return isHostname ? s : ''
}

interface BulkRow extends CsvRow {
  id: string
  fullName: string
  domain: string
  role?: string
  email?: string
  confidence?: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  catch_all?: boolean
  user_name?: string
  mx?: string
  error?: string
  result_status?: string
  is_catch_all_domain?: boolean
  notice?: string
}

/**
 * Bulk find workspace.
 *
 * Extracted verbatim from the former /bulk-finder page so the same code can
 * render both as a standalone route and as the "Bulk File Upload (CSV)" tab
 * inside the Find Email page. Logic, API calls and state are unchanged;
 * `showHeader` only controls the page-level title block.
 */
export function BulkFinderWorkspace({ showHeader = true }: { showHeader?: boolean } = {}) {
  const [rows, setRows] = useState<BulkRow[]>([])
  const [originalFileName, setOriginalFileName] = useState<string | null>(null)
  const [originalFileNameWithExt, setOriginalFileNameWithExt] = useState<string | null>(null)
  const [originalColumnOrder, setOriginalColumnOrder] = useState<string[]>([])
  /** Column detection for the loaded file; null until a file is parsed. */
  const [detection, setDetection] = useState<ColumnDetectionResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { invalidateCreditsData, invalidateJobHistory } = useQueryInvalidation()
  const [isProcessingDirect, setIsProcessingDirect] = useState(false)
  const [progressDirect, setProgressDirect] = useState(0)
  const [processedDirectCount, setProcessedDirectCount] = useState(0)
  const [successDirectCount, setSuccessDirectCount] = useState(0)
  const [failedDirectCount, setFailedDirectCount] = useState(0)
  const [statusDirectText, setStatusDirectText] = useState('')
  const [isIndeterminate, setIsIndeterminate] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState('')
  const [creditsCharged, setCreditsCharged] = useState(0)
  const [catchAllCount, setCatchAllCount] = useState(0)
  const [catchAllNotice, setCatchAllNotice] = useState<string | null>(null)

  // Background job: the find runs server-side; this page only follows it.
  const [bgJobId, setBgJobId] = useState<string | null>(null)
  const [bgTotal, setBgTotal] = useState(0)
  /** The job's combined result CSV, exactly as the server built it. */
  const [resultCsv, setResultCsv] = useState<string | null>(null)
  const [notProcessedCount, setNotProcessedCount] = useState(0)
  /** Kept across a failed submit so a retry can never start a second job. */
  const submitKeyRef = useRef<string | null>(null)
  const { data: bgJob } = useJobPolling(bgJobId)

  // No job-based endpoints on backend; page runs direct bulk find only

  /**
   * Client-side sample CSV. Columns match what the shared column detection
   * accepts, so a downloaded template always imports cleanly. No network call.
   */
  const downloadSampleTemplate = () => {
    const csv = [
      'first_name,last_name,domain,role',
      'Marc,Benioff,salesforce.com,CEO',
      'Satya,Nadella,microsoft.com,',
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mailsfinder-bulk-find-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    processFile(file)
  }

  /**
   * Shared tail of the CSV and Excel parse paths.
   *
   * First Name, Last Name and Domain are detected from the header row; a
   * single Full Name column is split into first and last automatically. When a
   * required field cannot be resolved the headers are still recorded so the UI
   * can name what is missing, and no rows are loaded so nothing can start.
   *
   * `fullName` is still what each row carries, so `runDirectFind`,
   * `buildBulkFindPayload` and the export path are unaffected.
   */
  const applyParsedFile = (
    originalColumns: string[],
    parsedRows: CsvRow[],
    sourceLabel: 'CSV' | 'Excel'
  ) => {
    setOriginalColumnOrder(originalColumns)

    const detected = detectColumns(originalColumns, 'find')
    setDetection(detected)

    if (!detected.ok) {
      // Reported inline by CsvColumnMappingPreview, not as a corner toast.
      setRows([])
      return
    }

    const domainHeader = detected.mapping.domain?.header
    const roleHeader = detected.mapping.role?.header

    // Values are derived, then filtered, then spread — same order as before,
    // so a raw `domain` column in the file cannot slip past the hostname check.
    const newRows: BulkRow[] = parsedRows
      .map((row: CsvRow) => {
        const { first, last } = readNameParts(row, detected)
        return {
          row,
          fullName: `${first} ${last}`.trim(),
          domain: normalizeDomain(readCell(row, domainHeader)),
          role: readCell(row, roleHeader),
        }
      })
      .filter(entry => entry.fullName && entry.domain)
      .map(({ row, fullName, domain, role }, index: number) => ({
        id: `row-${Date.now()}-${index}`,
        fullName,
        domain,
        role,
        status: 'pending' as const,
        ...row
      }))

    setRows(newRows)
    setResultCsv(null)
    toast.success(`Loaded ${newRows.length} rows from ${sourceLabel}`)
  }

  /** Parses a chosen file. Shared by the file picker and the drop zone. */
  const processFile = (file: File) => {
    // Store the original filename (without extension for later use)
    const fileName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
    setOriginalFileName(fileName)
    setOriginalFileNameWithExt(file.name)
    setDetection(null)

    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          // Store original column order from CSV headers
          const originalColumns = results.meta?.fields || []
          applyParsedFile(originalColumns, results.data as CsvRow[], 'CSV')
        },
        error: (error) => {
          toast.error('Failed to parse CSV file')
          console.error(error)
        }
      })
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as CsvRow[]

          // Store original column order from Excel headers
          const originalColumns = jsonData.length > 0 ? Object.keys(jsonData[0] as object) : []
          applyParsedFile(originalColumns, jsonData, 'Excel')
        } catch (error) {
          toast.error('Failed to parse Excel file')
          console.error(error)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      toast.error('Please upload a CSV or Excel file')
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }



  // Removed job-based actions

  const runDirectFind = async () => {
    // Never start on a file whose required columns could not be resolved.
    // The reason is already on screen in the inline detection error.
    if (detection && !detection.ok) {
      return
    }
    const validRows = rows.filter(r => r.fullName && normalizeDomain(r.domain))
    if (validRows.length === 0) {
      toast.error('Please add at least one valid row with Full Name and Domain')
      return
    }
    setIsProcessingDirect(true)
    setProcessedDirectCount(0)
    setProgressDirect(0)
    setSuccessDirectCount(0)
    setFailedDirectCount(0)
    setStatusDirectText('')
    setIsIndeterminate(true)
    setDuplicateInfo('')
    setCreditsCharged(0)
    setCatchAllCount(0)
    setCatchAllNotice(null)
    setRows(prev => prev.map(r => ({ ...r, status: 'processing' })))
    try {

      let creditsFind = 0
      let creditsVerify = 0
      try {
        const localRes = await fetch('/api/user/credits', { method: 'GET' })
        if (localRes.ok) {
          const cd = await localRes.json()
          creditsFind = Number(cd?.credits_find ?? cd?.find ?? 0)
          creditsVerify = Number(cd?.credits_verify ?? cd?.verify ?? 0)
        }
      } catch {}
      if ((creditsFind + creditsVerify) === 0) {
        try {
          const raw = typeof window !== 'undefined' ? localStorage.getItem('user_data') : null
          const ud = raw ? JSON.parse(raw) : {}
          creditsFind = Number(ud?.credits_find ?? 0)
          creditsVerify = Number(ud?.credits_verify ?? 0)
        } catch {}
      }
      const payloadPreview = buildBulkFindPayload(validRows.map(r => ({ fullName: r.fullName, domain: r.domain })))
      const totalRequests = payloadPreview.length
      if (creditsFind > 0 && totalRequests > creditsFind) {
        toast.error('You don\'t have sufficient credits to find emails.')
        setIsProcessingDirect(false)
        return
      }
      if (creditsFind <= 0 && creditsVerify < totalRequests) {
        toast.error('You don\'t have sufficient credits to find emails.')
        setIsProcessingDirect(false)
        return
      }
      setStatusDirectText('Finding emails... This may take a few minutes for large batches')
      setProgressDirect(0)
      setIsIndeterminate(true)
      // Submit the whole upload as one background job. The server processes it
      // in the same 20-row chunks; progress and results come from the job.
      const idempotencyKey = submitKeyRef.current ?? newIdempotencyKey()
      submitKeyRef.current = idempotencyKey
      let started: { job_id: string; total: number }
      try {
        started = await startBackgroundBulkJob({
          type: 'find',
          idempotency_key: idempotencyKey,
          filename: originalFileName,
          filename_with_ext: originalFileNameWithExt,
          column_order: originalColumnOrder,
          rows,
        })
      } catch (err) {
        if (err instanceof BackgroundJobRejected) submitKeyRef.current = null
        throw err
      }
      submitKeyRef.current = null
      if (started.total < validRows.length) {
        const dupes = validRows.length - started.total
        setDuplicateInfo(`${started.total} unique items to process (${dupes} duplicates removed)`)
      }
      setResultCsv(null)
      setBgTotal(started.total)
      storeBackgroundJob('find', { jobId: started.job_id, fileName: originalFileName, startedAt: new Date().toISOString() })
      setBgJobId(started.job_id)
    } catch (e) {
      setIsProcessingDirect(false)
      setIsIndeterminate(false)
      const msg = humanizeApiError(e, 'Failed to run bulk find')
      toast.error(msg)
      setRows(prev => prev.map(r => r.status === 'processing' ? { ...r, status: 'failed', error: msg } : r))
    }
  }

  // Pick the job back up after a refresh / reopened browser.
  useEffect(() => {
    const stored = getStoredBackgroundJob('find')
    if (!stored) return
    setOriginalFileName(stored.fileName)
    setBgJobId(stored.jobId)
    setIsProcessingDirect(true)
    setIsIndeterminate(true)
    setStatusDirectText('Finding emails... This may take a few minutes for large batches')
  }, [])

  useEffect(() => {
    if (!bgJob || !bgJobId || bgJob.job_id !== bgJobId) return
    const total = Number(bgJob.progress?.total) || 0
    const processed = Number(bgJob.progress?.processed) || 0
    if (total) setBgTotal(total)

    if (bgJob.status === 'processing') {
      if (processed === 0) {
        setIsIndeterminate(true)
        setStatusDirectText('Finding emails... This may take a few minutes for large batches')
      } else {
        setIsIndeterminate(false)
        setStatusDirectText(`Processing ${processed} / ${total}`)
        setProgressDirect(total > 0 ? Math.round((processed / total) * 100) : 0)
      }
      return
    }

    const jobId = bgJobId
    clearStoredBackgroundJob('find')
    setBgJobId(null)

    if (bgJob.status !== 'completed') {
      const msg = bgJob.status === 'needs_review' ? PAUSED_MESSAGE : (bgJob.error || 'Failed to run bulk find')
      setIsProcessingDirect(false)
      setIsIndeterminate(false)
      setStatusDirectText('')
      toast.error(msg, { id: `bulk-job-${jobId}` })
      setRows(prev => prev.map(r => r.status === 'processing' ? { ...r, status: 'failed', error: msg } : r))
      return
    }

    const credits = Number(bgJob.credits_charged) || 0
    void (async () => {
      try {
        const csv = await fetchBackgroundJobCsv(jobId)
        const out = readFinderResultCsv(csv)
        // One CSV row per uploaded row, in upload order.
        setRows(prev => prev.length === out.rows.length
          ? prev.map((r, i) => {
              const res = out.rows[i]
              if (!res.result_status) return r
              const ok = res.result_status === 'found' || res.result_status === 'invalid'
              return {
                ...r,
                email: res.email || r.email,
                confidence: res.confidence,
                status: ok ? 'completed' : 'failed',
                catch_all: res.catch_all,
                user_name: res.user_name,
                mx: res.mx,
                error: res.error,
                result_status: res.result_status,
                is_catch_all_domain: res.is_catch_all_domain,
                notice: res.notice,
              }
            })
          : prev)
        setResultCsv(csv)
        setCatchAllCount(out.catchAllCount)
        setCatchAllNotice(out.catchAllNotice)
        setNotProcessedCount(out.notProcessed)
        setProcessedDirectCount(out.processed)
        setSuccessDirectCount(out.found)
        setFailedDirectCount(out.notFound)
        setProgressDirect(100)
        setIsProcessingDirect(false)
        setIsIndeterminate(false)
        setCreditsCharged(credits)
        setStatusDirectText('Completed')
        toast.success(`Bulk find completed${credits ? ` • Credits used: ${credits}` : ''}`, { id: `bulk-job-${jobId}` })
        invalidateCreditsData()
        invalidateJobHistory()
      } catch (e) {
        setIsProcessingDirect(false)
        setIsIndeterminate(false)
        toast.error(humanizeApiError(e, 'Bulk find completed, but the results could not be loaded. Download them from your job history.'))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgJob, bgJobId])

  /** Builds the results CSV (same columns as the download) for the given rows. */
  const buildResultsCsv = (rowsToExport: BulkRow[]) => {
    const finderResultColumns = ['Email', 'Confidence', 'Status', 'Catch All', 'Catch-All Domain', 'Notice', 'User Name', 'MX', 'Error']
    const columnsToUse = originalColumnOrder.length > 0
      ? originalColumnOrder
      : (rowsToExport.length > 0 ? Object.keys(rowsToExport[0]).filter(key => !['email', 'confidence', 'status', 'catch_all', 'user_name', 'mx', 'error', 'result_status', 'is_catch_all_domain', 'notice'].includes(key)) : [])
    const orderedColumns = Array.from(new Set([...columnsToUse, ...finderResultColumns]))
    const csvData = rowsToExport.map(row => {
      const { fullName, domain, role, email, confidence, result_status, catch_all, user_name, mx, error, is_catch_all_domain, notice, ...originalColumns } = row
      const rowData: Record<string, string | number | boolean | null | undefined> = {}
      columnsToUse.forEach(col => {
        if (col === 'Full Name' || col === 'full_name' || col === 'fullName') {
          rowData[col] = fullName || (originalColumns[col] as string) || ''
        } else if (col === 'Domain' || col === 'domain' || col === 'Website' || col === 'website') {
          rowData[col] = domain || (originalColumns[col] as string) || ''
        } else if (col === 'Role' || col === 'role') {
          rowData[col] = role || (originalColumns[col] as string) || ''
        } else {
          rowData[col] = (originalColumns[col] as string) || ''
        }
      })
      rowData['Email'] = email || ''
      rowData['Confidence'] = typeof confidence === 'number' ? confidence : ''
      rowData['Status'] = result_status || ''
      rowData['Catch All'] = catch_all ? 'Yes' : 'No'
      rowData['Catch-All Domain'] = is_catch_all_domain ? 'Yes' : 'No'
      rowData['Notice'] = notice || ''
      rowData['User Name'] = user_name || ''
      rowData['MX'] = mx || ''
      rowData['Error'] = error || ''
      return rowData
    })
    const csv = Papa.unparse(csvData, { columns: orderedColumns })
    const downloadFileName = originalFileName 
      ? `result-${originalFileName.replace(/\.[^/.]+$/, '')}.csv` 
      : `bulk_finder_results_${new Date().toISOString().split('T')[0]}.csv`
    return { csv, downloadFileName }
  }

  const downloadDirectResults = () => {
    // After a run: the server's combined CSV for the whole upload, byte for byte.
    if (resultCsv !== null) {
      const name = originalFileName
        ? `result-${originalFileName.replace(/\.[^/.]+$/, '')}.csv`
        : `bulk_finder_results_${new Date().toISOString().split('T')[0]}.csv`
      downloadCsvString(resultCsv, name)
      toast.success('Results exported to CSV')
      return
    }
    const { csv, downloadFileName } = buildResultsCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    toast.success('Results exported to CSV')
  }

  // No job-based status

  return (
    <div className="space-y-6">
      {showHeader && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            Prospecting Engine
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">Bulk Email Finder</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Columns are detected automatically: First Name, Last Name (or a single Full
            Name) and Domain. Optional: Role.
          </p>
        </div>
      )}

      {/* Active Jobs Banner (top) */}
      <ActiveJobsBanner hideJobIds={bgJobId ? [bgJobId] : []} />

      {/* Upload zone — Stitch "Bulk File Upload (CSV)" design */}
      <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 p-8 sm:p-12 rounded-xl shadow-card flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 text-brand flex items-center justify-center mb-4">
          <UploadCloud className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-ink dark:text-white mb-1">
          Upload CSV for bulk email finding
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg mb-6 leading-relaxed">
          Drag &amp; drop your CSV list. Your{' '}
          <code className="font-mono-code text-[13px] text-ink dark:text-gray-200">first_name</code>,{' '}
          <code className="font-mono-code text-[13px] text-ink dark:text-gray-200">last_name</code> and{' '}
          <code className="font-mono-code text-[13px] text-ink dark:text-gray-200">domain</code>{' '}
          columns are detected automatically, whatever they are called — a single full-name
          column is split for you.
        </p>

        <Label htmlFor="file-upload" className="sr-only">
          Upload CSV/XLSX
        </Label>
        <input
          id="file-upload"
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileUpload}
          ref={fileInputRef}
          className="hidden"
        />

        {/* Drag & drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => !isProcessingDirect && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isProcessingDirect) {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            if (!isProcessingDirect) setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            if (isProcessingDirect) return
            const dropped = e.dataTransfer.files?.[0]
            if (dropped) processFile(dropped)
          }}
          className={`w-full max-w-xl p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-all group outline-none focus-visible:ring-[3px] focus-visible:ring-brand/15 ${
            isProcessingDirect
              ? 'cursor-not-allowed opacity-60 bg-[#F8FAFC] dark:bg-white/5 border-gray-200 dark:border-white/10'
              : isDragging
                ? 'cursor-pointer border-brand bg-brand-light/40 dark:bg-brand/10'
                : 'cursor-pointer bg-[#F8FAFC] dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-brand/50 hover:bg-brand-light/20 dark:hover:bg-brand/5'
          }`}
        >
          <FileText className="h-10 w-10 text-gray-400 group-hover:text-brand transition-colors" />
          <div className="flex flex-col items-center">
            <span className="text-sm font-bold text-ink dark:text-white">
              Select CSV file or drop here
            </span>
            <span className="text-xs text-gray-400 mt-1">
              UTF-8 .csv files up to 25MB (up to 50,000 leads)
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
            disabled={isProcessingDirect}
            className="mt-2 px-4 py-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-brand font-semibold text-xs shadow-2xs hover:border-brand transition-colors disabled:opacity-60"
          >
            Browse Computer
          </button>
        </div>

        <div className="flex items-center gap-4 mt-6 text-xs text-gray-500 dark:text-gray-400 font-medium">
          <button
            type="button"
            onClick={downloadSampleTemplate}
            className="flex items-center gap-1 text-brand hover:underline"
          >
            <Download className="h-[15px] w-[15px]" />
            Download sample CSV template
          </button>
          <span aria-hidden="true">•</span>
          <span>Automatic column mapping included</span>
        </div>
      </div>

      {/* Detected column mapping — shown after parsing, before processing. */}
      {detection && (
        <CsvColumnMappingPreview
          detection={detection}
          onUploadAnother={() => fileInputRef.current?.click()}
        />
      )}

      {/* Remaining credits — shown once the list parsed cleanly, before any run. */}
      {rows.length > 0 && detection?.ok && <BulkCreditsNotice />}

      {/* Actions — unchanged behaviour, shown once a file is loaded */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={runDirectFind} disabled={rows.length === 0 || isProcessingDirect}>
            <Play className="mr-2 h-4 w-4" />
            {isProcessingDirect ? 'Processing...' : 'Start Direct Bulk Find'}
          </Button>
          <Button
            variant="outline"
            onClick={downloadDirectResults}
            disabled={rows.length === 0 || isProcessingDirect}
          >
            <Download className="mr-2 h-4 w-4" />
            Download Results
          </Button>
          <Button
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingDirect}
          >
            <Upload className="mr-2 h-4 w-4" />
            Replace file
          </Button>
        </div>
      )}



      {(rows.length > 0 || bgJobId || resultCsv !== null) && (
        <Card>
          <CardContent className="pt-6">
            {isProcessingDirect ? (
              <div className="space-y-4">
                <p className="text-lg font-semibold text-center">{statusDirectText || 'Finding emails...'}</p>
                {isIndeterminate ? (
                  <Progress indeterminate className="w-full h-3" />
                ) : (
                  <>
                    <Progress value={progressDirect} className="w-full h-3" />
                    <div className="text-center text-sm text-gray-500">{Math.round(progressDirect)}% complete</div>
                  </>
                )}
                <p className="text-center text-sm text-gray-500">
                  {processedDirectCount} / {rows.length || bgTotal} items
                </p>
                {duplicateInfo && (
                  <p className="text-center text-sm text-gray-400">{duplicateInfo}</p>
                )}
              </div>
            ) : (processedDirectCount > 0 ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span className="text-lg font-medium text-green-600">Bulk Find Complete</span>
                </div>
                {notProcessedCount > 0 && (
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Processing stopped early: {notProcessedCount} row{notProcessedCount === 1 ? ' was' : 's were'} not processed and not charged. They are marked &quot;not_processed&quot; in the results file.
                  </p>
                )}
                {catchAllCount > 0 && (
                  <div className="mx-auto max-w-2xl flex gap-2 items-start text-left rounded-md border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-700 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {catchAllCount} result{catchAllCount === 1 ? ' is' : 's are'} on catch-all domain{catchAllCount === 1 ? '' : 's'} — those email addresses are best guesses and deliverability cannot be confirmed.
                      {catchAllNotice ? ` ${catchAllNotice}` : ''}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{successDirectCount}</p>
                    <p className="text-sm text-gray-600">Found</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{failedDirectCount}</p>
                    <p className="text-sm text-gray-600">Not Found</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{processedDirectCount}</p>
                    <p className="text-sm text-gray-600">Processed</p>
                  </div>
                  {creditsCharged > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-primary">{creditsCharged}</p>
                      <p className="text-sm text-gray-600">Credits Used</p>
                    </div>
                  )}
                </div>
                <Button onClick={downloadDirectResults}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Results
                </Button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-600">{rows.length} rows loaded and ready for bulk find</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
