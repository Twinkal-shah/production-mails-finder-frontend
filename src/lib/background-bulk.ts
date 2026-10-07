/**
 * Bulk Finder / Bulk Verification run as server-side background jobs.
 *
 * The browser only submits the upload (POST /api/bulk-jobs), remembers the job
 * id, and follows it with the existing job endpoints:
 *   GET /api/email/job/:id           progress (useJobPolling)
 *   GET /api/email/job/:id/download  the job's one combined result CSV
 * Refreshing, closing the tab or shutting the laptop does not stop the job.
 */
import Papa from 'papaparse'
import { humanizeApiError } from '@/lib/api-error'
import { saveActiveJob, removeActiveJob } from '@/hooks/useActiveJobs'

export type BackgroundBulkKind = 'find' | 'verify'

/** What a page needs to pick its job back up after a refresh. */
export interface StoredBackgroundJob {
  jobId: string
  /** Upload name without extension (the page's originalFileName). */
  fileName: string | null
  startedAt: string
}

const storeKey = (kind: BackgroundBulkKind) => `mailsfinder_bg_bulk_job_${kind}`

export function getStoredBackgroundJob(kind: BackgroundBulkKind): StoredBackgroundJob | null {
  try {
    const raw = localStorage.getItem(storeKey(kind))
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed.jobId === 'string' ? (parsed as StoredBackgroundJob) : null
  } catch {
    return null
  }
}

export function storeBackgroundJob(kind: BackgroundBulkKind, job: StoredBackgroundJob) {
  try { localStorage.setItem(storeKey(kind), JSON.stringify(job)) } catch {}
  saveActiveJob(job.jobId)
}

export function clearStoredBackgroundJob(kind: BackgroundBulkKind) {
  const current = getStoredBackgroundJob(kind)
  try { localStorage.removeItem(storeKey(kind)) } catch {}
  if (current) removeActiveJob(current.jobId)
}

/** Thrown when the server definitely rejected the job (safe to retry with a new key). */
export class BackgroundJobRejected extends Error {}

/**
 * Submit one upload. `idempotencyKey` must stay the same if the request is
 * retried after a network failure, so a double submit can never start two jobs.
 */
export async function startBackgroundBulkJob(body: {
  type: BackgroundBulkKind
  idempotency_key: string
  filename: string | null
  filename_with_ext: string | null
  column_order: string[]
  rows?: Array<Record<string, unknown>>
  emails?: unknown[]
}): Promise<{ job_id: string; total: number }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  const resp = await fetch('/api/bulk-jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  let parsed: Record<string, unknown> = {}
  try { parsed = await resp.json() } catch {}
  if (!resp.ok || parsed.success === false) {
    const raw = typeof parsed.message === 'string' ? parsed.message : typeof parsed.error === 'string' ? parsed.error : ''
    const msg = humanizeApiError(raw, 'Failed to start the bulk job')
    // 4xx: the server answered and said no. 5xx / proxy errors: unknown outcome.
    if (resp.status >= 400 && resp.status < 500) throw new BackgroundJobRejected(msg)
    throw new Error(msg)
  }
  const data = (parsed.data ?? {}) as Record<string, unknown>
  const progress = (data.progress ?? {}) as Record<string, unknown>
  if (typeof data.job_id !== 'string') throw new Error('Failed to start the bulk job')
  return { job_id: data.job_id, total: Number(progress.total) || 0 }
}

/** The job's one combined result CSV — the same file the result email attaches. */
export async function fetchBackgroundJobCsv(jobId: string): Promise<string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
  const resp = await fetch(`/api/email/job/${encodeURIComponent(jobId)}/download`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
  })
  if (!resp.ok) throw new Error('Failed to download the results')
  return resp.text()
}

export function downloadCsvString(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

/** Status written by the server for rows a stopped job never processed (never charged). */
export const NOT_PROCESSED = 'not_processed'

/**
 * Bulk Finder result CSV → the per-row result fields and the completion
 * counts the page shows. Rows are in upload order, one per uploaded row.
 */
export function readFinderResultCsv(csv: string) {
  const parsed = Papa.parse<string[]>(csv, { header: false, skipEmptyLines: false })
  const [header = [], ...body] = parsed.data
  const col = (name: string) => header.indexOf(name)
  const at = (r: string[], name: string) => (col(name) >= 0 ? r[col(name)] ?? '' : '')
  const rows = body
    .filter((r) => !(r.length === 1 && r[0] === ''))
    .map((r) => {
      const confidence = at(r, 'Confidence')
      return {
        email: at(r, 'Email'),
        confidence: confidence === '' ? undefined : Number(confidence),
        result_status: at(r, 'Status'),
        catch_all: at(r, 'Catch All') === 'Yes',
        is_catch_all_domain: at(r, 'Catch-All Domain') === 'Yes',
        notice: at(r, 'Notice'),
        user_name: at(r, 'User Name'),
        mx: at(r, 'MX'),
        error: at(r, 'Error'),
      }
    })
  const processed = rows.filter((r) => r.result_status && r.result_status !== NOT_PROCESSED).length
  const found = rows.filter((r) => r.result_status === 'found').length
  const catchAll = rows.filter((r) => r.is_catch_all_domain)
  return {
    rows,
    processed,
    found,
    notFound: Math.max(0, processed - found),
    notProcessed: rows.filter((r) => r.result_status === NOT_PROCESSED).length,
    catchAllCount: catchAll.length,
    catchAllNotice: catchAll.find((r) => r.notice)?.notice || null,
  }
}

/** Bulk Verification result CSV → the result items the summary and table show. */
export function readVerifyResultCsv(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true })
  const bool = (v: string | undefined) => (v === 'true' ? true : v === 'false' ? false : undefined)
  const num = (v: string | undefined) => (v === undefined || v === '' ? undefined : Number(v))
  const str = (v: string | undefined) => (v ? v : undefined)
  return parsed.data.map((r) => ({
    email: r.email || '',
    status: r.status || '',
    catch_all: bool(r.catch_all),
    connections: num(r.connections),
    domain: str(r.domain),
    mx: str(r.mx),
    time_exec: num(r.time_exec),
    user_name: str(r.user_name),
    is_catch_all_domain: r.is_catch_all_domain === 'true' ? true : undefined,
    notice: str(r.notice),
  }))
}

/** A fresh idempotency key for one submit. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}

export const PAUSED_MESSAGE =
  'Processing paused: part of this file could not be processed after several attempts. ' +
  'Rows already processed are saved, and the unprocessed rows have not been charged. Please contact support.'
