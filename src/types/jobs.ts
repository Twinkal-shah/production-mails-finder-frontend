export interface JobHistoryItem {
  job_id: string
  type: 'bulk_find' | 'bulk_verify'
  status: 'processing' | 'completed' | 'failed'
  progress: { total: number; processed: number }
  upgrades: number
  credits_charged: number
  created_at: string
  completed_at: string | null
  error?: string
}

export interface JobDetail extends JobHistoryItem {
  summary?: Record<string, unknown>
  results?: Array<Record<string, unknown>>
}

export interface RecentFindResult {
  result: {
    email: string | null
    status: string
    domain: string
    mx?: string
    confidence_score: number
    safe_to_send?: boolean
    email_provider?: string
    credits_used?: number
    full_name?: string
  }
  created_at: string
}

export interface RecentVerifyResult {
  result: {
    email: string
    status: string
    domain?: string
    mx?: string
    confidence_score: number
    safe_to_send?: boolean
    email_provider?: string
    catch_all?: boolean
  }
  created_at: string
}
