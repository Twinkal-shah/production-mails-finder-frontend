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

  const { runInChunks, readSummaryCredits, sendBulkResultEmail } = await import('./ninja-bulk')
  const { humanizeApiError } = await import('./api-error')

  const lookups = requestPayload.lookups
  const total = lookups.length
  if (onProgress) onProgress(0, total)

  const postChunk = async (chunk: BulkFindItem[]) => {
    const doFetch = () => fetch(`${sameOrigin}/api/email/findBulkEmailNinja`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify(chunk),
      credentials: 'include',
      mode: 'cors'
    })
    let resp = await doFetch()
    // Handle 401 with token refresh
    if (resp.status === 401) {
      const refreshed = await tryRefresh()
      if (refreshed) resp = await doFetch()
    }
    let body: unknown
    try { body = await resp.json() } catch { body = {} }
    const obj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    if (!resp.ok || obj['success'] === false) {
      const rawMsg = typeof obj['message'] === 'string' ? obj['message'] : (typeof obj['error'] === 'string' ? obj['error'] : '')
      throw new Error(humanizeApiError(rawMsg, 'Failed to run bulk find'))
    }
    return { body, obj }
  }

  // Ninja returns a plain array (or wraps it in data / results). Unwrap it and
  // normalise each item to the shape the bulk workspace already understands.
  let totalCredits = 0
  let sawSummaryCredits = false
  const items = await runInChunks<BulkFindItem, Record<string, unknown>>(
    lookups,
    async (chunk) => {
      const { body, obj } = await postChunk(chunk)
      const list: unknown[] = Array.isArray(body)
        ? body
        : Array.isArray(obj['results'])
          ? (obj['results'] as unknown[])
          : Array.isArray(obj['data'])
            ? (obj['data'] as unknown[])
            : (typeof obj['data'] === 'object' && obj['data'] !== null && Array.isArray((obj['data'] as Record<string, unknown>)['results']))
              ? ((obj['data'] as Record<string, unknown>)['results'] as unknown[])
              : []
      const summaryCredits = readSummaryCredits(obj['summary'])
      if (typeof summaryCredits === 'number') {
        totalCredits += summaryCredits
        sawSummaryCredits = true
      }
      return chunk.map((lookup, i) => normalizeNinjaFindItem(list[i], lookup))
    },
    onProgress
  )

  // Credits: prefer a backend summary, otherwise sum per-item credits_used.
  if (!sawSummaryCredits) {
    totalCredits = items.reduce((sum, it) => sum + (typeof it.credits_used === 'number' ? it.credits_used : 0), 0)
  }

  // Every chunk is done — send the one completion email, with the complete
  // result set. Best-effort: never fail the run over the email.
  void sendBulkResultEmail('find', items, accessToken ?? undefined)

  return { items, totalCredits }
}

/**
 * Map one Ninja bulk-find result onto the legacy item shape consumed by the
 * bulk finder workspace (domain / confidence 0–100 / status found|invalid).
 */
function normalizeNinjaFindItem(raw: unknown, lookup: BulkFindItem): Record<string, unknown> {
  const obj: Record<string, unknown> = typeof raw === 'object' && raw !== null ? { ...(raw as Record<string, unknown>) } : {}
  const email = typeof obj.email === 'string' ? obj.email : ''

  // Keep the lookup identity on the item so row matching by domain still works
  if (typeof obj.domain !== 'string' || !obj.domain) obj.domain = lookup.domain
  if (typeof obj.first_name !== 'string') obj.first_name = lookup.first_name
  if (typeof obj.last_name !== 'string') obj.last_name = lookup.last_name

  // Status: Ninja uses found / not_found / guessed; legacy used found / invalid
  const statusRaw = typeof obj.status === 'string' ? obj.status.toLowerCase() : ''
  if (statusRaw === 'found' || statusRaw === 'valid') obj.status = 'found'
  else if (!email || statusRaw === 'not_found' || statusRaw === 'invalid' || statusRaw === 'failed') obj.status = 'invalid'
  else if (statusRaw) obj.status = statusRaw
  else obj.status = email ? 'found' : 'invalid'

  // Confidence on the 0–100 scale (Ninja `confidence` is 0–1)
  if (typeof obj.confidence_score === 'number') {
    obj.confidence = obj.confidence_score
  } else if (typeof obj.confidence === 'number' && obj.confidence <= 1) {
    obj.confidence = Math.round(obj.confidence * 100)
  }

  // Ninja flags catch-all domains as `catch_all`; legacy used is_catch_all_domain
  if (obj.is_catch_all_domain === undefined && obj.catch_all === true) obj.is_catch_all_domain = true

  if (typeof obj.user_name !== 'string' && email) obj.user_name = email.split('@')[0]
  return obj
}
