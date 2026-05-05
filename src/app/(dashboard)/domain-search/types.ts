export interface DomainEmailResult {
  email: string
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  title?: string | null
  organization_name?: string | null
  linkedin_url?: string | null
  country?: string | null
  seniority_level?: string | null
  department?: string | null
  verification_status?: 'valid' | 'invalid' | 'risky' | null
  last_verified_at?: string | null
  confidence_score?: number | null
  sources?: string[]
}

export interface DomainPattern {
  pattern: string
  count: number
  percentage: number
}

export interface DomainSearchData {
  domain: string
  total: number
  page: number
  page_size: number
  mx_provider?: 'Google' | 'Microsoft' | string | null
  patterns?: DomainPattern[]
  results: DomainEmailResult[]
  is_preview: boolean
  upgrade_required?: boolean
  upgrade_message?: string
  source?: 'contacts_api' | 'mongo_fallback' | 'empty'
  hint?: 'no_mx' | 'no_data'
}

export interface DomainSearchEnvelope {
  success: boolean
  message?: string
  error?: string
  current_plan?: string
  data?: DomainSearchData
}

export const DOMAIN_REGEX = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z]{2,})+$/

export function normalizeDomainInput(value: string): string {
  let s = (value || '').trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '')
  s = s.split('/')[0]
  s = s.split('?')[0]
  s = s.split('#')[0]
  return s
}
