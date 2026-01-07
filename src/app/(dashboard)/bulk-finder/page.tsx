'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Upload, Play, Users, CheckCircle } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
// Job endpoints are not available; direct bulk find only
import { useQueryInvalidation } from '@/lib/query-invalidation'
import { bulkFindBatched, buildBulkFindPayload } from '@/lib/bulk-find-utils'

interface CsvRow {
  'Full Name'?: string
  'Domain'?: string
  'Role'?: string
  [key: string]: unknown
}

const normalizeColumnName = (name: string) => {
  const withSpaces = name.replace(/([a-z])([A-Z])/g, '$1 $2')
  return withSpaces.toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const findColumnMapping = (columns: string[]) => {
  const mapping: { fullName?: string; domain?: string; role?: string } = {}
  const fullNameTargets = ['full name', 'person name', 'name', 'contact name', 'employee name', 'customer name', 'client name', 'lead name', 'prospect name', 'individual name']
  const domainTargets = ['domain', 'website domain', 'company domain', 'email domain', 'website', 'company website', 'url', 'site', 'web address', 'company url', 'organization domain', 'business domain']
  const roleTargets = ['role', 'position', 'title', 'job title', 'designation', 'person title', 'work title', 'occupation', 'function']
  const firstNameTargets = ['first name', 'person first name', 'fname', 'given name', 'firstname', 'first']
  const lastNameTargets = ['last name', 'person last name', 'lname', 'surname', 'family name', 'lastname', 'last', 'family']

  const normalized = columns.map(c => ({ orig: c, norm: normalizeColumnName(c) }))

  for (const col of normalized) {
    if (!mapping.fullName && fullNameTargets.includes(col.norm)) mapping.fullName = col.orig
    if (!mapping.domain && domainTargets.includes(col.norm)) mapping.domain = col.orig
    if (!mapping.role && roleTargets.includes(col.norm)) mapping.role = col.orig
  }

  if (!mapping.fullName) {
    const first = normalized.find(c => firstNameTargets.includes(c.norm))
    const last = normalized.find(c => lastNameTargets.includes(c.norm))
    if (first && last) mapping.fullName = `${first.orig}+${last.orig}`
  }

  return mapping
}

const extractFullName = (row: CsvRow, mapping: { fullName?: string }) => {
  if (!mapping.fullName) return ''
  if (mapping.fullName.includes('+')) {
    const [firstName, lastName] = mapping.fullName.split('+')
    const first = ((row[firstName] as string) || '').trim()
    const last = ((row[lastName] as string) || '').trim()
    return `${first} ${last}`.trim()
  }
  return ((row[mapping.fullName] as string) || '').trim()
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

const getRowValueCI = (row: CsvRow, key?: string) => {
  if (!key) return ''
  const match = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim())
  if (!match) return ''
  const v = (row as Record<string, unknown>)[match]
  return typeof v === 'string' ? v : ''
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
}

export default function BulkFinderPage() {
  const [rows, setRows] = useState<BulkRow[]>([])
  const [originalFileName, setOriginalFileName] = useState<string | null>(null)
  const [originalColumnOrder, setOriginalColumnOrder] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { invalidateCreditsData } = useQueryInvalidation()
  const [isProcessingDirect, setIsProcessingDirect] = useState(false)
  const [progressDirect, setProgressDirect] = useState(0)
  const [processedDirectCount, setProcessedDirectCount] = useState(0)
  const [statusDirectText, setStatusDirectText] = useState('')
  const [currentBatch, setCurrentBatch] = useState(0)
  const [totalBatches, setTotalBatches] = useState(0)

  // No job-based endpoints on backend; page runs direct bulk find only

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Store the original filename (without extension for later use)
    const fileName = file.name.replace(/\.[^/.]+$/, '') // Remove extension
    setOriginalFileName(fileName)

    const fileExtension = file.name.split('.').pop()?.toLowerCase()

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          // Store original column order from CSV headers
          const originalColumns = results.meta?.fields || []
          setOriginalColumnOrder(originalColumns)
          
          // Find column mapping
          const columnMapping = findColumnMapping(originalColumns)
          
          if (!columnMapping.fullName || !columnMapping.domain) {
            toast.error('Could not find required columns. Please include Full Name or First/Last Name, and Domain.')
            return
          }
          
          const newRows: BulkRow[] = (results.data as CsvRow[])
            .filter((row: CsvRow) => {
              const fullName = extractFullName(row, columnMapping)
              const rawDomain = getRowValueCI(row, columnMapping.domain)
              const domain = normalizeDomain(rawDomain)
              return fullName && domain
            })
            .map((row: CsvRow, index: number) => {
              const fullName = extractFullName(row, columnMapping)
              const rawDomain = getRowValueCI(row, columnMapping.domain)
              const domain = normalizeDomain(rawDomain)
              const role = getRowValueCI(row, columnMapping.role)
              return {
                id: `row-${Date.now()}-${index}`,
                fullName,
                domain,
                role,
                status: 'pending' as const,
                ...row
              }
            })
          
          setRows(newRows)
          toast.success(`Loaded ${newRows.length} rows from CSV`)
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
          setOriginalColumnOrder(originalColumns)
          
          // Find column mapping
          const columnMapping = findColumnMapping(originalColumns)
          
          if (!columnMapping.fullName || !columnMapping.domain) {
            toast.error('Could not find required columns. Please include Full Name or First/Last Name, and Domain.')
            return
          }
          
          const newRows: BulkRow[] = jsonData
            .filter((row: CsvRow) => {
              const fullName = extractFullName(row, columnMapping)
              const rawDomain = getRowValueCI(row, columnMapping.domain)
              const domain = normalizeDomain(rawDomain)
              return fullName && domain
            })
            .map((row: CsvRow, index: number) => {
              const fullName = extractFullName(row, columnMapping)
              const rawDomain = getRowValueCI(row, columnMapping.domain)
              const domain = normalizeDomain(rawDomain)
              const role = getRowValueCI(row, columnMapping.role)
              return {
                id: `row-${Date.now()}-${index}`,
                fullName,
                domain,
                role,
                status: 'pending' as const,
                ...row
              }
            })
          
          setRows(newRows)
          toast.success(`Loaded ${newRows.length} rows from Excel`)
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
    const validRows = rows.filter(r => r.fullName && normalizeDomain(r.domain))
    if (validRows.length === 0) {
      toast.error('Please add at least one valid row with Full Name and Domain')
      return
    }
    setIsProcessingDirect(true)
    setProcessedDirectCount(0)
    setProgressDirect(0)
    setStatusDirectText('')
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
      setStatusDirectText('Processing 0/...')
      setProgressDirect(0)
      const { totalCredits } = await bulkFindBatched(
        validRows.map(r => ({ fullName: r.fullName, domain: r.domain })),
        100,
        (completed, total, batchIdx, batchTotal) => {
          setProcessedDirectCount(completed)
          setStatusDirectText(`Processing ${completed} / ${total}`)
          setProgressDirect(Math.round((completed / total) * 100))
          setCurrentBatch(batchIdx)
          setTotalBatches(batchTotal)
        }
      )
      setProgressDirect(100)
      setIsProcessingDirect(false)
      setStatusDirectText('Your file is being processed. You will receive the final results by email.')
      invalidateCreditsData()
      toast.success(`Batches submitted • ${processedDirectCount} rows • Credits used: ${totalCredits}`)
    } catch (e) {
      setIsProcessingDirect(false)
      const msg = e instanceof Error ? e.message : 'Failed to run bulk find'
      toast.error(msg)
      setRows(prev => prev.map(r => r.status === 'processing' ? { ...r, status: 'failed', error: msg } : r))
    }
  }


  // No job-based status

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Bulk Email Finder</h1>
        <p className="text-gray-600 mt-2">
          Expected columns: Full Name and Domain. Optional: Role.
        </p>
      </div>

      {/* Job status removed */}

      {/* Upload and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Operations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div>
              <Label htmlFor="file-upload" className="sr-only">
                Upload CSV/XLSX
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
                disabled={isProcessingDirect}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload CSV/XLSX
              </Button>
            </div>
            

            
            {/* Submit job removed */}
            <Button
              onClick={runDirectFind}
              disabled={rows.length === 0 || isProcessingDirect}
            >
              <Play className="mr-2 h-4 w-4" />
              {isProcessingDirect ? 'Processing...' : 'Start Direct Bulk Find'}
            </Button>
           
          </div>
        </CardContent>
      </Card>



      {rows.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            {isProcessingDirect ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">{statusDirectText || 'Finding emails...'}</span>
                  <span className="text-sm text-gray-600">{processedDirectCount} / {rows.length} processed</span>
                </div>
                <Progress value={progressDirect} className="w-full h-3" />
                <div className="text-center text-sm text-gray-500">{Math.round(progressDirect)}% complete • Batch {currentBatch} of {totalBatches}</div>
              </div>
            ) : (processedDirectCount > 0 ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span className="text-lg font-medium text-green-600">Your file is being processed. You will receive the final results by email.</span>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-600">{rows.length} rows loaded and ready for bulk find</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      {/* Job history removed */}
    </div>
  )
}
