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

export function chunk<T>(list: T[], size: number): T[][] {
  const res: T[][] = []
  for (let i = 0; i < list.length; i += size) res.push(list.slice(i, i + size))
  return res
}

export async function bulkFind(
  rows: Array<{ fullName: string; domain: string }>,
  startBatchSize = 5,
  maxConcurrency = 2,
  onProgress?: (completed: number, total: number) => void
): Promise<{ items: Array<Record<string, unknown>>; totalCredits: number }> {
  const payload = buildBulkFindPayload(rows)
  if (payload.length === 0) return { items: [], totalCredits: 0 }
  const total = payload.length
  let completed = 0
  let totalCredits = 0
  const out: Array<Record<string, unknown>> = []
  const apiBase = ((process.env.NEXT_PUBLIC_CORE_API_BASE || process.env.NEXT_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_LOCAL_URL || 'https://server.mailsfinder.com').replace(/\/+$/, '')) + '/api'
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
      const res = await fetch((sameOrigin ? `${sameOrigin}/api/user/auth/refresh` : `${apiBase}/user/auth/refresh`), {
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
  const batches = chunk(payload, 100)
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    try {
      let resp = await fetch((sameOrigin ? `${sameOrigin}/api/email/findBulkEmail` : `${apiBase}/email/findBulkEmail`), {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(batch),
        credentials: 'include',
        mode: 'cors'
      })
      let body: unknown
      try {
        body = await resp.json()
      } catch {
        body = {}
      }
      const bodyObj: Record<string, unknown> = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
      const bodySuccess = typeof bodyObj['success'] === 'boolean' ? (bodyObj['success'] as boolean) : undefined
      const bodyStatus = typeof bodyObj['status'] === 'number' ? (bodyObj['status'] as number) : undefined
      const bodyJwtError = typeof bodyObj['jwtError'] === 'boolean' ? (bodyObj['jwtError'] as boolean) : undefined
      const bodyMessage = typeof bodyObj['message'] === 'string' ? (bodyObj['message'] as string) : undefined
      if (!resp.ok || bodySuccess === false) {
        const status = resp.status || bodyStatus
        if (status === 401 || bodyJwtError === true || bodyMessage === 'unauthorized') {
          const refreshed = await tryRefresh()
          if (refreshed) {
            resp = await fetch((sameOrigin ? `${sameOrigin}/api/email/findBulkEmail` : `${apiBase}/email/findBulkEmail`), {
              method: 'POST',
              headers: buildHeaders(),
              body: JSON.stringify(batch),
              credentials: 'include',
              mode: 'cors'
            })
            try { body = await resp.json() } catch { body = {} }
            const retryObj: Record<string, unknown> = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
            const retrySuccess = typeof retryObj['success'] === 'boolean' ? (retryObj['success'] as boolean) : undefined
            const retryData = typeof retryObj['data'] === 'object' && retryObj['data'] !== null ? (retryObj['data'] as Record<string, unknown>) : undefined
            const retryResults = Array.isArray(retryData?.['results']) ? (retryData?.['results'] as Array<Record<string, unknown>>) : []
            const retryCredits = Number(retryData?.['totalCredits'] ?? 0)
            if (resp.ok && retrySuccess !== false) {
              totalCredits += retryCredits
              for (const it of retryResults) out.push(it)
            }
          }
        }
      } else {
        const dataObj: Record<string, unknown> | undefined = typeof bodyObj['data'] === 'object' && bodyObj['data'] !== null ? (bodyObj['data'] as Record<string, unknown>) : undefined
        const results = Array.isArray(dataObj?.['results']) ? (dataObj?.['results'] as Array<Record<string, unknown>>) : []
        const credits = Number(dataObj?.['totalCredits'] ?? 0)
        totalCredits += credits
        for (const it of results) out.push(it)
      }
    } finally {
      completed += batch.length
      if (onProgress) onProgress(completed, total)
    }
  }
  return { items: out, totalCredits }
}

export async function bulkFindBatched(
  rows: Array<{ fullName: string; domain: string }>,
  batchSize = 100,
  onProgress?: (completed: number, total: number, currentBatch: number, totalBatches: number) => void
): Promise<{ totalCredits: number }> {
  const payload = buildBulkFindPayload(rows)
  if (payload.length === 0) return { totalCredits: 0 }
  const total = payload.length
  let completed = 0
  let totalCredits = 0
  const apiBase = ((process.env.NEXT_PUBLIC_CORE_API_BASE || process.env.NEXT_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_LOCAL_URL || 'https://server.mailsfinder.com').replace(/\/+$/, '')) + '/api'
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
      const res = await fetch((sameOrigin ? `${sameOrigin}/api/user/auth/refresh` : `${apiBase}/user/auth/refresh`), {
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
  const batches = chunk(payload, batchSize)
  const totalBatches = batches.length
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    try {
      let resp = await fetch((sameOrigin ? `${sameOrigin}/api/email/findBulkEmail` : `${apiBase}/email/findBulkEmail`), {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(batch),
        credentials: 'include',
        mode: 'cors'
      })
      let body: unknown
      try {
        body = await resp.json()
      } catch {
        body = {}
      }
      const bodyObj: Record<string, unknown> = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
      const bodySuccess = typeof bodyObj['success'] === 'boolean' ? (bodyObj['success'] as boolean) : undefined
      const bodyStatus = typeof bodyObj['status'] === 'number' ? (bodyObj['status'] as number) : undefined
      const bodyJwtError = typeof bodyObj['jwtError'] === 'boolean' ? (bodyObj['jwtError'] as boolean) : undefined
      const bodyMessage = typeof bodyObj['message'] === 'string' ? (bodyObj['message'] as string) : undefined
      if (!resp.ok || bodySuccess === false) {
        const status = resp.status || bodyStatus
        if (status === 401 || bodyJwtError === true || bodyMessage === 'unauthorized') {
          const refreshed = await tryRefresh()
          if (refreshed) {
            resp = await fetch((sameOrigin ? `${sameOrigin}/api/email/findBulkEmail` : `${apiBase}/email/findBulkEmail`), {
              method: 'POST',
              headers: buildHeaders(),
              body: JSON.stringify(batch),
              credentials: 'include',
              mode: 'cors'
            })
            try { body = await resp.json() } catch { body = {} }
            const retryObj: Record<string, unknown> = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
            const retrySuccess = typeof retryObj['success'] === 'boolean' ? (retryObj['success'] as boolean) : undefined
            const retryData = typeof retryObj['data'] === 'object' && retryObj['data'] !== null ? (retryObj['data'] as Record<string, unknown>) : undefined
            const retryCredits = Number(retryData?.['totalCredits'] ?? 0)
            if (resp.ok && retrySuccess !== false) {
              totalCredits += retryCredits
            }
          }
        }
      } else {
        const dataObj: Record<string, unknown> | undefined = typeof bodyObj['data'] === 'object' && bodyObj['data'] !== null ? (bodyObj['data'] as Record<string, unknown>) : undefined
        const credits = Number(dataObj?.['totalCredits'] ?? 0)
        totalCredits += credits
      }
    } finally {
      completed += batch.length
      if (onProgress) onProgress(completed, total, i + 1, totalBatches)
    }
  }
  return { totalCredits }
}
