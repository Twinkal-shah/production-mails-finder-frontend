'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { ShieldCheck, Users } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { BulkVerificationJob, EmailData, VerifyResultItem } from './types'
import { useQueryInvalidation } from '@/lib/query-invalidation'
import { useRecentVerifyResults } from '@/hooks/useRecentResults'
import { useUserProfile } from '@/hooks/useCreditsData'
import { RecentVerifyResultsTable } from '@/components/recent-results-table'
import { ActiveJobsBanner } from '@/components/active-jobs-banner'
import { humanizeApiError } from '@/lib/api-error'
import { VerifyHeader } from './components/verify-header'
import { SingleVerifyPanel } from './components/single-verify-panel'
import { BulkUploadPanel, type BatchPreview } from './components/bulk-upload-panel'
import { VerifySidePanel } from './components/verify-side-panel'
import { VerifyProgressCard, VerifyFailedCard } from './components/verify-state-zone'
import { VerifyResultsSummary, VerifyResultsTable } from './components/verify-results'
import { VerifyJobHistory } from './components/verify-job-history'

interface VerifyRow extends CsvRow {
  id: number
  email: string
  status: 'pending' | 'processing' | 'valid' | 'invalid' | 'risky' | 'error' | 'unknown'
  catch_all?: boolean
  domain?: string
  mx?: string
  reason?: string
  user_name?: string
  is_catch_all_domain?: boolean
  notice?: string
}

interface CsvRow {
  Email?: string
  email?: string
  [key: string]: unknown
}



