/**
 * Shared utility for polling V2 bulk job status.
 * Used by both bulk find and bulk verify flows.
 */

export interface JobProgress {
  total: number
  processed: number
}

export interface JobPollResult {
  job_id: string
  status: 'processing' | 'completed' | 'failed'
  progress: JobProgress
  summary?: {
    total: number
    upgrades?: number
    credits_charged?: number
    [key: string]: unknown
  }
  results?: Array<Record<string, unknown>>
  error?: string
  created_at?: string
  completed_at?: string
}

/**
 * Polls GET /api/email/job/:jobId until the job completes or fails.
 *
 * @param jobId       – The job_id returned by the V2 submit endpoint
 * @param authToken   – Bearer token for authorization
 * @param onProgress  – Called on every poll tick with current progress
 * @param intervalMs  – Polling interval (default 5 000 ms)
 * @returns The final completed job data (includes results array)
 * @throws  Error with the backend error message on failure
 */
export async function pollJob(
  jobId: string,
  authToken: string,
  onProgress: (progress: JobProgress) => void,
  intervalMs: number = 5000
): Promise<JobPollResult> {
  const sameOrigin =
    typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : ''

  while (true) {
    const response = await fetch(
      `${sameOrigin}/api/email/job/${encodeURIComponent(jobId)}`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        credentials: 'include',
      }
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Job poll failed (${response.status}): ${text}`)
    }

    const json = await response.json()
    const data: JobPollResult = json.data ?? json

    if (data.status === 'completed') {
      onProgress(data.progress)
      return data
    }

    if (data.status === 'failed') {
      throw new Error(data.error || 'Job processing failed')
    }

    // Still processing – report progress and wait
    onProgress(data.progress)
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
