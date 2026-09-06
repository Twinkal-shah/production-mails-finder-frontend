'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Download, 
  Upload, 
  Trash2, 
  Plus, 
  Minus, 
  AlertCircle,
  History,
  Send,
  Eye,
  EyeOff,
  Copy,
  ChevronDown,
  PlugZap,
  KeyRound,
  TerminalSquare,
  Lock,
  ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { 
  HttpMethod, 
  HeaderPair, 
  ApiRequest, 
  ApiResponse, 
  RequestHistory, 
  PredefinedEndpoint,
  ApiTestingState 
} from '@/types/api-testing'
import { JsonEditor } from '@/components/api-testing/json-editor'
import { ResponseViewer } from '@/components/api-testing/response-viewer'
import { useUserProfile } from '@/hooks/useCreditsData'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter, 
  DialogClose 
} from '@/components/ui/dialog'

// Public backend base URL shown in the docs and used for absolute (API-key) calls.
// Driven by the same env var the rest of the app uses; falls back to production.
const PUBLIC_API_BASE = (process.env.NEXT_PUBLIC_SERVER_URL || 'https://api.mailsfinder.com').replace(/\/+$/, '')

// Predefined endpoints for testing
const PREDEFINED_ENDPOINTS: PredefinedEndpoint[] = [
  {
    name: 'Ping',
    method: 'GET',
    url: '/api/ping',
    description: 'Simple connectivity check via Next.js rewrite to backend',
    headers: [
      { id: '1', key: 'Accept', value: 'text/plain', enabled: true }
    ]
  },
  {
    name: 'Health Check',
    method: 'GET',
    url: '/api/health',
    description: 'Check API health status',
    headers: [
      { id: '1', key: 'Content-Type', value: 'application/json', enabled: true }
    ]
  },
  {
    name: 'User Login',
    method: 'POST',
    url: '/api/user/login',
    description: 'Login via same-origin proxy. Returns tokens and user (no password).',
    headers: [
      { id: '1', key: 'Content-Type', value: 'application/json', enabled: true }
    ],
    body: JSON.stringify({
      email: 'someone@example.com',
      password: 'password'
    }, null, 2)
  },
  {
    name: 'User Signup (Proxied)',
    method: 'POST',
    url: process.env.NEXT_PUBLIC_BACKEND_SIGNUP_PATH || '/api/user/signup',
    description: 'Create account via backend proxied path. Required fields: email, password, firstName, lastName, phone. Set NEXT_PUBLIC_BACKEND_SIGNUP_PATH to override.',
    headers: [
      { id: '1', key: 'Content-Type', value: 'application/json', enabled: true }
    ],
    body: JSON.stringify({
      email: 'someone@example.com',
      password: 'password',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      company: 'Acme Inc'
    }, null, 2)
  },
  {
    name: 'User Me (Proxied)',
    method: 'GET',
    url: '/api/user/me',
    description: 'Get current user using backend session/cookies to confirm login works.',
    headers: [
      { id: '1', key: 'Accept', value: 'application/json', enabled: true }
    ]
  },
  {
    name: 'Email • Find',
    method: 'POST',
    url: '/api/email/findEmail',
    description: 'Find email by name and domain (JWT required)',
    headers: [
      { id: '1', key: 'Content-Type', value: 'application/json', enabled: true },
      { id: '2', key: 'Authorization', value: 'Bearer ACCESS_TOKEN', enabled: true }
    ],
    body: JSON.stringify({
      domain: 'example.com',
      first_name: 'John',
      last_name: 'Doe'
    }, null, 2)
  },
  {
    name: 'Email • Find Bulk',
    method: 'POST',
    url: '/api/email/findBulkEmail',
    description: 'Find emails in bulk (array of name+domain objects)',
    headers: [
      { id: '1', key: 'Content-Type', value: 'application/json', enabled: true },
      { id: '2', key: 'Authorization', value: 'Bearer ACCESS_TOKEN', enabled: true }
    ],
    body: JSON.stringify([
      { domain: 'example.com', first_name: 'John', last_name: 'Doe' },
      { domain: 'example.com', first_name: 'Jane', last_name: 'Smith' }
    ], null, 2)
  },
  {
    name: 'Email • Verify Bulk',
    method: 'POST',
    url: '/api/email/verifyBulkEmail',
    description: 'Verify a list of emails',
    headers: [
      { id: '1', key: 'Content-Type', value: 'application/json', enabled: true },
      { id: '2', key: 'Authorization', value: 'Bearer ACCESS_TOKEN', enabled: true }
    ],
    body: JSON.stringify({
      emails: ['john.doe@example.com', 'jane.smith@example.com']
    }, null, 2)
  },
  {
    name: 'Email • Verify',
    method: 'POST',
    url: '/api/email/verifyEmail',
    description: 'Verify a single email (JWT required)',
    headers: [
      { id: '1', key: 'Content-Type', value: 'application/json', enabled: true },
      { id: '2', key: 'Authorization', value: 'Bearer ACCESS_TOKEN', enabled: true }
    ],
    body: JSON.stringify({
      email: 'john.doe@example.com'
    }, null, 2)
  },
  {
    name: 'API-Key • List',
    method: 'GET',
    url: `${PUBLIC_API_BASE}/api/api-key/getApiKeys`,
    description: 'List all API keys (JWT required)',
    headers: [
      { id: '1', key: 'Authorization', value: 'Bearer ACCESS_TOKEN', enabled: true }
    ]
  },
  {
    name: 'API-Key • Create',
    method: 'POST',
    url: `${PUBLIC_API_BASE}/api/api-key/createApiKey`,
    description: 'Create a new API key (JWT required)',
    headers: [
      { id: '1', key: 'Content-Type', value: 'application/json', enabled: true },
      { id: '2', key: 'Authorization', value: 'Bearer ACCESS_TOKEN', enabled: true }
    ],
     body: JSON.stringify({
      keyName: 'Production Client',
      rateLimitPerMinute: 60
    }, null, 2)
  },
  {
    name: 'API-Key • Deactivate',
    method: 'DELETE',
    url: `${PUBLIC_API_BASE}/api/api-key/deactivateAPIKey/REPLACE_KEY_ID`,
    description: 'Deactivate an API key by ID (JWT required)',
    headers: [
      { id: '1', key: 'Authorization', value: 'Bearer ACCESS_TOKEN', enabled: true }
    ]
  }
]

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']

