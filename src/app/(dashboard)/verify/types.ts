export interface EmailData {
  email: string
  status?: 'pending' | 'processing' | 'valid' | 'invalid' | 'unknown' | 'error' | 'risky'
  confidence?: number
  [key: string]: unknown
}

/**
 * One row of the bulk verification result set, exactly as it is assembled in
 * `page.tsx` from the V2 job payload. Type-only extraction — the shape is
 * unchanged.
 */
export interface VerifyResultItem {
  email: string
  status?: string
  catch_all?: boolean
  connections?: number
  domain?: string
  mx?: string
  reason?: string
  time_exec?: number
  user_name?: string
  is_catch_all_domain?: boolean
  notice?: string
}

export interface BulkVerificationJob {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused'
  totalEmails: number
  processedEmails?: number
  successfulVerifications?: number
  failedVerifications?: number
  emailsData?: EmailData[]
  errorMessage?: string
  filename?: string
  createdAt?: string
  updatedAt?: string
  completedAt?: string
}