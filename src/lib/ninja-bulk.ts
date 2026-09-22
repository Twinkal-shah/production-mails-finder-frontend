/**
 * Shared helper for the Mailtester Ninja bulk endpoints.
 *
 * The Ninja bulk endpoints (findBulkEmailNinja / verifyBulkEmailNinja) are
 * synchronous: one request in, one response out. The previous V2 flow was an
 * async job that we polled, which is what drove the progress UI. To keep that
 * UI behaving the same (and to stay well inside proxy/function timeouts for
 * large uploads) we split the input into chunks and send them with a small
 * amount of concurrency, reporting progress after every chunk completes.
 *
 * Results are returned in input order so callers can align them with their
 * original rows by index.
 */

/** Rows per request. */
export const NINJA_BULK_CHUNK_SIZE = 20
/** Chunks in flight at once. */
export const NINJA_BULK_CONCURRENCY = 2

export function chunkList<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/**
 * Run `worker` over `items` in chunks. `worker` receives one chunk plus its
 * starting offset and must resolve to one output per input (same order).
 * `onProgress(processed, total)` fires after each chunk finishes.
 */
export async function runInChunks<TIn, TOut>(
  items: TIn[],
  worker: (chunk: TIn[], offset: number) => Promise<TOut[]>,
  onProgress?: (processed: number, total: number) => void,
  chunkSize: number = NINJA_BULK_CHUNK_SIZE,
  concurrency: number = NINJA_BULK_CONCURRENCY
): Promise<TOut[]> {
  const total = items.length
  const results: TOut[] = new Array(total)
  if (total === 0) return results

  const chunks = chunkList(items, chunkSize)
  let nextChunk = 0
  let processed = 0

  const runner = async () => {
    while (true) {
      const idx = nextChunk++
      if (idx >= chunks.length) return
      const offset = idx * chunkSize
      const chunk = chunks[idx]
      const out = await worker(chunk, offset)
      for (let i = 0; i < chunk.length; i++) {
        results[offset + i] = out[i]
      }
      processed += chunk.length
      if (onProgress) onProgress(processed, total)
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, chunks.length)) }, () => runner())
  await Promise.all(workers)
  return results
}

/** Pull a numeric credit total off a Ninja bulk `summary` object, if present. */
export function readSummaryCredits(summary: unknown): number | undefined {
  if (typeof summary !== 'object' || summary === null) return undefined
  const s = summary as Record<string, unknown>
  for (const key of ['credits_charged', 'credits_used', 'credits']) {
    if (typeof s[key] === 'number') return s[key] as number
  }
  return undefined
}

/**
 * Email the FINAL, complete CSV for a bulk run — called ONCE, after every
 * chunk has finished.
 *
 * The bulk endpoints are synchronous and we call them one 20-row chunk at a
 * time, so the backend cannot know when a run is over or what the whole
 * result set looks like. It therefore no longer emails per chunk (which sent
 * one partial CSV per request); we post the assembled results here instead.
 *
 * Best-effort: a failure here must never fail the run the user just watched
 * complete, so it resolves false rather than throwing.
 */
export async function sendBulkResultEmail(
  type: 'find' | 'verify',
  results: unknown[],
  token?: string
): Promise<boolean> {
  if (!Array.isArray(results) || results.length === 0) return false
  try {
    const resp = await fetch('/api/email/bulkResultEmail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      credentials: 'include',
      body: JSON.stringify({ type, results })
    })
    return resp.ok
  } catch {
    return false
  }
}
