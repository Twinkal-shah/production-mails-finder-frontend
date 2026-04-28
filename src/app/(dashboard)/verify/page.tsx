'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Upload, Download, Play, Shield, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { BulkVerificationJob, EmailData } from './types'
import { useQueryInvalidation } from '@/lib/query-invalidation'
import { useRecentVerifyResults } from '@/hooks/useRecentResults'
import { RecentVerifyResultsTable } from '@/components/recent-results-table'
import { ActiveJobsBanner } from '@/components/active-jobs-banner'

interface VerifyRow extends CsvRow {
  id: number
  email: string
  status: 'pending' | 'processing' | 'valid' | 'invalid' | 'risky' | 'error' | 'unknown'
  catch_all?: boolean
  domain?: string
  mx?: string
  reason?: string
  user_name?: string
}

interface CsvRow {
  Email?: string
  email?: string
  [key: string]: unknown
}

 

export default function VerifyPage() {
  const [singleEmail, setSingleEmail] = useState('')
  const [singleResult, setSingleResult] = useState<{ status: string; reason?: string; error?: string } | null>(null)
  const [singleRaw, setSingleRaw] = useState<Record<string, unknown> | null>(null)
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
  const [results, setResults] = useState<{ email: string; status?: string; catch_all?: boolean; connections?: number; domain?: string; mx?: string; reason?: string; time_exec?: number; user_name?: string }[]>([])
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

  const formatLabel = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }
  const statusLabel = (s?: string) => {
    const v = typeof s === 'string' ? s.toLowerCase() : ''
    if (v === 'valid') return 'Valid'
    if (v === 'invalid') return 'Invalid'
    if (v === 'risky') return 'Risky'
    return 'Unknown'
  }
  const statusDescription = (s?: string) => {
    const v = typeof s === 'string' ? s.toLowerCase() : ''
    if (v === 'valid') return 'Email is valid and deliverable.'
    if (v === 'invalid') return 'Email does not exist or cannot receive messages.'
    if (v === 'risky') return 'Email appears risky (catch-all or uncertain).'
    if (v === 'error') return 'Unable to verify this email. Please try again later.'
    return 'Verification completed. Status is unknown.'
  }
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
        throw new Error(
          getStringValue(details.error) ||
          getStringValue(asRecord(data).error) ||
          'Failed to verify email'
        )
      }

      const rawStatus = typeof details.status === 'string' ? details.status.toLowerCase() : 'unknown'
      const rawReason = getStringValue(details.reason) || getStringValue(details.error) || getStringValue(asRecord(data).error) || ''
      const uiStatus = details.catch_all === true ? 'risky' : rawStatus
      const uiReason = rawReason || undefined
      setSingleResult({ status: uiStatus, reason: uiReason })
      setSingleRaw(details)
      
      if (uiStatus === 'valid') {
        toast.success('Email is valid!')
      } else if (uiStatus === 'invalid') {
        toast.error('Email is invalid')
      } else if (uiStatus === 'risky') {
        toast.warning('Email is risky')
      } else if (uiStatus === 'error') {
        toast.error(rawReason || 'Failed to verify email')
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify email'
      toast.error(errorMessage)
    } finally {
      setIsVerifyingSingle(false)
  }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

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
        throw new Error(typeof errorData.message === 'string' ? errorData.message : 'Failed to submit bulk verify job')
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
      const collected: { email: string; status?: string; catch_all?: boolean; connections?: number; domain?: string; mx?: string; reason?: string; time_exec?: number; user_name?: string }[] = []
      const totals = { valid: 0, invalid: 0, unknown: 0, risky: 0, processed: 0 }

      for (const item of resultsArr) {
        const result = asRecord(item)
        const baseStatus = result.status ?? result.result ?? result.email_status
        const normalized = normalizeStatus(baseStatus)
        const finalStatus = result.catch_all === true ? 'risky' : normalized
        const rawReason = getStringValue(result.reason)
        const resultItem = {
          email: getStringValue(result.email) || '',
          status: finalStatus,
          catch_all: typeof result.catch_all === 'boolean' ? result.catch_all : undefined,
          connections: typeof result.connections === 'number' ? result.connections : undefined,
          domain: getStringValue(result.domain),
          mx: getStringValue(result.mx),
          reason: rawReason,
          time_exec: typeof result.time_exec === 'number' ? result.time_exec : undefined,
          user_name: getStringValue(result.user_name)
        }
        collected.push(resultItem)
        totals.processed++
        if (finalStatus === 'valid') totals.valid++
        else if (finalStatus === 'risky') totals.risky++
        else if (finalStatus === 'invalid') totals.invalid++
        else totals.unknown++
      }

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
          user_name: typeof hit.user_name === 'string' ? hit.user_name : r.user_name
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
      const msg = error instanceof Error ? error.message : 'Failed to run bulk verification'
      toast.error(msg)
      setCurrentJob(prev => prev ? { ...prev, status: 'failed', errorMessage: msg } : prev)
      setIsProcessing(false)
      setIsIndeterminate(false)
    }
  }

  const downloadResults = () => {
    try {
      const cols = ['catch_all', 'connections', 'domain', 'email', 'mx', 'status', 'time_exec', 'user_name']
      const list = results.length > 0
        ? results.map(it => ({
            catch_all: it.catch_all,
            connections: it.connections,
            domain: it.domain,
            email: it.email,
            mx: it.mx,
            status: it.status,
            time_exec: it.time_exec,
            user_name: it.user_name
          }))
        : rows.map(r => ({
            catch_all: r.catch_all,
            connections: undefined,
            domain: r.domain,
            email: r.email,
            mx: r.mx,
            status: r.status,
            time_exec: undefined,
            user_name: r.user_name
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

  

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Verify</h1>
        <p className="text-gray-600 mt-2">
          Verify email addresses for deliverability and validity.
        </p>
      </div>

      {/* Active Jobs Banner */}
      <ActiveJobsBanner />

      {/* Single Email Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Single Email Verification
          </CardTitle>
          <CardDescription>
            Verify a single email address for deliverability.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="single-email" className="mb-2 dark:text-gray-200">Email Address</Label>
              <Input
                id="single-email"
                type="email"
                placeholder="Enter email address"
                value={singleEmail}
                onChange={(e) => setSingleEmail(e.target.value)}
                disabled={isVerifyingSingle}
                className="text-[#1b1c1b] dark:text-white placeholder-[#5a4042]/50 dark:placeholder-[#e2bebf]/50"
              />
            </div>
            <div className="flex items-end">
                      <Button
                onClick={verifySingle}
                disabled={isVerifyingSingle || !singleEmail}
              >
                <Shield className="mr-2 h-4 w-4" />
                Verify Email
              </Button>
            </div>
          </div>
          
          {singleResult && (
            <Card className={`verification-result border-2 dark:text-white ${
              singleResult.status === 'valid' ? 'border-green-200 bg-green-50' :
              singleResult.status === 'invalid' ? 'border-red-200 bg-red-50' :
              singleResult.status === 'risky' ? 'border-yellow-200 bg-yellow-50' :
              'border-gray-200 bg-gray-50'
            }`}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  {singleResult.status === 'valid' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  {singleResult.status === 'invalid' && <AlertCircle className="h-5 w-5 text-red-600" />}
                  {singleResult.status === 'risky' && <AlertCircle className="h-5 w-5 text-yellow-600" />}
                  <div>
                    <p className="font-medium">
                      Status: <span>{statusLabel(singleResult.status)}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      {statusDescription(singleResult.status)}
                    </p>
                  </div>
                </div>
                {singleResult.status === 'valid' && singleRaw && (
                  <div className="mt-4 space-y-1">
                    {Object.entries(singleRaw)
                      .filter(([key, value]) => key !== 'reason' && key !== 'status' && value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === ''))
                      .map(([key, value]) => (
                        <p key={key} className="text-sm text-gray-800">
                          {formatLabel(key)}: {String(value)}
                        </p>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Bulk Email Verification */}
      <Card>
        <CardHeader>
          <CardTitle>Verify Your List</CardTitle>
          <CardDescription>
            Upload a CSV or Excel file with email addresses to verify in bulk.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div>
              <Label htmlFor="file-upload" className="sr-only">
                Choose file
              </Label>
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose file
              </Button>
            </div>
            
            <Button
              onClick={runBulkVerify}
              disabled={isProcessing || rows.length === 0}
            >
              {isProcessing ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Bulk Verify
                </>
              )}
            </Button>
            

          </div>
        </CardContent>
      </Card>

      {/* Progress and Status */}
      {rows.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            {isProcessing ? (
              <div className="space-y-4">
                <p className="text-lg font-semibold text-center">{statusText || 'Verifying emails...'}</p>
                {isIndeterminate ? (
                  <Progress indeterminate className="w-full h-3" />
                ) : (
                  <>
                    <Progress value={progress} className="w-full h-3" />
                    <div className="text-center text-sm text-gray-500">
                      {Math.round(progress)}% complete
                    </div>
                  </>
                )}
                <p className="text-center text-sm text-gray-500">
                  {processedCount} / {currentJob?.totalEmails ?? rows.length} emails
                </p>
                {duplicateInfo && (
                  <p className="text-center text-sm text-gray-400">{duplicateInfo}</p>
                )}
              </div>
            ) : currentJob?.status === 'completed' ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span className="text-lg font-medium text-green-600">Verification Complete!</span>
                </div>
                <p className="text-sm text-gray-600">Processed {processedCount} emails</p>
                <div className={`grid gap-4 ${creditsCharged > 0 ? 'grid-cols-6' : 'grid-cols-5'}`}>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{validCount}</p>
                    <p className="text-sm text-gray-600">Valid</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{invalidCount}</p>
                    <p className="text-sm text-gray-600">Invalid</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-600">{unknownCount}</p>
                    <p className="text-sm text-gray-600">Unknown</p>
                  </div>
                  <div title="Catch-all or uncertain results — not billed.">
                    <p className="text-2xl font-bold text-yellow-500">{riskyCount}</p>
                    <p className="text-sm text-gray-600">Risky</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{processedCount}</p>
                    <p className="text-sm text-gray-600">Processed</p>
                  </div>
                  {creditsCharged > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-primary">{creditsCharged}</p>
                      <p className="text-sm text-gray-600">Credits Used</p>
                    </div>
                  )}
                </div>
                <Button onClick={downloadResults} className="bg-green-600 hover:bg-green-700">
                  <Download className="mr-2 h-4 w-4" />
                  Download Results
                </Button>
              </div>
            ) : currentJob?.status === 'failed' ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                  <span className="text-lg font-medium text-red-600">Verification Failed</span>
                </div>
                {currentJob.errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{currentJob.errorMessage}</p>
                  </div>
                )}
                {currentJob.emailsData && (currentJob.processedEmails || 0) > 0 && (
                  <Button
                    variant="outline"
                    onClick={downloadResults}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Partial Results
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {rows.length} emails loaded and ready for verification
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Verify Results */}
      <RecentVerifyResultsTable />

      {/* Job History */}
      {allJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Job History</CardTitle>
            <CardDescription>
              Your recent bulk verification jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allJobs.map((job) => (
                 <div key={job.jobId} className="flex items-center justify-between p-3 border rounded-lg">
                   <div className="flex items-center gap-3">
                     {job.status === 'processing' ? (
                       <Clock className="h-4 w-4" style={{ color: 'var(--primary)' }} />
                     ) : job.status === 'completed' ? (
                       <CheckCircle className="h-4 w-4 text-green-600" />
                     ) : (
                       <AlertCircle className="h-4 w-4 text-red-600" />
                     )}
                     <div>
                       <p className="font-medium">{job.filename || `Job ${job.jobId}`}</p>
                       <p className="text-sm text-gray-600">
                         {job.processedEmails || 0} / {job.totalEmails} emails • {job.status}
                       </p>
                     </div>
                   </div>
                   <div className="text-right">
                     <p className="text-sm text-gray-600">
                       {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'N/A'}
                     </p>
                     {job.status === 'completed' && job.emailsData && (
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => {
                           // Define verification result columns to append
                           const verificationColumns = ['catch_all', 'connections', 'domain', 'email', 'mx', 'status', 'time_exec', 'user_name']
                           
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
                         }}
                        className="mt-1"
                       >
                         <Download className="h-3 w-3" />
                       </Button>
                     )}
                   </div>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
