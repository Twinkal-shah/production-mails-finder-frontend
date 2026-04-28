export type BulkFindItem = { domain: string; first_name: string; last_name: string }

export function toHostname(input: string): string {
  let s = (input || '').trim()
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
  s = s.toLowerCase()
  s = s.replace(/[^a-z0-9\.\-]/g, '')
  s = s.replace(/\.+/g, '.')
  s = s.replace(/^\.+|\.+$/g, '')
  const ok = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(s)
  return ok ? s : ''
}

export function buildBulkFindPayload(rows: Array<{ fullName: string; domain: string }>): BulkFindItem[] {
  const out: BulkFindItem[] = []
  for (const r of rows) {
    const host = toHostname(r.domain)
    if (!host) continue
    const normalizedName = (r.fullName || '')
      .trim()
      .replace(/[\/,._\-@#$%]+/g, ' ')
    const parts = normalizedName.split(/\s+/)
    const firstRaw = parts[0] || ''
    const lastRaw = parts.slice(1).join(' ') || ''
    const first = firstRaw.toLowerCase().replace(/[^a-z]/g, '')
    const last = lastRaw.toLowerCase().replace(/[^a-z]/g, '')
    if (!first && !last) continue
    out.push({ domain: host, first_name: first, last_name: last })
  }
  return out
}

export interface BulkFindRequest {
  original_filename?: string
  rows: Array<Record<string, unknown>>
  lookups: BulkFindItem[]
}

export function buildBulkFindRequest(
  inputRows: Array<Record<string, unknown> & { fullName: string; domain: string }>,
  headerAllowList: string[],
  originalFilename: string | null
): BulkFindRequest {
  const rows: Array<Record<string, unknown>> = []
  const lookups: BulkFindItem[] = []

  for (const r of inputRows) {
    const host = toHostname(r.domain)
    if (!host) continue
    const normalizedName = (r.fullName || '')
      .trim()
      .replace(/[\/,._\-@#$%]+/g, ' ')
    const parts = normalizedName.split(/\s+/)
    const firstRaw = parts[0] || ''
    const lastRaw = parts.slice(1).join(' ') || ''
    const first = firstRaw.toLowerCase().replace(/[^a-z]/g, '')
    const last = lastRaw.toLowerCase().replace(/[^a-z]/g, '')
    if (!first && !last) continue

    const originalRow: Record<string, unknown> = {}
    for (const col of headerAllowList) {
      originalRow[col] = r[col]
    }

    rows.push(originalRow)
    lookups.push({ domain: host, first_name: first, last_name: last })
  }

  if (rows.length !== lookups.length) {
    throw new Error(`bulk-find: rows/lookups length mismatch (${rows.length} vs ${lookups.length})`)
  }

  const payload: BulkFindRequest = { rows, lookups }
  if (originalFilename) payload.original_filename = originalFilename
  return payload
}

export function chunk<T>(list: T[], size: number): T[][] {
  const res: T[][] = []
  for (let i = 0; i < list.length; i += size) res.push(list.slice(i, i + size))
  return res
}

export async function bulkFind(
  rows: Array<Record<string, unknown> & { fullName: string; domain: string }>,
  originalFilename: string | null,
  headerAllowList: string[],
  _startBatchSize = 5,
  _maxConcurrency = 2,
  onProgress?: (processed: number, total: number) => void
): Promise<{ items: Array<Record<string, unknown>>; totalCredits: number }> {
  const requestPayload = buildBulkFindRequest(rows, headerAllowList, originalFilename)
  if (requestPayload.rows.length === 0) return { items: [], totalCredits: 0 }

  const sameOrigin = typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : ''
  let accessToken: string | null = (typeof window !== 'undefined' ? localStorage.getItem('access_token') : null)
  let refreshToken: string | null = (typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null)

  const buildHeaders = () => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  })

  const tryRefresh = async () => {
    if (!refreshToken) return false
    try {
      const res = await fetch(`${sameOrigin}/api/user/auth/refresh`, {
        method: 'GET',
        headers: { refreshtoken: `Bearer ${refreshToken}` },
        credentials: 'include',
        mode: 'cors'
      })
      const body = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok || (body as Record<string, unknown>)?.['success'] === false) return false
      const data = (body as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined
      const newAccess = typeof data?.['access_token'] === 'string' ? (data['access_token'] as string) : undefined
      const newRefresh = typeof data?.['refresh_token'] === 'string' ? (data['refresh_token'] as string) : undefined
      if (newAccess) {
        accessToken = newAccess
        if (typeof window !== 'undefined') localStorage.setItem('access_token', newAccess)
      }
      if (newRefresh) {
        refreshToken = newRefresh
        if (typeof window !== 'undefined') localStorage.setItem('refresh_token', newRefresh)
      }
      return !!newAccess
    } catch {
      return false
    }
  }

  // --- Step 1: Submit to V2 endpoint and get job_id ---
  let resp = await fetch(`${sameOrigin}/api/email/findBulkEmailV2`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(requestPayload),
    credentials: 'include',
    mode: 'cors'
  })

  // Handle 401 with token refresh
  if (resp.status === 401) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      resp = await fetch(`${sameOrigin}/api/email/findBulkEmailV2`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(requestPayload),
        credentials: 'include',
        mode: 'cors'
      })
    }
  }

  let submitBody: unknown
  try { submitBody = await resp.json() } catch { submitBody = {} }
  const submitObj = typeof submitBody === 'object' && submitBody !== null ? (submitBody as Record<string, unknown>) : {}

  if (!resp.ok || submitObj['success'] === false) {
    const msg = typeof submitObj['message'] === 'string' ? submitObj['message'] : 'Failed to submit bulk find job'
    throw new Error(msg)
  }

  const submitData = submitObj['data'] as Record<string, unknown> | undefined
  const jobId = typeof submitData?.['job_id'] === 'string' ? submitData['job_id'] as string : undefined
  if (!jobId) throw new Error('No job_id returned from V2 endpoint')

  // Report initial progress
  if (onProgress) {
    const initProgress = submitData?.['progress'] as Record<string, unknown> | undefined
    const total = Number(initProgress?.['total'] ?? requestPayload.lookups.length)
    onProgress(0, total)
  }

  // --- Step 2: Poll for completion ---
  const { pollJob } = await import('./poll-job')
  const result = await pollJob(
    jobId,
    accessToken || '',
    (progress) => {
      if (onProgress) onProgress(progress.processed, progress.total)
    },
    5000
  )

  // --- Step 3: Return results in the same format as V1 ---
  const items = Array.isArray(result.results) ? result.results : []
  const totalCredits = Number(result.summary?.credits_charged ?? 0)
  return { items, totalCredits }
}