type ApiDoc = {
  id: string
  name: string
  method: HttpMethod
  url: string
  displayUrl?: string
  description: string
  headers: Record<string, string>
  requestBody?: unknown
  requestBodyAlt?: unknown
  success: unknown
  error: unknown
  responseFields?: Record<string, string>
  statusCodes?: Record<string, string>
}

const stringifyJson = (obj: unknown) => (typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2))

const buildCurl = (method: string, url: string, headers: Record<string, string>, body?: unknown) => {
  const lines: string[] = [`curl -X ${method} "${url}" \\`]
  const headerLines: string[] = []
  for (const [k, v] of Object.entries(headers)) {
    headerLines.push(`  -H "${k}: ${v}" \\`)
  }
  if (body !== undefined) {
    const jsonPretty = typeof body === 'string' ? body : JSON.stringify(body, null, 2)
    const singleQuotedJson = jsonPretty.replace(/'/g, `'\\''`)
    lines.push(...headerLines)
    lines.push(`  -d '${singleQuotedJson}'`)
  } else {
    if (headerLines.length > 0) {
      const last = headerLines[headerLines.length - 1]
      headerLines[headerLines.length - 1] = last.replace(/ \\\\$/, '')
    }
    lines.push(...headerLines)
  }
  return lines.join('\n')
}

const buildJs = (method: string, url: string, headers: Record<string, string>, body?: unknown) => {
  let s = `await fetch("${url}", {\n  method: "${method}",\n  headers: ${JSON.stringify(headers, null, 2)}`
  if (body !== undefined) s += `,\n  body: JSON.stringify(${JSON.stringify(body, null, 2)})`
  s += `\n})`
  return s
}

const getStr = (obj: Record<string, unknown> | null | undefined, key: string): string => {
  if (!obj) return ''
  const v = obj[key]
  return typeof v === 'string' ? v : ''
}

const getNum = (obj: Record<string, unknown> | null | undefined, key: string): number => {
  if (!obj) return 0
  const v = obj[key]
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return isNaN(n) ? 0 : n
  }
  return 0
}

const buildPy = (method: string, url: string, headers: Record<string, string>, body?: unknown) => {
  const m = method.toLowerCase()
  let s = `import requests\nr = requests.${m}("${url}", headers=${JSON.stringify(headers, null, 2)}`
  if (body !== undefined) s += `, json=${JSON.stringify(body, null, 2)}`
  s += `)\nprint(r.json())`
  return s
}

// keep helper but marked unused intentionally
const _extractTypes = (obj: unknown): { key: string; type: string }[] => {
  if (!obj || typeof obj !== 'object') return []
  const out: { key: string; type: string }[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    let t = Array.isArray(v) ? 'array' : typeof v
    if (v === null) t = 'null'
    out.push({ key: k, type: t })
  }
  return out
}

const API_DOCS: ApiDoc[] = [

  {
    id: 'doc-email-find',
    name: 'Email • Find',
    method: 'POST',
    url: `${PUBLIC_API_BASE}/api/access-key/email/findEmail`,
    displayUrl: `${PUBLIC_API_BASE}/api/access-key/email/findEmail`,
    description: 'Find email by name and domain',
    headers: { 'Authorization': 'Bearer YOUR_API_KEY', 'Content-Type': 'application/json' },
    requestBody: { first_name: 'John', last_name: 'Doe', domain: 'example.com' },
    requestBodyAlt: { full_name: 'John Doe', domain: 'example.com' },
    success: { success: true, data: { email: 'john.doe@example.com', confidence: 95, status: 'found', catch_all: false, domain: 'example.com', mx: 'mx.example.com', time_exec: 350, user_name: 'john', connections: 3, ver_ops: 1 }, message: 'Email found' },
    error: { error: { message: 'Invalid JSON in request body', code: 400 } },
    responseFields: {
      email: "The email address found or generated based on the provided name + domain.",
      status: "Whether the email was found (found / not_found / unknown).",
      confidence: "Score (0–100) predicting how accurate the found/generated email is.",
      catch_all: "Indicates whether the domain accepts all emails.",
      domain: "The domain used during lookup.",
      mx: "Mail server (MX record) used by the domain.",
      time_exec: "Time taken to process the request.",
      user_name: "Username portion generated from the name.",
      connections: "Number of SMTP connections attempted.",
      ver_ops: "Number of verification operations executed."
    },
    statusCodes: {
      "200": "We found the email successfully.",
      "400": "You forgot to enter required information.",
      "401": "You are not logged in.",
      "500": "Something went wrong on our side."
    }
  },
  {
    id: 'doc-email-find-bulk',
    name: 'Email • Find Bulk',
    method: 'POST',
    url: `${PUBLIC_API_BASE}/api/access-key/email/findBulkEmail`,
    displayUrl: `${PUBLIC_API_BASE}/api/access-key/email/findBulkEmail`,
    description: 'Find emails in bulk',
    headers: { 'Authorization': 'Bearer YOUR_API_KEY', 'Content-Type': 'application/json' },
    requestBody: [
      { domain: 'example.com', first_name: 'John', last_name: 'Doe' },
      { domain: 'example.com', first_name: 'Jane', last_name: 'Smith' },
      { domain: 'example.com', first_name: 'Alex', last_name: 'Johnson' }
    ],
    success: { success: true, data: { results: [ { email: 'john.doe@example.com', confidence: 95, status: 'found', domain: 'example.com', first_name: 'John', last_name: 'Doe' }, { email: null, confidence: 0, status: 'not_found', domain: 'example.com', first_name: 'Jane', last_name: 'Smith' } ], totalCredits: 2 } },
    error: { error: { message: 'Unauthorized', code: 401 } },
    responseFields: {
      results: "List of results for each name/domain entry.",
      "results[].email": "The email found for this entry (or null if not found).",
      "results[].confidence": "Score (0–100) for each individual email prediction.",
      "results[].status": "Result for each: found / not_found / unknown.",
      "results[].domain": "Domain used for this lookup.",
      "results[].first_name": "First name provided for this entry.",
      "results[].last_name": "Last name provided for this entry.",
      totalCredits: "Number of credits consumed for the entire bulk operation."
    },
    statusCodes: {
      "200": "All emails were processed.",
      "400": "The list you sent is incorrect or incomplete.",
      "401": "You are not logged in.",
      "429": "You sent too many requests at once.",
      "500": "Something went wrong while processing emails."
    }
  },
  {
    id: 'doc-email-verify-bulk',
    name: 'Email • Verify Bulk',
    method: 'POST',
    url: `${PUBLIC_API_BASE}/api/access-key/email/verifyBulkEmail`,
    displayUrl: `${PUBLIC_API_BASE}/api/access-key/email/verifyBulkEmail`,
    description: 'Verify a list of emails',
    headers: { 'Authorization': 'Bearer YOUR_API_KEY', 'Content-Type': 'application/json' },
    requestBody: { emails: ['john.doe@example.com', 'jane.smith@example.com'] },
    success: { success: true, data: { results: [ { email: 'john.doe@example.com', status: 'valid', confidence: 90, deliverable: true, reason: 'Accepted', catch_all: false, domain: 'example.com', mx: 'mx.example.com' }, { email: 'jane.smith@example.com', status: 'invalid', confidence: 0, deliverable: false, reason: 'Undeliverable' } ], totalCredits: 2 } },
    error: { error: { message: 'email list is required', code: 400 } },
    responseFields: {
      results: "List of verification results for each email.",
      "results[].email": "Email address being checked.",
      "results[].status": "valid / invalid / unknown.",
      "results[].confidence": "Verification confidence score.",
      "results[].deliverable": "Whether the email can receive messages.",
      "results[].reason": "Explanation from SMTP server.",
      "results[].catch_all": "Whether this domain accepts all emails.",
      "results[].domain": "Domain of the email.",
      "results[].mx": "Mail server used for verification.",
      totalCredits: "Credits used for the entire verification request."
    },
    statusCodes: {
      "200": "All emails were checked.",
      "400": "Your list of emails is missing or incorrect.",
      "401": "You are not logged in.",
      "429": "You tried verifying too many emails too fast.",
      "500": "Verification failed due to server issues."
    }
  },
  {
    id: 'doc-email-verify',
    name: 'Email • Verify',
    method: 'POST',
    url: `${PUBLIC_API_BASE}/api/access-key/email/verifyEmail`,
    displayUrl: `${PUBLIC_API_BASE}/api/access-key/email/verifyEmail`,
    description: 'Verify a single email',
    headers: { 'Authorization': 'Bearer YOUR_API_KEY', 'Content-Type': 'application/json' },
    requestBody: { email: 'john.doe@example.com' },
    success: { success: true, data: { email: 'john.doe@example.com', status: 'valid', confidence: 80, deliverable: true, reason: 'OK', catch_all: false, domain: 'example.com', mx: 'mx.example.com', user_name: 'john' }, message: 'Verified' },
    error: { error: { message: 'email is required', code: 400 } },
    responseFields: {
      email: "The email address that was verified.",
      status: "valid / invalid / unknown based on verification.",
      confidence: "Score indicating verification certainty.",
      deliverable: "Whether the mailbox can actually receive emails.",
      reason: "SMTP server message explaining the status.",
      catch_all: "Whether the domain accepts all addresses.",
      domain: "The domain of the email.",
      mx: "Mail server used during verification.",
      user_name: "Username portion extracted from the email."
    },
    statusCodes: {
      "200": "The email was checked successfully.",
      "400": "You did not include the email to verify.",
      "401": "You are not logged in.",
      "422": "The email format is incorrect.",
      "500": "The mail server did not respond or failed."
    }
  }
]

const REQUIRED_FIELDS: Record<string, Array<{ field: string; required: boolean; description: string }>> = {
  'doc-email-find': [
    { field: 'first_name', required: true, description: "Person’s first name" },
    { field: 'last_name', required: true, description: "Person’s last name" },
    { field: 'domain', required: true, description: "Company domain" }
  ],
  'doc-email-verify': [
    { field: 'email', required: true, description: "Email address to verify" }
  ],
  'doc-email-find-bulk': [
    { field: 'items[]', required: true, description: "List of objects with first_name, last_name, domain" }
  ],
  'doc-email-verify-bulk': [
    { field: 'emails[]', required: true, description: "List of email addresses" }
  ]
}

const statusBadgeClass = (status?: string) => {
  const s = (status || '').toLowerCase()
  const key = s === 'found' ? 'valid' : s === 'not_found' ? 'invalid' : s
  switch (key) {
    case 'valid': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    case 'risky': return 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    case 'invalid': return 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    default: return 'bg-muted text-muted-foreground border-border'
  }
}

const statusLabel = (status?: string) => {
  const s = (status || '').toLowerCase()
  if (s === 'found') return 'Valid'
  if (s === 'not_found') return 'Invalid'
  if (s === 'valid') return 'Valid'
  if (s === 'invalid') return 'Invalid'
  if (s === 'risky') return 'Risky'
  return 'Unknown'
}

export default function ApiCallsPage() {
  const router = useRouter()
  const { data: profile, isLoading: profileLoading } = useUserProfile()
  const [state, setState] = useState<ApiTestingState>({
    currentRequest: {
      id: crypto.randomUUID(),
      name: 'New Request',
      method: 'GET',
      url: '',
      headers: [
        { id: crypto.randomUUID(), key: 'Content-Type', value: 'application/json', enabled: true }
      ],
      body: '',
      timestamp: Date.now()
    },
    response: null,
    isLoading: false,
    error: null,
    history: [],
    selectedHistoryId: null
  })

  const [activeTab, setActiveTab] = useState('docs')
  const restricted = !profileLoading && (profile?.plan === 'free' || profile?.plan === 'payg')
  const handleUpgrade = () => {
    router.push('/credits')
  }

  useEffect(() => {
    if (restricted) {
      router.replace('/credits')
    }
  }, [restricted, router])

  // --- keep the ApiKeyRecord type but ensure we use this shape in UI ---
  type ApiKeyRecord = {
    id: string
    key_name?: string
    api_key?: string | undefined
    key_prefix?: string | undefined
    is_active?: boolean
    rate_limit_per_minute?: number
    usage_count?: number
    created_at?: string
    last_used_at?: string | null
  }

  // helper: normalize backend item -> ApiKeyRecord
  const normalizeKey = useCallback((raw: unknown): ApiKeyRecord => {
    if (!raw || typeof raw !== 'object') return { id: '' }
    const r = raw as Record<string, unknown>

    const id = String(r['_id'] ?? r['id'] ?? '')
    const key_name = (r['keyName'] ?? r['key_name'] ?? '') as string
    const api_key = typeof r['apiKey'] === 'string' ? (r['apiKey'] as string)
                  : typeof r['api_key'] === 'string' ? (r['api_key'] as string)
                  : undefined
    const key_prefix = typeof r['keyPrefix'] === 'string' ? (r['keyPrefix'] as string)
                    : typeof r['key_prefix'] === 'string' ? (r['key_prefix'] as string)
                    : undefined
    const is_active = typeof r['isActive'] === 'boolean' ? (r['isActive'] as boolean) : !!r['is_active']
    const rate_limit_per_minute = typeof r['rateLimitPerMinute'] === 'number' ? (r['rateLimitPerMinute'] as number)
                               : typeof r['rate_limit_per_minute'] === 'number' ? (r['rate_limit_per_minute'] as number)
                               : undefined
    const usage_count = typeof r['usageCount'] === 'number' ? (r['usageCount'] as number)
                      : typeof r['usage_count'] === 'number' ? (r['usage_count'] as number)
                      : 0
    const created_at = (r['createdAt'] ?? r['created_at'] ?? '') as string
    const last_used_at = (r['lastUsedAt'] ?? r['last_used_at'] ?? null) as string | null

    return {
      id,
      key_name,
      api_key,
      key_prefix,
      is_active,
      rate_limit_per_minute,
      usage_count,
      created_at,
      last_used_at
    }
  }, [])

  // Interactive Endpoint Quickstart: selected endpoint + code language.
  const [selectedDocId, setSelectedDocId] = useState<string>(API_DOCS[0]?.id ?? '')
  const [codeLang, setCodeLang] = useState<'curl' | 'node' | 'python'>('curl')

  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [creatingKey, setCreatingKey] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  type DocTabKey = 'overview' | 'request' | 'response'
  const [docTabs, setDocTabs] = useState<Record<string, DocTabKey>>({})
  const setDocTab = useCallback((id: string, tab: DocTabKey) => {
    setDocTabs(prev => ({ ...prev, [id]: tab }))
  }, [])
  const toggleDoc = useCallback((id: string) => {
    setOpenDocId(prev => (prev === id ? null : id))
    setDocTabs(prev => ({ ...prev, [id]: 'overview' }))
  }, [])
  const [tryFindFirst, setTryFindFirst] = useState('')
  const [tryFindLast, setTryFindLast] = useState('')
  const [tryFindDomain, setTryFindDomain] = useState('')
  const [tryFindLoading, setTryFindLoading] = useState(false)
  const [tryFindResult, setTryFindResult] = useState<unknown>(null)
  const [tryFindDuration, setTryFindDuration] = useState<number | null>(null)
  const [tryVerifyEmail, setTryVerifyEmail] = useState('')
  const [tryVerifyLoading, setTryVerifyLoading] = useState(false)
  const [tryVerifyResult, setTryVerifyResult] = useState<unknown>(null)
  const [tryVerifyDuration, setTryVerifyDuration] = useState<number | null>(null)
  const [tryFindBulkText, setTryFindBulkText] = useState('')
  const [tryFindBulkLoading, setTryFindBulkLoading] = useState(false)
  const [tryFindBulkResult, setTryFindBulkResult] = useState<unknown>(null)
  const [tryFindBulkDuration, setTryFindBulkDuration] = useState<number | null>(null)
  const [tryVerifyBulkText, setTryVerifyBulkText] = useState('')
  const [tryVerifyBulkLoading, setTryVerifyBulkLoading] = useState(false)
  const [tryVerifyBulkResult, setTryVerifyBulkResult] = useState<unknown>(null)
  const [tryVerifyBulkDuration, setTryVerifyBulkDuration] = useState<number | null>(null)
  const [showRawJson, setShowRawJson] = useState<Record<string, boolean>>({})
  

  const unwrapData = <T,>(root: unknown): T | null => {
    if (root && typeof root === 'object') {
      const obj = root as Record<string, unknown>
      const d = obj['data'] as T | undefined
      return (d ?? (root as T)) || null
    }
    return null
  }

  const maskKey = (key?: string, prefix?: string) => {
    if (key && key.length > 8) {
      const start = key.slice(0, 4)
      const end = key.slice(-4)
      return `${start}••••••••${end}`
    }
    if (prefix) return prefix
    return '••••••••'
  }

  const fetchApiKeys = useCallback(async () => {
    setKeysLoading(true)
    try {
      const res = await apiGet<unknown>('/api/api-key/getApiKeys', { useProxy: true, includeAuth: true })
      if (!res.ok) {
        const msg = typeof res.error === 'string' ? res.error : (res.error && typeof res.error === 'object' && 'message' in res.error ? String((res.error as Record<string, unknown>).message) : 'Failed to fetch API keys')
        toast.error(msg)
        setApiKeys([])
        return
      }

      const listRaw = unwrapData<unknown>(res.data)
      const arr = Array.isArray(listRaw) ? listRaw : []
      const mappedList = arr.map(item => normalizeKey(item))
      setApiKeys(mappedList.filter(k => k.is_active))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch API keys'
      toast.error(msg)
      setApiKeys([])
    } finally {
      setKeysLoading(false)
    }
  }, [normalizeKey])

  

  const handleCreateKey = async () => {
    const name = newKeyName.trim()
    if (!name) {
      toast.error('Key name is required')
      return
    }
    setCreatingKey(true)
    try {
      const res = await apiPost<unknown>('/api/api-key/createApiKey', { keyName: name }, { useProxy: true, includeAuth: true })
      if (!res.ok) {
        const msg = typeof res.error === 'string' ? res.error : (res.error && typeof res.error === 'object' && 'message' in res.error ? String((res.error as Record<string, unknown>).message) : 'Failed to create API key')
        toast.error(msg)
        return
      }

      const root = res.data as Record<string, unknown>
      const message = typeof root?.message === 'string' ? root.message : 'API key created'
      toast.success(message)

      // createdRaw typed as unknown; narrow before use
      let createdRaw: unknown = null
      if (root && typeof root === 'object' && 'data' in root) {
        createdRaw = (root as Record<string, unknown>)['data']
      } else {
        createdRaw = res.data
      }

      if (createdRaw && typeof createdRaw === 'object') {
        const created = normalizeKey(createdRaw)
        if (created.id) {
          setApiKeys(prev => [created, ...prev])
          setRevealed(prev => ({ ...prev, [created.id]: true })) // auto-reveal new key
        }
      }

      setNewKeyName('')
      await fetchApiKeys()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create API key'
      toast.error(msg)
    } finally {
      setCreatingKey(false)
    }
  }

  const handleDeactivate = async (id: string) => {
    setDeactivatingId(id)
    try {
      const res = await apiDelete<unknown>(`/api/api-key/deactivateAPIKey/${id}`, { useProxy: true, includeAuth: true })
      if (!res.ok) {
        const msg = typeof res.error === 'string' ? res.error : (res.error && typeof res.error === 'object' && 'message' in res.error ? String((res.error as Record<string, unknown>).message) : 'Failed to deactivate API key')
        toast.error(msg)
        return
      }
      const root = res.data as Record<string, unknown>
      const message = typeof root?.message === 'string' ? root.message : 'API key deactivated'
      toast.success(message)
      await fetchApiKeys()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to deactivate API key'
      toast.error(msg)
    } finally {
      setDeactivatingId(null)
    }
  }

  // Load history from localStorage on mount
  useEffect(() => {
    fetchApiKeys()
    const savedHistory = localStorage.getItem('api-testing-history')
    if (savedHistory) {
      try {
        const history = JSON.parse(savedHistory)
        setState(prev => ({ ...prev, history }))
      } catch (error) {
        console.error('Failed to load history:', error)
      }
    }
  }, [fetchApiKeys])

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (state.history.length > 0) {
      localStorage.setItem('api-testing-history', JSON.stringify(state.history))
    }
  }, [state.history])

  const updateCurrentRequest = useCallback((updates: Partial<ApiRequest>) => {
    setState(prev => ({
      ...prev,
      currentRequest: { ...prev.currentRequest, ...updates }
    }))
  }, [])

  const addHeader = () => {
    const newHeader: HeaderPair = {
      id: crypto.randomUUID(),
      key: '',
      value: '',
      enabled: true
    }
    updateCurrentRequest({
      headers: [...state.currentRequest.headers, newHeader]
    })
  }

  const updateHeader = (id: string, updates: Partial<HeaderPair>) => {
    const updatedHeaders = state.currentRequest.headers.map(header =>
      header.id === id ? { ...header, ...updates } : header
    )
    updateCurrentRequest({ headers: updatedHeaders })
  }

  const removeHeader = (id: string) => {
    const filteredHeaders = state.currentRequest.headers.filter(header => header.id !== id)
    updateCurrentRequest({ headers: filteredHeaders })
  }

  const loadPredefinedEndpoint = (endpoint: PredefinedEndpoint) => {
    updateCurrentRequest({
      name: endpoint.name,
      method: endpoint.method,
      url: endpoint.url,
      headers: endpoint.headers || state.currentRequest.headers,
      body: endpoint.body || ''
    })
    setActiveTab('request')
    toast.success(`Loaded ${endpoint.name} endpoint`)
  }

  const validateRequest = (): boolean => {
    if (!state.currentRequest.url.trim()) {
      toast.error('URL is required')
      return false
    }

    try {
      const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin).replace(/\/$/, '')
      const isAbsolute = state.currentRequest.url.startsWith('http')
      const relativePath = state.currentRequest.url.startsWith('/')
        ? state.currentRequest.url
        : `/${state.currentRequest.url}`
      const useSameOrigin = !isAbsolute && relativePath.startsWith('/api/')
      const urlToValidate = isAbsolute
        ? state.currentRequest.url
        : `${useSameOrigin ? window.location.origin : baseUrl}${relativePath}`
      new URL(urlToValidate)
    } catch {
      toast.error('Invalid URL format')
      return false
    }

    if (state.currentRequest.body.trim() && 
        ['POST', 'PUT', 'PATCH'].includes(state.currentRequest.method)) {
      try {
        JSON.parse(state.currentRequest.body)
      } catch {
        toast.error('Invalid JSON in request body')
        return false
      }
    }

    return true
  }

  const sendRequest = async () => {
    if (!validateRequest()) return

    setState(prev => ({ ...prev, isLoading: true, error: null, response: null }))
    const startTime = Date.now()

    try {
      // Prepare headers
      const enabledHeaders = state.currentRequest.headers
        .filter(h => h.enabled && h.key.trim())
        .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {})

      // Prepare request options
      const requestOptions: RequestInit = {
        method: state.currentRequest.method,
        headers: enabledHeaders
      }

      // Add body for non-GET requests
      if (state.currentRequest.method !== 'GET' && state.currentRequest.body.trim()) {
        requestOptions.body = state.currentRequest.body
      }

      // Make the request
      const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin).replace(/\/$/, '')
      const isAbsolute = state.currentRequest.url.startsWith('http')
      const relativePath = state.currentRequest.url.startsWith('/') 
        ? state.currentRequest.url 
        : `/${state.currentRequest.url}`
      const useSameOrigin = !isAbsolute && relativePath.startsWith('/api/')
      const fullUrl = isAbsolute 
        ? state.currentRequest.url 
        : `${useSameOrigin ? window.location.origin : baseUrl}${relativePath}`

      const response = await fetch(fullUrl, requestOptions)
      
      // Parse response
      const responseText = await response.text()
      let responseData
      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = responseText
      }

      // Get response headers
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      const endTime = Date.now()
      const apiResponse: ApiResponse = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: responseData,
        duration: endTime - startTime
      }

      // Add to history
      const historyEntry: RequestHistory = {
        request: { ...state.currentRequest },
        response: apiResponse,
        error: null,
        timestamp: Date.now()
      }

      setState(prev => ({
        ...prev,
        response: apiResponse,
        isLoading: false,
        history: [historyEntry, ...prev.history.slice(0, 49)] // Keep last 50 requests
      }))

      setActiveTab('response')
      toast.success(`Request completed in ${apiResponse.duration}ms`)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      // Add to history with error
      const historyEntry: RequestHistory = {
        request: { ...state.currentRequest },
        response: null,
        error: errorMessage,
        timestamp: Date.now()
      }

      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
        history: [historyEntry, ...prev.history.slice(0, 49)]
      }))

      toast.error(`Request failed: ${errorMessage}`)
    }
  }

  const runTryFind = async () => {
    if (!tryFindDomain.trim() || !tryFindFirst.trim() || !tryFindLast.trim()) {
      toast.error('Enter first name, last name, and domain')
      return
    }
    setTryFindLoading(true)
    setTryFindDuration(null)
    try {
      const start = Date.now()
      const res = await apiPost<unknown>('/api/email/findEmail', {
        domain: tryFindDomain.trim(),
        first_name: tryFindFirst.trim(),
        last_name: tryFindLast.trim()
      })
      const end = Date.now()
      setTryFindDuration(end - start)
      setTryFindResult(res.ok ? res.data : (res.error ?? res.data))
      if (!res.ok) {
        const msg = typeof res.error === 'string' ? res.error : 'Request failed'
        toast.error(msg)
      } else {
        toast.success('Request successful')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      toast.error(msg)
    } finally {
      setTryFindLoading(false)
    }
  }

  const runTryVerify = async () => {
    if (!tryVerifyEmail.trim()) {
      toast.error('Enter an email')
      return
    }
    setTryVerifyLoading(true)
    setTryVerifyDuration(null)
    try {
      const start = Date.now()
      const res = await apiPost<unknown>('/api/email/verifyEmail', {
        email: tryVerifyEmail.trim()
      })
      const end = Date.now()
      setTryVerifyDuration(end - start)
      setTryVerifyResult(res.ok ? res.data : (res.error ?? res.data))
      if (!res.ok) {
        const msg = typeof res.error === 'string' ? res.error : 'Request failed'
        toast.error(msg)
      } else {
        toast.success('Request successful')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      toast.error(msg)
    } finally {
      setTryVerifyLoading(false)
    }
  }

  const runTryFindBulk = async () => {
    const lines = tryFindBulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      toast.error('Enter at least one line: first,last,domain')
      return
    }
    const items = lines.map(l => {
      const parts = l.split(',').map(p => p.trim())
      return { first_name: parts[0] || '', last_name: parts[1] || '', domain: parts[2] || '' }
    }).filter(i => i.first_name && i.last_name && i.domain)
    if (items.length === 0) {
      toast.error('No valid entries parsed')
      return
    }
    setTryFindBulkLoading(true)
    setTryFindBulkDuration(null)
    try {
      const start = Date.now()
      const res = await apiPost<unknown>('/api/email/findBulkEmail', JSON.stringify(items))
      const end = Date.now()
      setTryFindBulkDuration(end - start)
      setTryFindBulkResult(res.ok ? res.data : (res.error ?? res.data))
      if (!res.ok) {
        const msg = typeof res.error === 'string' ? res.error : 'Request failed'
        toast.error(msg)
      } else {
        toast.success('Request successful')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      toast.error(msg)
    } finally {
      setTryFindBulkLoading(false)
    }
  }

  const runTryVerifyBulk = async () => {
    const emails = tryVerifyBulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (emails.length === 0) {
      toast.error('Enter at least one email (one per line)')
      return
    }
    setTryVerifyBulkLoading(true)
    setTryVerifyBulkDuration(null)
    try {
      const start = Date.now()
      const res = await apiPost<unknown>('/api/email/verifyBulkEmail', { emails })
      const end = Date.now()
      setTryVerifyBulkDuration(end - start)
      setTryVerifyBulkResult(res.ok ? res.data : (res.error ?? res.data))
      if (!res.ok) {
        const msg = typeof res.error === 'string' ? res.error : 'Request failed'
        toast.error(msg)
      } else {
        toast.success('Request successful')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      toast.error(msg)
    } finally {
      setTryVerifyBulkLoading(false)
    }
  }

  const loadFromHistory = (historyItem: RequestHistory) => {
    updateCurrentRequest(historyItem.request)
    setState(prev => ({
      ...prev,
      response: historyItem.response,
      error: historyItem.error,
      selectedHistoryId: historyItem.request.id
    }))
    setActiveTab('request')
    toast.success('Request loaded from history')
  }

  const clearHistory = () => {
    setState(prev => ({ ...prev, history: [], selectedHistoryId: null }))
    localStorage.removeItem('api-testing-history')
    toast.success('History cleared')
  }

  const exportHistory = () => {
    const dataStr = JSON.stringify(state.history, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `api-testing-history-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('History exported')
  }

  const importHistory = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedHistory = JSON.parse(e.target?.result as string)
        setState(prev => ({ ...prev, history: importedHistory }))
        toast.success('History imported successfully')
      } catch {
        toast.error('Failed to import history: Invalid file format')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="w-full text-foreground">
    <div className="space-y-6 relative">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            <span>Developer Portal</span>
            <span aria-hidden="true">/</span>
            <span className="text-brand">Infrastructure</span>
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">API Keys</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Programmatic access to high-accuracy email extraction, single verification, and
            asynchronous bulk dispatch workflows.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[11px] font-semibold text-ink dark:text-white shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live REST API
          </span>
        </div>
      </div>
      {restricted && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Upgrade Required</CardTitle>
              <CardDescription>API access requires an upgraded plan</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={handleUpgrade}>Upgrade Your Plan</Button>
            </CardContent>
          </Card>
        </div>
      )}
      <div className={restricted ? 'pointer-events-none blur-sm' : ''}>
        <div className="flex items-center justify-between">
          {/* <div className="space-y-1">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-center">API</h1>
          </div> */}
          <div className="hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={exportHistory}
              disabled={state.history.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('import-file')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <input
              id="import-file"
              type="file"
              accept=".json"
              onChange={importHistory}
              className="hidden"
            />
          </div>
        </div>

      

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
      <Card className="lg:col-span-2 h-full rounded-xl border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5 text-base font-bold text-ink dark:text-white">
            <span className="h-8 w-8 rounded-lg bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 text-brand flex items-center justify-center">
              <KeyRound className="h-4 w-4" />
            </span>
            Authentication Credentials
            <span className="ml-auto text-xs text-[#059669] bg-[#ECFDF5] border border-emerald-200 px-2.5 py-1 rounded-full font-bold dark:bg-[#059669]/15 dark:border-[#059669]/30 shrink-0">
              {apiKeys.filter((k) => k.is_active).length} Active {apiKeys.filter((k) => k.is_active).length === 1 ? 'Key' : 'Keys'}
            </span>
          </CardTitle>
          <CardDescription className="text-[13px]">
            Bearer tokens pass via{' '}
            <code className="font-mono-code text-[12px] text-ink dark:text-gray-200">
              Authorization: Bearer &lt;key&gt;
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-sm font-medium">Key name</Label>
              <Input
                placeholder="e.g., Production Client"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <Button onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()} className="rounded-lg px-6">
              {creatingKey ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating
                </div>
              ) : (
                'Create Key'
              )}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Your Keys</Label>
              {keysLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                  Loading
                </div>
              )}
            </div>
            {apiKeys.length === 0 && !keysLoading ? (
              <p className="text-sm text-muted-foreground">No API keys yet</p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((k) => {
                  const isRevealed = revealed[k.id]
                  const displayed = isRevealed ? (k.api_key || k.key_prefix || '') : maskKey(k.api_key, k.key_prefix)
                  const statusText = k.is_active ? 'Active' : 'Inactive'
                  const rate = typeof k.rate_limit_per_minute === 'number' ? k.rate_limit_per_minute : undefined
                  return (
                    <div key={k.id} className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-ink dark:text-white truncate">
                            {k.key_name || 'API Key'}
                          </span>
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', k.is_active ? 'bg-[#059669]' : 'bg-[#DC2626]')} />
                          <span className={cn('text-[11px] font-semibold shrink-0', k.is_active ? 'text-[#059669]' : 'text-[#DC2626]')}>
                            {statusText}
                          </span>
                          {typeof rate === 'number' && (
                            <span className="text-[11px] font-mono-code text-ink-muted bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 px-1.5 py-0.5 rounded shrink-0">
                              {rate}/min
                            </span>
                          )}
                        </div>
                        {k.created_at && (
                          <span className="text-xs text-gray-400 shrink-0">
                            Created {new Date(k.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white dark:bg-[#111] px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10">
                        <div className="flex items-center gap-2 min-w-0">
                          <Lock className="h-[18px] w-[18px] text-gray-400 shrink-0" />
                          <span className="font-mono-code text-xs text-ink dark:text-gray-200 tracking-wider truncate">
                            {displayed}
                          </span>
                        </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setRevealed(prev => ({ ...prev, [k.id]: !isRevealed }))}
                          className="px-2.5 py-1 text-gray-600 dark:text-gray-300 hover:text-ink dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors text-xs font-medium flex items-center gap-1 border border-gray-200 dark:border-white/10"
                        >
                          {isRevealed ? <EyeOff className="h-[15px] w-[15px]" /> : <Eye className="h-[15px] w-[15px]" />}
                          <span>{isRevealed ? 'Hide' : 'Reveal'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const valueToCopy = isRevealed ? (k.api_key || '') : (k.api_key ? maskKey(k.api_key) : (k.key_prefix || ''))
                            navigator.clipboard.writeText(valueToCopy).then(() => toast.success('Copied'))
                          }}
                          className="px-2.5 py-1 text-gray-600 dark:text-gray-300 hover:text-ink dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-md transition-colors text-xs font-medium flex items-center gap-1 border border-gray-200 dark:border-white/10"
                        >
                          <Copy className="h-[15px] w-[15px]" />
                          <span>Copy</span>
                        </button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={!k.is_active || deactivatingId === k.id}
                            >
                              {deactivatingId === k.id ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  Deactivating
                                </div>
                              ) : (
                                'Deactivate'
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Deactivate API Key</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to deactivate this key? This action is permanent.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline" size="sm">Cancel</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeactivate(k.id)}
                                  disabled={deactivatingId === k.id}
                                >
                                  {deactivatingId === k.id ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      Deactivating
                                    </div>
                                  ) : (
                                    'Confirm'
                                  )}
                                </Button>
                              </DialogClose>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-gray-200 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-gray-400 shrink-0" />
              Keep production secret tokens out of client-side code and public repositories.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Daily Quota Meter */}
      <div className="h-full bg-white dark:bg-[#1a1a1a] rounded-xl p-6 border border-gray-200 dark:border-white/10 shadow-card flex flex-col justify-between gap-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-bold text-ink dark:text-white">Daily Quota Meter</span>
            <span className="px-2.5 py-0.5 rounded-full bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 text-brand font-mono-code text-xs font-bold capitalize shrink-0">
              {(profile?.plan || 'free').toString()}
            </span>
          </div>

          <div className="flex items-center justify-center py-2">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle className="text-gray-100 dark:text-white/10" cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" />
                <circle className="text-brand" cx="50" cy="50" r="40" fill="transparent" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray="251.2" strokeDashoffset="251.2" />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-ink dark:text-white tracking-tight">&mdash;</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Consumed</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 bg-gray-50 dark:bg-white/5 p-3.5 rounded-xl border border-gray-200 dark:border-white/10">
            <div className="flex justify-between items-center text-xs font-semibold text-ink dark:text-white gap-2">
              <span>Requests Today</span>
              <span className="font-mono-code font-bold text-gray-400">Not reported</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-brand h-full rounded-full" style={{ width: '0%' }} />
            </div>
            <div className="flex justify-between items-center text-[11px] text-gray-500 dark:text-gray-400 font-medium gap-2">
              <span>
                {(() => {
                  const rates = apiKeys
                    .map((k) => k.rate_limit_per_minute)
                    .filter((r): r is number => typeof r === 'number')
                  return rates.length > 0
                    ? `Rate limit: ${Math.max(...rates).toLocaleString()} req/min`
                    : 'Rate limit: not reported'
                })()}
              </span>
              <span>Resets daily</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-white/10 text-xs text-gray-500 dark:text-gray-400">
          <span>Per-day request counter not yet available.</span>
          <Link href="/upgrade" className="text-brand font-bold hover:underline shrink-0">
            Upgrade
          </Link>
        </div>
      </div>
      </div>

      <div className="grid grid-cols-1 gap-10">
        {/* Main Area: API Docs only */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between gap-4 mt-8 mb-3">
              <h2 className="flex items-center gap-2.5 text-base font-bold text-ink dark:text-white">
                <span className="h-8 w-8 rounded-lg bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 text-brand flex items-center justify-center">
                  <TerminalSquare className="h-4 w-4" />
                </span>
                Interactive Endpoint Quickstart
              </h2>
              <div className="flex items-center bg-gray-100 dark:bg-white/5 p-1 rounded-lg border border-gray-200 dark:border-white/10 gap-1 shrink-0">
                {([['curl', 'cURL'], ['node', 'Node.js'], ['python', 'Python']] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCodeLang(k)}
                    className={`px-3 py-1 rounded-md text-xs transition-all ${
                      codeLang === k
                        ? 'text-white bg-brand font-bold shadow-2xs'
                        : 'text-gray-600 dark:text-gray-300 hover:text-ink dark:hover:text-white font-medium'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <TabsContent value="docs" className="space-y-5">
              {(() => {
                const doc = API_DOCS.find((d) => d.id === selectedDocId) ?? API_DOCS[0]
                if (!doc) return null
                const url = doc.displayUrl || doc.url
                const snippet =
                  codeLang === 'node'
                    ? buildJs(doc.method, url, doc.headers, doc.requestBody)
                    : codeLang === 'python'
                      ? buildPy(doc.method, url, doc.headers, doc.requestBody)
                      : buildCurl(doc.method, url, doc.headers, doc.requestBody)
                const ext = codeLang === 'node' ? 'js' : codeLang === 'python' ? 'py' : 'sh'
                const fileName = `${doc.id.replace(/^doc-/, '').replace(/-/g, '_')}.${ext}`
                return (
                  <>
                    {/* Method pills */}
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">
                        Available Methods:
                      </span>
                      {API_DOCS.map((d) => {
                        const active = d.id === doc.id
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setSelectedDocId(d.id)}
                            className={`font-mono-code text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                              active
                                ? 'bg-brand-light dark:bg-brand/15 border-brand-border dark:border-brand/30 text-brand font-bold'
                                : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-ink-muted hover:text-ink dark:hover:text-white'
                            }`}
                          >
                            <span className={active ? 'text-brand font-bold' : 'text-gray-500 font-bold'}>
                              {d.method}
                            </span>
                            {new URL(url.startsWith('http') ? (d.displayUrl || d.url) : 'http://x' + (d.displayUrl || d.url)).pathname}
                          </button>
                        )
                      })}
                    </div>

                    {/* Code + response */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      {/* Request snippet */}
                      <div className="lg:col-span-7 bg-ink text-gray-100 rounded-xl p-4 flex flex-col justify-between border border-gray-800 shadow-2xs overflow-hidden">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-2 gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-3 h-3 rounded-full bg-red-500/80 shrink-0" />
                            <span className="w-3 h-3 rounded-full bg-amber-500/80 shrink-0" />
                            <span className="w-3 h-3 rounded-full bg-emerald-500/80 shrink-0" />
                            <span className="font-mono-code text-xs text-gray-400 ml-2 truncate">{fileName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(snippet)
                              toast.success('Snippet copied')
                            }}
                            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-xs font-medium shrink-0"
                          >
                            <Copy className="h-4 w-4" />
                            <span className="hidden sm:inline">Copy snippet</span>
                          </button>
                        </div>
                        <pre className="font-mono-code text-xs overflow-x-auto text-pink-200/90 py-2 leading-relaxed">
                          <code>{snippet}</code>
                        </pre>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-800 text-[11px] text-gray-400 gap-3">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            HTTPS encrypted
                          </span>
                          <span className="truncate">{doc.name}</span>
                        </div>
                      </div>

                      {/* Sample response */}
                      <div className="lg:col-span-5 bg-gray-50 dark:bg-white/5 rounded-xl p-4 flex flex-col justify-between border border-gray-200 dark:border-white/10 shadow-2xs">
                        <div className="flex items-center justify-between pb-2 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ink dark:text-white">Sample Response</span>
                            <span className="px-2 py-0.5 rounded bg-[#ECFDF5] border border-emerald-200 text-[#059669] font-mono-code text-[11px] font-bold dark:bg-[#059669]/15 dark:border-[#059669]/30">
                              200 OK
                            </span>
                          </div>
                        </div>
                        <pre className="font-mono-code text-xs overflow-x-auto text-ink dark:text-gray-200 bg-white dark:bg-[#111] p-3.5 rounded-lg border border-gray-200 dark:border-white/10 leading-snug max-h-72">
                          {stringifyJson(doc.success)}
                        </pre>
                        <div className="flex items-center justify-between pt-2 text-xs text-gray-500 gap-2">
                          <span className="truncate">{doc.description}</span>
                          <span className="font-mono-code text-[11px] text-gray-400 shrink-0">Format: JSON</span>
                        </div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </TabsContent>
          </Tabs>
        </div>
        
      </div>
      </div>
    </div>
    </div>
  )
}