export default function VerifyPage() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [singleEmail, setSingleEmail] = useState('')
  const [singleResult, setSingleResult] = useState<{ status: string; reason?: string; error?: string; isCatchAllDomain?: boolean; notice?: string } | null>(null)
  const [singleRaw, setSingleRaw] = useState<Record<string, unknown> | null>(null)
  const [bulkCatchAllCount, setBulkCatchAllCount] = useState(0)
  const [bulkCatchAllNotice, setBulkCatchAllNotice] = useState<string | null>(null)
  const [isVerifyingSingle, setIsVerifyingSingle] = useState(false)
  const [rows, setRows] = useState<VerifyRow[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)
  const [validCount, setValidCount] = useState(0)
  const [invalidCount, setInvalidCount] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)
  const [riskyCount, setRiskyCount] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [results, setResults] = useState<VerifyResultItem[]>([])
  const [currentJob, setCurrentJob] = useState<BulkVerificationJob | null>(null)
  const [originalFileName, setOriginalFileName] = useState<string>('')
  const [originalFileNameWithExt, setOriginalFileNameWithExt] = useState<string>('')
  const [originalColumnOrder, setOriginalColumnOrder] = useState<string[]>([])
  const [allJobs, setAllJobs] = useState<BulkVerificationJob[]>([])
  const [isIndeterminate, setIsIndeterminate] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState('')
  const [creditsCharged, setCreditsCharged] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { invalidateCreditsData } = useQueryInvalidation()
  const { addResult: addRecentVerifyResult } = useRecentVerifyResults()
  const { data: profile } = useUserProfile()
  // const [isSubmittingJob, setIsSubmittingJob] = useState(false) // Currently unused

  // Poll job status every 3 seconds


  // Load user's bulk verification jobs
  const loadUserJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/bulk-verify/jobs')
      if (!response.ok) return
      const data = await response.json()
      if (data.jobs) {
        setAllJobs(data.jobs)
      }
    } catch {}
  }, [])

  // Load jobs on component mount
  useEffect(() => {
    loadUserJobs()
  }, [loadUserJobs])



  // Update progress when current job changes
  useEffect(() => {
    if (currentJob && currentJob.totalEmails > 0) {
      const progressPercent = (currentJob.processedEmails || 0) / currentJob.totalEmails * 100
      setProgress(progressPercent)
      setProcessedCount(currentJob.processedEmails || 0)
    }
  }, [currentJob])

  const asRecord = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  const getVerificationPayload = (value: unknown) => {
    const root = asRecord(value)
    return asRecord(root.data)
  }
  const getVerificationDetails = (value: unknown) => {
    const payload = getVerificationPayload(value)
    return Object.keys(payload).length > 0 ? payload : asRecord(value)
  }
  const getStringValue = (value: unknown) => typeof value === 'string' && value.trim() ? value : undefined

  /**
   * Read-only preview of the de-duplication that `runBulkVerify` performs.
   * Uses the exact same normalisation and validity rules, so the numbers shown
   * before a run match what is actually submitted. Does not mutate any state.
   */
  const batchPreview: BatchPreview = useMemo(() => {
    const normalizeEmail = (e: string) => (e || '').trim().toLowerCase()
    const isValidEmail = (e: string) => /.+@.+\..+/.test(e)
    const seen = new Set<string>()
    let invalid = 0
    for (const r of rows) {
      const normalized = normalizeEmail(r.email || '')
      if (!normalized || !isValidEmail(normalized)) {
        invalid++
        continue
      }
      seen.add(normalized)
    }
    return {
      total: rows.length,
      unique: seen.size,
      duplicates: Math.max(0, rows.length - invalid - seen.size),
      invalid,
    }
  }, [rows])

  const verifySingle = async () => {
    if (!singleEmail.trim()) {
      toast.error('Please enter an email address')
      return
    }

    setIsVerifyingSingle(true)
    setSingleResult(null)

    try {
      const response = await fetch('/verify/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',   // <-- VERY IMPORTANT
        body: JSON.stringify({ email: singleEmail }),
      })

      const data = await response.json()
      const details = getVerificationDetails(data)
      if (!response.ok) {
        const rawErr = getStringValue(details.error) ||
          getStringValue(asRecord(data).error) ||
          getStringValue(asRecord(data).message) ||
          ''
        throw new Error(humanizeApiError(rawErr, 'Failed to verify email'))
      }

      const rawStatus = typeof details.status === 'string' ? details.status.toLowerCase() : 'unknown'
      const rawReason = getStringValue(details.reason) || getStringValue(details.error) || getStringValue(asRecord(data).error) || ''
      const isCatchAllDomain = details.is_catch_all_domain === true
      const noticeText = getStringValue(details.notice)
      const uiStatus = isCatchAllDomain ? 'catch_all' : (details.catch_all === true ? 'risky' : rawStatus)
      const uiReason = rawReason || undefined
      setSingleResult({ status: uiStatus, reason: uiReason, isCatchAllDomain, notice: noticeText })
      setSingleRaw(details)

      if (uiStatus === 'valid') {
        toast.success('Email is valid!')
      } else if (uiStatus === 'invalid') {
        toast.error('Email is invalid')
      } else if (uiStatus === 'risky') {
        toast.warning('Email is risky')
      } else if (uiStatus === 'catch_all') {
        toast.warning(noticeText || 'Catch-all domain — deliverability cannot be confirmed')
      } else if (uiStatus === 'error') {
        toast.error(humanizeApiError(rawReason, 'Failed to verify email'))
      }

      // Invalidate queries for real-time credit updates
      invalidateCreditsData()
      // Optimistically add to recent results
      addRecentVerifyResult({
        result: {
          email: singleEmail,
          status: uiStatus,
          domain: singleEmail.split('@')[1] || '',
          confidence_score: typeof details.confidence_score === 'number' ? (details.confidence_score as number) : 0,
          safe_to_send: typeof details.safe_to_send === 'boolean' ? (details.safe_to_send as boolean) : undefined,
          email_provider: getStringValue(details.email_provider) || undefined,
          catch_all: details.catch_all === true,
        },
        created_at: new Date().toISOString(),
      })
    } catch (error: unknown) {
      const errorMessage = humanizeApiError(error, 'Failed to verify email')
      toast.error(errorMessage)
    } finally {
      setIsVerifyingSingle(false)
  }
  }

  /**
   * Parse a picked or dropped file. Body is unchanged from the original
   * `handleFileUpload`; only the file is now passed in directly so the same
   * code path serves both the file picker and drag-and-drop.
   */
  const processFile = (file: File) => {
    // Store the original filename (without extension for later use)
    const fileName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
    setOriginalFileName(fileName)
    setOriginalFileNameWithExt(file.name)

    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          // Store original column order from CSV headers
          const originalColumns = results.meta?.fields || []
          setOriginalColumnOrder(originalColumns)

          const newRows: VerifyRow[] = (results.data as CsvRow[])
            .filter((row: CsvRow) => row['Email'] || row['email'])
            .map((row: CsvRow, index: number) => {
              const emailValue = row['Email'] || row['email'] || ''
              // Preserve all original columns and add our required fields
              return {
                id: index,
                email: emailValue,
                status: 'pending' as const,
                ...row // Spread all original columns
              }
            })

          setRows(newRows)
          toast.success(`Loaded ${newRows.length} emails from CSV`)
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
          const jsonData = XLSX.utils.sheet_to_json(worksheet)

          // Store original column order from Excel headers
          if (jsonData.length > 0) {
            const originalColumns = Object.keys(jsonData[0] as object)
            setOriginalColumnOrder(originalColumns)
          }

          const newRows: VerifyRow[] = (jsonData as CsvRow[])
            .filter((row: CsvRow) => row['Email'] || row['email'])
            .map((row: CsvRow, index: number) => {
              const emailValue = row['Email'] || row['email'] || ''
              // Preserve all original columns and add our required fields
              return {
                id: index,
                email: emailValue,
                status: 'pending' as const,
                ...row // Spread all original columns
              }
            })

          setRows(newRows)
          toast.success(`Loaded ${newRows.length} emails from Excel`)
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    processFile(file)
  }

  /** Clear the loaded batch. Client-side state reset only. */
  const clearBatch = () => {
    setRows([])
    setResults([])
    setCurrentJob(null)
    setOriginalFileName('')
    setOriginalFileNameWithExt('')
    setOriginalColumnOrder([])
    setProgress(0)
    setProcessedCount(0)
    setValidCount(0)
    setInvalidCount(0)
    setUnknownCount(0)
    setRiskyCount(0)
    setStatusText('')
    setDuplicateInfo('')
    setCreditsCharged(0)
    setBulkCatchAllCount(0)
    setBulkCatchAllNotice(null)
    setIsIndeterminate(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const runBulkVerify = async () => {
    const validRows = rows.filter(row => row.email)
    if (validRows.length === 0) {
      toast.error('Please add at least one valid email address')
      return
    }
    setIsProcessing(true)
    setProcessedCount(0)
    setProgress(0)
    setResults([])
    setIsIndeterminate(true)
    setDuplicateInfo('')
    setCreditsCharged(0)
    setValidCount(0)
    setInvalidCount(0)
    setUnknownCount(0)
    setRiskyCount(0)
    setBulkCatchAllCount(0)
    setBulkCatchAllNotice(null)
    const localJobId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `job-${Date.now()}`
    setCurrentJob({
      jobId: localJobId,
      status: 'processing',
      totalEmails: validRows.length,
      processedEmails: 0,
      successfulVerifications: 0,
      failedVerifications: 0,
      filename: originalFileName,
      emailsData: validRows.map(r => ({ ...r, status: 'pending' }))
    })
    try {
      const normalizeEmail = (e: string) => (e || '').trim().toLowerCase()
      const isValidEmail = (e: string) => /.+@.+\..+/.test(e)

      const dedupedRowsMap = new Map<string, Record<string, unknown>>()
      for (const r of rows) {
        const normalized = normalizeEmail(r.email || '')
        if (!normalized || !isValidEmail(normalized)) continue
        if (dedupedRowsMap.has(normalized)) continue
        const originalRow: Record<string, unknown> = {}
        for (const col of originalColumnOrder) {
          originalRow[col] = (r as Record<string, unknown>)[col]
        }
        originalRow.email = normalized
        dedupedRowsMap.set(normalized, originalRow)
      }
      const dedupedRows = Array.from(dedupedRowsMap.values())
      const uniqueEmails = Array.from(dedupedRowsMap.keys())

      setRows(prev => prev.map(r => {
        const ok = isValidEmail(normalizeEmail(r.email || ''))
        return ok ? r : { ...r, status: 'invalid' }
      }))

      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
      const normalizeStatus = (s: unknown): VerifyRow['status'] => {
        const v = typeof s === 'string' ? s.toLowerCase() : ''
        if (v === 'valid' || v === 'deliverable' || v === 'ok') return 'valid'
        if (v === 'invalid' || v === 'undeliverable') return 'invalid'
        if (v === 'unknown') return 'unknown'
        if (v === 'risky' || v === 'catch_all' || v === 'catchall') return 'risky'
        if (v === 'error' || v === 'failed') return 'error'
        return 'unknown'
      }

      setStatusText('Verifying emails... This may take a few minutes for large batches')
      setProgress(0)
      setIsIndeterminate(true)

      // --- Step 1: Submit to V2 endpoint ---
      const verifyBody: Record<string, unknown> = { rows: dedupedRows }
      if (originalFileNameWithExt) verifyBody.original_filename = originalFileNameWithExt
      const resp = await fetch('/api/email/verifyBulkEmailV2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(verifyBody)
      })

      if (!resp.ok) {
        let errorData: Record<string, unknown> = {}
        try { errorData = await resp.json() } catch {}
        const rawMsg = typeof errorData.message === 'string' ? errorData.message : ''
        throw new Error(humanizeApiError(rawMsg, 'Failed to submit bulk verify job'))
      }

      const submitBody = await resp.json()
      const submitData = submitBody?.data as Record<string, unknown> | undefined
      const backendJobId = typeof submitData?.job_id === 'string' ? submitData.job_id : undefined
      if (!backendJobId) throw new Error('No job_id returned from V2 endpoint')

      // Show duplicate info from initial response
      const initProgress = submitData?.progress as Record<string, unknown> | undefined
      const backendTotal = Number(initProgress?.total ?? uniqueEmails.length)
      if (uniqueEmails.length > backendTotal) {
        const dupes = uniqueEmails.length - backendTotal
        setDuplicateInfo(`${backendTotal} unique emails to process (${dupes} duplicates removed)`)
      } else if (rows.length > backendTotal) {
        const dupes = rows.length - backendTotal
        setDuplicateInfo(`${backendTotal} unique emails to process (${dupes} duplicates removed)`)
      }

      // --- Step 2: Poll for completion ---
      const { pollJob } = await import('@/lib/poll-job')
      const jobResult = await pollJob(
        backendJobId,
        token || '',
        (progress) => {
          if (progress.processed === 0) {
            // SMTP phase — indeterminate
            setIsIndeterminate(true)
            setStatusText('Verifying emails... This may take a few minutes for large batches')
          } else {
            // Real progress
            setIsIndeterminate(false)
            const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0
            setProgress(pct)
            setStatusText(`Processing ${progress.processed} / ${progress.total} emails`)
          }
          setProcessedCount(progress.processed)
          setCurrentJob(prev => prev ? {
            ...prev,
            processedEmails: progress.processed,
            totalEmails: progress.total
          } : prev)
        },
        5000
      )

      // --- Step 3: Process completed results ---
      const resultsArr = Array.isArray(jobResult.results) ? jobResult.results : []
      const collected: VerifyResultItem[] = []
      const totals = { valid: 0, invalid: 0, unknown: 0, risky: 0, processed: 0 }
      let catchAllDomainCount = 0
      let firstCatchAllNotice: string | null = null

      for (const item of resultsArr) {
        const result = asRecord(item)
        const baseStatus = result.status ?? result.result ?? result.email_status
        const normalized = normalizeStatus(baseStatus)
        const finalStatus = result.catch_all === true ? 'risky' : normalized
        const rawReason = getStringValue(result.reason)
        const isCatchAllDomain = result.is_catch_all_domain === true
        const noticeText = getStringValue(result.notice)
        if (isCatchAllDomain) {
          catchAllDomainCount++
          if (!firstCatchAllNotice && noticeText) firstCatchAllNotice = noticeText
        }
        const resultItem = {
          email: getStringValue(result.email) || '',
          status: finalStatus,
          catch_all: typeof result.catch_all === 'boolean' ? result.catch_all : undefined,
          connections: typeof result.connections === 'number' ? result.connections : undefined,
          domain: getStringValue(result.domain),
          mx: getStringValue(result.mx),
          reason: rawReason,
          time_exec: typeof result.time_exec === 'number' ? result.time_exec : undefined,
          user_name: getStringValue(result.user_name),
          is_catch_all_domain: isCatchAllDomain || undefined,
          notice: noticeText
        }
        collected.push(resultItem)
        totals.processed++
        if (finalStatus === 'valid') totals.valid++
        else if (finalStatus === 'risky') totals.risky++
        else if (finalStatus === 'invalid') totals.invalid++
        else totals.unknown++
      }
      setBulkCatchAllCount(catchAllDomainCount)
      setBulkCatchAllNotice(firstCatchAllNotice)

      setResults(collected)
      setValidCount(totals.valid)
      setInvalidCount(totals.invalid)
      setUnknownCount(totals.unknown)
      setRiskyCount(totals.risky)
      setProcessedCount(totals.processed)
      setProgress(100)
      setIsIndeterminate(false)
      setCreditsCharged(Number(jobResult.summary?.credits_charged ?? 0))

      setRows(prev => prev.map(r => {
        const hit = collected.find(it => normalizeEmail(it.email || '') === normalizeEmail(r.email || ''))
        if (!hit || !hit.status) return r
        return {
          ...r,
          status: hit.status as VerifyRow['status'],
          catch_all: typeof hit.catch_all === 'boolean' ? hit.catch_all : r.catch_all,
          domain: typeof hit.domain === 'string' ? hit.domain : r.domain,
          mx: typeof hit.mx === 'string' ? hit.mx : r.mx,
          reason: typeof hit.reason === 'string' ? hit.reason : r.reason,
          user_name: typeof hit.user_name === 'string' ? hit.user_name : r.user_name,
          is_catch_all_domain: typeof hit.is_catch_all_domain === 'boolean' ? hit.is_catch_all_domain : r.is_catch_all_domain,
          notice: typeof hit.notice === 'string' ? hit.notice : r.notice
        }
      }))

      setCurrentJob(prev => {
        if (!prev) return prev
        const updatedEmailsData = (prev.emailsData || []).map(r => {
          const hit = collected.find(it => normalizeEmail(it.email || '') === normalizeEmail(r.email || ''))
          if (!hit || !hit.status) return r
          return {
            ...r,
            status: hit.status as VerifyRow['status'],
            catch_all: typeof hit.catch_all === 'boolean' ? hit.catch_all : r.catch_all,
            domain: typeof hit.domain === 'string' ? hit.domain : r.domain,
            mx: typeof hit.mx === 'string' ? hit.mx : r.mx,
            reason: typeof hit.reason === 'string' ? hit.reason : r.reason,
            user_name: typeof hit.user_name === 'string' ? hit.user_name : r.user_name
          }
        })
        return {
          ...prev,
          status: 'completed',
          processedEmails: totals.processed,
          successfulVerifications: totals.valid,
          failedVerifications: totals.invalid,
          emailsData: updatedEmailsData
        }
      })

      setIsProcessing(false)
      setStatusText('Completed')
      toast.success('Bulk verification completed')
      invalidateCreditsData()
    } catch (error: unknown) {
      const msg = humanizeApiError(error, 'Failed to run bulk verification')
      toast.error(msg)
      setCurrentJob(prev => prev ? { ...prev, status: 'failed', errorMessage: msg } : prev)
      setIsProcessing(false)
      setIsIndeterminate(false)
    }
  }

  const downloadResults = () => {
    try {
      const cols = ['catch_all', 'connections', 'domain', 'email', 'mx', 'status', 'time_exec', 'user_name', 'is_catch_all_domain', 'notice']
      const list = results.length > 0
        ? results.map(it => ({
            catch_all: it.catch_all,
            connections: it.connections,
            domain: it.domain,
            email: it.email,
            mx: it.mx,
            status: it.status,
            time_exec: it.time_exec,
            user_name: it.user_name,
            is_catch_all_domain: it.is_catch_all_domain,
            notice: it.notice
          }))
        : rows.map(r => ({
            catch_all: r.catch_all,
            connections: undefined,
            domain: r.domain,
            email: r.email,
            mx: r.mx,
            status: r.status,
            time_exec: undefined,
            user_name: r.user_name,
            is_catch_all_domain: r.is_catch_all_domain,
            notice: r.notice
          }))
      const csv = Papa.unparse(list, { columns: cols })
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const downloadFileName = originalFileName ? `${originalFileName}.csv` : `email-verification-results-${new Date().toISOString().split('T')[0]}.csv`
      a.download = downloadFileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Results exported to CSV')
    } catch {
      toast.error('Failed to export results')
    }
  }

  /**
   * Export a historical job. Body lifted verbatim from the inline handler that
   * used to live on the job-history row — same column order, same filename.
   */
  const downloadJobResults = (job: BulkVerificationJob) => {
    // Define verification result columns to append
    const verificationColumns = ['catch_all', 'connections', 'domain', 'email', 'mx', 'status', 'time_exec', 'user_name', 'is_catch_all_domain', 'notice']

    // Use stored original column order if available, otherwise extract from first row
    let columnsToUse = originalColumnOrder
    if (columnsToUse.length === 0 && job.emailsData && job.emailsData.length > 0) {
      const firstRow = job.emailsData[0]
      columnsToUse = Object.keys(firstRow).filter(key => !verificationColumns.includes(key))
    }

    // Create ordered columns: original columns first, then verification results
    const orderedColumns = [...columnsToUse, ...verificationColumns]

    // Prepare data with proper column ordering
    const exportData = (job.emailsData || []).map((row: EmailData) => {
      const orderedRow: Record<string, unknown> = {}

      // Add original columns in their original order
      columnsToUse.forEach(col => {
        orderedRow[col] = row[col]
      })

      // Add verification result columns
      verificationColumns.forEach(col => {
        orderedRow[col] = row[col]
      })

      return orderedRow
    })

    const csvContent = Papa.unparse(exportData, { columns: orderedColumns })
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    const downloadFileName = job.filename
      ? `result-${job.filename.replace(/\.[^/.]+$/, '')}.csv`
      : `bulk_verification_results_${job.jobId}.csv`
    link.setAttribute('download', downloadFileName)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const isCompleted = currentJob?.status === 'completed' && !isProcessing
  const isFailed = currentJob?.status === 'failed' && !isProcessing

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 lg:space-y-8">
      <VerifyHeader credits={profile?.available_credits} />

      {/* Active Jobs Banner */}
      <ActiveJobsBanner />

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'bulk')}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1 sm:inline-flex sm:w-auto">
          <TabsTrigger
            value="single"
            className="gap-2 rounded-lg px-4 py-2 text-sm font-semibold data-[state=active]:bg-[var(--primary)] data-[state=active]:text-white"
          >
            <ShieldCheck className="h-4 w-4" />
            Single email
          </TabsTrigger>
          <TabsTrigger
            value="bulk"
            className="gap-2 rounded-lg px-4 py-2 text-sm font-semibold data-[state=active]:bg-[var(--primary)] data-[state=active]:text-white"
          >
            <Users className="h-4 w-4" />
            Bulk list
          </TabsTrigger>
        </TabsList>

        {/* ---------------- Single ---------------- */}
        <TabsContent value="single" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            <SingleVerifyPanel
              className="lg:col-span-7"
              email={singleEmail}
              onEmailChange={setSingleEmail}
              onVerify={verifySingle}
              isVerifying={isVerifyingSingle}
              result={singleResult}
              raw={singleRaw}
            />
            <VerifySidePanel variant="single" className="lg:col-span-5" />
          </div>
        </TabsContent>

        {/* ---------------- Bulk ---------------- */}
        <TabsContent value="bulk" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            <BulkUploadPanel
              className="lg:col-span-7"
              fileInputRef={fileInputRef}
              onFileInputChange={handleFileUpload}
              onFileDropped={processFile}
              fileName={originalFileNameWithExt}
              batch={batchPreview}
              columnCount={originalColumnOrder.length}
              creditBalance={profile?.available_credits}
              isProcessing={isProcessing}
              hasFile={rows.length > 0}
              onStart={runBulkVerify}
              onClear={clearBatch}
            />
            <VerifySidePanel variant="bulk" className="lg:col-span-5" />
          </div>

          {isProcessing && (
            <VerifyProgressCard
              statusText={statusText}
              progress={progress}
              isIndeterminate={isIndeterminate}
              processedCount={processedCount}
              totalCount={currentJob?.totalEmails ?? rows.length}
              duplicateInfo={duplicateInfo}
            />
          )}

          {isFailed && (
            <VerifyFailedCard
              errorMessage={currentJob?.errorMessage}
              canDownloadPartial={!!currentJob?.emailsData && (currentJob?.processedEmails || 0) > 0}
              onRetry={runBulkVerify}
              onDownloadPartial={downloadResults}
            />
          )}

          {isCompleted && (
            <>
              <VerifyResultsSummary
                processedCount={processedCount}
                validCount={validCount}
                invalidCount={invalidCount}
                riskyCount={riskyCount}
                unknownCount={unknownCount}
                creditsCharged={creditsCharged}
                catchAllCount={bulkCatchAllCount}
                catchAllNotice={bulkCatchAllNotice}
                onDownload={downloadResults}
              />
              <VerifyResultsTable results={results} />
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Recent Verify Results */}
      <RecentVerifyResultsTable />

      {/* Job History */}
      <VerifyJobHistory jobs={allJobs} onDownload={downloadJobResults} />
    </div>
  )
}
