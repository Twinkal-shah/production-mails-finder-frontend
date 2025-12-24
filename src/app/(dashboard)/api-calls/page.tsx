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
  PlugZap
} from 'lucide-react'
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
    url: 'https://server.mailsfinder.com/api/api-key/getApiKeys',
    description: 'List all API keys (JWT required)',
    headers: [
      { id: '1', key: 'Authorization', value: 'Bearer ACCESS_TOKEN', enabled: true }
    ]
  },
  {
    name: 'API-Key • Create',
    method: 'POST',
    url: 'https://server.mailsfinder.com/api/api-key/createApiKey',
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
    url: 'https://server.mailsfinder.com/api/api-key/deactivateAPIKey/REPLACE_KEY_ID',
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
  const parts: string[] = [`curl.exe -i -X ${method} "${url}"`]
  for (const [k, v] of Object.entries(headers)) parts.push(`-H "${k}: ${v}"`)
  if (body !== undefined) {
    const json = typeof body === 'string' ? body : JSON.stringify(body)
    const escaped = json.replace(/"/g, '\\"')
    parts.push(`-d "${escaped}"`)
  }
  return parts.join(' ')
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
    url: 'https://server.mailsfinder.com/api/access-key/email/findEmail',
    displayUrl: 'https://server.mailsfinder.com/api/access-key/email/findEmail',
    description: 'Find email by name and domain',
    headers: { 'Authorization': 'Bearer API_KEY_***************************', 'Content-Type': 'application/json' },
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
    url: 'https://server.mailsfinder.com/api/access-key/email/findBulkEmail',
    displayUrl: 'https://server.mailsfinder.com/api/access-key/email/findBulkEmail',
    description: 'Find emails in bulk',
    headers: { 'Authorization': 'Bearer API_••••••••398e', 'Content-Type': 'application/json' },
    requestBody: [ { domain: 'example.com', first_name: 'John', last_name: 'Doe' }, { domain: 'example.com', first_name: 'Jane', last_name: 'Smith' } ],
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
    url: 'https://server.mailsfinder.com/api/access-key/email/verifyBulkEmail',
    displayUrl: 'https://server.mailsfinder.com/api/access-key/email/verifyBulkEmail',
    description: 'Verify a list of emails',
    headers: { 'Authorization': 'Bearer API_••••••••398e', 'Content-Type': 'application/json' },
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
    url: 'https://server.mailsfinder.com/api/access-key/email/verifyEmail',
    displayUrl: 'https://server.mailsfinder.com/api/access-key/email/verifyEmail',
    description: 'Verify a single email',
    headers: { 'Authorization': 'Bearer API_••••••••398e', 'Content-Type': 'application/json' },
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
    case 'valid': return 'bg-green-100 text-green-700 border-green-200'
    case 'risky': return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'invalid': return 'bg-red-100 text-red-700 border-red-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
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
  const restricted = !profileLoading && (profile?.plan === 'free' || profile?.plan === 'pro')
  const handleUpgrade = () => {
    router.push('/credits')
  }

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
      const res = await apiGet<unknown>('https://server.mailsfinder.com/api/api-key/getApiKeys', { includeAuth: true })
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
      const res = await apiPost<unknown>('https://server.mailsfinder.com/api/api-key/createApiKey', { keyName: name }, { includeAuth: true })
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
      const res = await apiDelete<unknown>(`https://server.mailsfinder.com/api/api-key/deactivateAPIKey/${id}`, { includeAuth: true })
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
    <div className="w-full bg-[#f9fafb]">
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-10 relative">
      {restricted && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-sm">
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

      

      <Card className="rounded-xl border shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">API Keys</CardTitle>
          <CardDescription>Manage your API keys for authenticated requests</CardDescription>
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
                    <div key={k.id} className="p-3 rounded-lg border flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('text-xs', k.is_active ? 'text-green-600 border-green-600' : 'text-red-600 border-red-600')}>{statusText}</Badge>
                          {typeof rate === 'number' && (
                            <Badge variant="secondary" className="text-xs">{rate}/min</Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">{k.key_name || 'API Key'}</p>
                        <p className="text-xs text-muted-foreground">{displayed}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setRevealed(prev => ({ ...prev, [k.id]: !isRevealed }))}>
                          {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const valueToCopy = isRevealed ? (k.api_key || '') : (k.api_key ? maskKey(k.api_key) : (k.key_prefix || ''))
                            navigator.clipboard.writeText(valueToCopy).then(() => toast.success('Copied'))
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
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
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-10">
        {/* Main Area: API Docs only */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="w-full my-10 flex items-center justify-center">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
                API Docs
              </h2>
            </div>

            <TabsContent value="docs" className="space-y-6">
              {API_DOCS.map((doc) => {
                const url = doc.displayUrl || doc.url
                const curl = buildCurl(doc.method, url, doc.headers, doc.requestBody)
                const js = buildJs(doc.method, url, doc.headers, doc.requestBody)
                const py = buildPy(doc.method, url, doc.headers, doc.requestBody)
                const isExpanded = openDocId === doc.id
                const tabValue = docTabs[doc.id] || 'overview'
                return (
                  <Card key={doc.id} className="rounded-xl border bg-white hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 sm:p-6 cursor-pointer" onClick={() => toggleDoc(doc.id)} role="button" aria-expanded={isExpanded}>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{doc.method}</Badge>
                            <CardTitle className="text-lg">{doc.name}</CardTitle>
                          </div>
                          <CardDescription>{doc.description}</CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={isExpanded}
                          aria-controls={`${doc.id}-content`}
                          onClick={() => toggleDoc(doc.id)}
                          className="flex items-center gap-2 hover:bg-transparent"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div
                        id={`${doc.id}-content`}
                        className={cn(
                          'transition-all duration-300 ease-out overflow-hidden',
                          isExpanded ? 'max-h-[3000px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-1'
                        )}
                        aria-hidden={!isExpanded}
                      >
                        <div className="p-4 sm:p-6">
                          <Tabs value={tabValue} onValueChange={(v) => setDocTab(doc.id, v as DocTabKey)}>
                            <TabsList className="grid w-full grid-cols-3">
                              <TabsTrigger value="overview">Overview</TabsTrigger>
                              <TabsTrigger value="request">Request</TabsTrigger>
                              <TabsTrigger value="response">Response</TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="space-y-6 pt-4">
                              <div className="space-y-2">
                                <div className="text-sm font-medium">What this API does</div>
                                <p className="text-sm text-muted-foreground">{doc.description}</p>
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium">Required fields</div>
                                <div className="rounded-lg border overflow-hidden">
                                  <div className="grid grid-cols-3 gap-2 p-3 bg-muted text-sm font-medium">
                                    <div>Field</div>
                                    <div>Required</div>
                                    <div>Description</div>
                                  </div>
                                  {(REQUIRED_FIELDS[doc.id] || []).map((f) => (
                                    <div key={f.field} className="grid grid-cols-3 gap-2 p-3 border-t text-sm">
                                      <div className="font-mono">{f.field}</div>
                                      <div className={cn('font-medium', f.required ? 'text-green-700' : 'text-muted-foreground')}>{f.required ? 'Yes' : 'No'}</div>
                                      <div className="text-muted-foreground">{f.description}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="text-sm font-medium">Endpoint</div>
                                  <div className="text-sm font-mono">{url}</div>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-sm font-medium">Auth</div>
                                  <div className="text-sm">API key</div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium">Status Codes</div>
                                {doc.statusCodes ? (
                                  <div className="space-y-2">
                                    {Object.entries(doc.statusCodes).map(([code, desc]) => (
                                      <div key={code} className="flex items-center gap-3">
                                        <Badge variant="outline" className="rounded-full font-mono text-[11px] px-2 py-1">
                                          {code}
                                        </Badge>
                                        <div className="text-xs text-muted-foreground">
                                          {desc}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground">No status codes documented yet</div>
                                )}
                              </div>
                            </TabsContent>

                            <TabsContent value="request" className="space-y-6 pt-4">
                              <Tabs defaultValue="curl">
                                <TabsList className="grid w-full grid-cols-3">
                                  <TabsTrigger value="curl">Curl</TabsTrigger>
                                  <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                                  <TabsTrigger value="python">Python</TabsTrigger>
                                </TabsList>
                                <TabsContent value="curl">
                                  <div className="bg-muted rounded-lg border p-4 overflow-x-auto">
                                    <pre className="text-xs sm:text-sm font-mono whitespace-pre leading-6">{curl}</pre>
                                  </div>
                                </TabsContent>
                                <TabsContent value="javascript">
                                  <div className="bg-muted rounded-lg border p-4 overflow-x-auto">
                                    <pre className="text-xs sm:text-sm font-mono whitespace-pre leading-6">{js}</pre>
                                  </div>
                                </TabsContent>
                                <TabsContent value="python">
                                  <div className="bg-muted rounded-lg border p-4 overflow-x-auto">
                                    <pre className="text-xs sm:text-sm font-mono whitespace-pre leading-6">{py}</pre>
                                  </div>
                                </TabsContent>
                              </Tabs>

                              <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  {doc.id === 'doc-email-find' && (
                                    <>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label className="text-sm font-medium">First name</Label>
                                          <Input value={tryFindFirst} onChange={(e) => setTryFindFirst(e.target.value)} placeholder="John" className="rounded-lg" />
                                        </div>
                                        <div>
                                          <Label className="text-sm font-medium">Last name</Label>
                                          <Input value={tryFindLast} onChange={(e) => setTryFindLast(e.target.value)} placeholder="Doe" className="rounded-lg" />
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium">Domain</Label>
                                        <Input value={tryFindDomain} onChange={(e) => setTryFindDomain(e.target.value)} placeholder="example.com" className="rounded-lg" />
                                      </div>
                                      <Button onClick={runTryFind} disabled={tryFindLoading} className="rounded-lg px-6">
                                        {tryFindLoading ? 'Running...' : 'Run API'}
                                      </Button>
                                    </>
                                  )}
                                  {doc.id === 'doc-email-verify' && (
                                    <>
                                      <div>
                                        <Label className="text-sm font-medium">Email</Label>
                                        <Input value={tryVerifyEmail} onChange={(e) => setTryVerifyEmail(e.target.value)} placeholder="john@example.com" className="rounded-lg" />
                                      </div>
                                      <Button onClick={runTryVerify} disabled={tryVerifyLoading} className="rounded-lg px-6">
                                        {tryVerifyLoading ? 'Running...' : 'Run API'}
                                      </Button>
                                    </>
                                  )}
                                  {doc.id === 'doc-email-find-bulk' && (
                                    <>
                                      <div>
                                        <Label className="text-sm font-medium">Items (one per line: first,last,domain)</Label>
                                        <textarea value={tryFindBulkText} onChange={(e) => setTryFindBulkText(e.target.value)} placeholder="John,Doe,example.com\nJane,Smith,example.com" className="w-full rounded-lg border p-2 text-sm h-28" />
                                      </div>
                                      <Button onClick={runTryFindBulk} disabled={tryFindBulkLoading} className="rounded-lg px-6">
                                        {tryFindBulkLoading ? 'Running...' : 'Run API'}
                                      </Button>
                                    </>
                                  )}
                                  {doc.id === 'doc-email-verify-bulk' && (
                                    <>
                                      <div>
                                        <Label className="text-sm font-medium">Emails (one per line)</Label>
                                        <textarea value={tryVerifyBulkText} onChange={(e) => setTryVerifyBulkText(e.target.value)} placeholder="john@example.com\njane@example.com" className="w-full rounded-lg border p-2 text-sm h-28" />
                                      </div>
                                      <Button onClick={runTryVerifyBulk} disabled={tryVerifyBulkLoading} className="rounded-lg px-6">
                                        {tryVerifyBulkLoading ? 'Running...' : 'Run API'}
                                      </Button>
                                    </>
                                  )}
                                </div>
                                <div className="space-y-3">
                                  <div className="text-sm font-medium">Results</div>
                                  <div className="bg-muted rounded-lg border p-4 space-y-3">
                                    {doc.id === 'doc-email-find' && (
                                      (() => {
                                        const payload = unwrapData<Record<string, unknown>>(tryFindResult)
                                        const email = getStr(payload, 'email') || null
                                        const status = getStr(payload, 'status')
                                        const confidence = getNum(payload, 'confidence')
                                        const domain = getStr(payload, 'domain')
                                        const cls = statusBadgeClass(status)
                                        return (
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Email:</div>
                                              <div className="text-sm font-medium">{email || '-'}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Status:</div>
                                              <Badge variant="outline" className={cn('text-xs border', cls)}>{statusLabel(status)}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Confidence:</div>
                                              <div className="text-sm font-medium">{confidence ? `${confidence}%` : '-'}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Domain:</div>
                                              <div className="text-sm font-medium">{domain || '-'}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Time:</div>
                                              <div className="text-sm font-medium">{tryFindDuration != null ? `${tryFindDuration}ms` : '-'}</div>
                                            </div>
                                          </div>
                                        )
                                      })()
                                    )}
                                    {doc.id === 'doc-email-verify' && (
                                      (() => {
                                        const payload = unwrapData<Record<string, unknown>>(tryVerifyResult)
                                        const email = getStr(payload, 'email') || tryVerifyEmail || null
                                        const status = getStr(payload, 'status')
                                        const confidence = getNum(payload, 'confidence')
                                        const domain = getStr(payload, 'domain')
                                        const cls = statusBadgeClass(status)
                                        return (
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Email:</div>
                                              <div className="text-sm font-medium">{email || '-'}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Status:</div>
                                              <Badge variant="outline" className={cn('text-xs border', cls)}>{statusLabel(status)}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Confidence:</div>
                                              <div className="text-sm font-medium">{confidence ? `${confidence}%` : '-'}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Domain:</div>
                                              <div className="text-sm font-medium">{domain || '-'}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Time:</div>
                                              <div className="text-sm font-medium">{tryVerifyDuration != null ? `${tryVerifyDuration}ms` : '-'}</div>
                                            </div>
                                          </div>
                                        )
                                      })()
                                    )}
                                    {doc.id === 'doc-email-find-bulk' && (
                                      (() => {
                                        const payloadObj = unwrapData<Record<string, unknown>>(tryFindBulkResult)
                                        const resultsRaw = payloadObj ? (payloadObj['results'] as unknown) : undefined
                                        const results = Array.isArray(resultsRaw) ? (resultsRaw as Array<Record<string, unknown>>) : []
                                        return (
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Processed:</div>
                                              <div className="text-sm font-medium">{results.length}</div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                              {results.slice(0, 5).map((r: Record<string, unknown>, i: number) => (
                                                <Badge
                                                  key={i}
                                                  variant="outline"
                                                  className={cn('text-xs border', statusBadgeClass(getStr(r, 'status')))}
                                                >
                                                  {getStr(r, 'email') || getStr(r, 'first_name')}: {statusLabel(getStr(r, 'status'))}
                                                </Badge>
                                              ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Time:</div>
                                              <div className="text-sm font-medium">{tryFindBulkDuration != null ? `${tryFindBulkDuration}ms` : '-'}</div>
                                            </div>
                                          </div>
                                        )
                                      })()
                                    )}
                                    {doc.id === 'doc-email-verify-bulk' && (
                                      (() => {
                                        const payloadObj = unwrapData<Record<string, unknown>>(tryVerifyBulkResult)
                                        const resultsRaw = payloadObj ? (payloadObj['results'] as unknown) : undefined
                                        const results = Array.isArray(resultsRaw) ? (resultsRaw as Array<Record<string, unknown>>) : []
                                        return (
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Processed:</div>
                                              <div className="text-sm font-medium">{results.length}</div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                              {results.slice(0, 5).map((r: Record<string, unknown>, i: number) => (
                                                <Badge
                                                  key={i}
                                                  variant="outline"
                                                  className={cn('text-xs border', statusBadgeClass(getStr(r, 'status')))}
                                                >
                                                  {getStr(r, 'email')}: {statusLabel(getStr(r, 'status'))}
                                                </Badge>
                                              ))}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm">Time:</div>
                                              <div className="text-sm font-medium">{tryVerifyBulkDuration != null ? `${tryVerifyBulkDuration}ms` : '-'}</div>
                                            </div>
                                          </div>
                                        )
                                      })()
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TabsContent>

                            <TabsContent value="response" className="space-y-6 pt-4">
                              <div className="rounded-xl border p-4 sm:p-6 shadow-sm">
                                {doc.id === 'doc-email-find' && (
                                  (() => {
                                    const payload = unwrapData<Record<string, unknown>>(tryFindResult)
                                    const email = getStr(payload, 'email') || null
                                    const status = getStr(payload, 'status')
                                    const confidence = getNum(payload, 'confidence')
                                    const domain = getStr(payload, 'domain')
                                    const cls = statusBadgeClass(status)
                                    return (
                                      <div className="space-y-3">
                                        <div className="text-lg font-semibold">Result</div>
                                        <div className="grid sm:grid-cols-2 gap-3">
                                          <div className="space-y-1">
                                            <div className="text-sm font-medium">Email</div>
                                            <div className="text-sm">{email || '-'}</div>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-sm font-medium">Status</div>
                                            <Badge variant="outline" className={cn('text-xs border', cls)}>{statusLabel(status)}</Badge>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-sm font-medium">Confidence</div>
                                            <div className="text-sm">{confidence ? `${confidence}%` : '-'}</div>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-sm font-medium">Domain</div>
                                            <div className="text-sm">{domain || '-'}</div>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-sm font-medium">Time</div>
                                            <div className="text-sm">{tryFindDuration != null ? `${tryFindDuration}ms` : '-'}</div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()
                                )}
                                {doc.id === 'doc-email-verify' && (
                                  (() => {
                                    const payload = unwrapData<Record<string, unknown>>(tryVerifyResult)
                                    const email = getStr(payload, 'email') || tryVerifyEmail || null
                                    const status = getStr(payload, 'status')
                                    const confidence = getNum(payload, 'confidence')
                                    const domain = getStr(payload, 'domain')
                                    const cls = statusBadgeClass(status)
                                    return (
                                      <div className="space-y-3">
                                        <div className="text-lg font-semibold">Result</div>
                                        <div className="grid sm:grid-cols-2 gap-3">
                                          <div className="space-y-1">
                                            <div className="text-sm font-medium">Email</div>
                                            <div className="text-sm">{email || '-'}</div>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-sm font-medium">Status</div>
                                            <Badge variant="outline" className={cn('text-xs border', cls)}>{statusLabel(status)}</Badge>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-sm font-medium">Confidence</div>
                                            <div className="text-sm">{confidence ? `${confidence}%` : '-'}</div>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-sm font-medium">Domain</div>
                                            <div className="text-sm">{domain || '-'}</div>
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-sm font-medium">Time</div>
                                            <div className="text-sm">{tryVerifyDuration != null ? `${tryVerifyDuration}ms` : '-'}</div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })()
                                )}
                                {doc.id === 'doc-email-find-bulk' && (
                                  (() => {
                                    const payloadObj = unwrapData<Record<string, unknown>>(tryFindBulkResult)
                                    const resultsRaw = payloadObj ? (payloadObj['results'] as unknown) : undefined
                                    const results = Array.isArray(resultsRaw) ? (resultsRaw as Array<Record<string, unknown>>) : []
                                    return (
                                      <div className="space-y-3">
                                        <div className="text-lg font-semibold">Results</div>
                                        <div className="space-y-2">
                                          <div className="text-sm">Processed {results.length}</div>
                                          <div className="flex flex-wrap gap-2">
                                            {results.slice(0, 10).map((r: Record<string, unknown>, i: number) => (
                                              <Badge
                                                key={i}
                                                variant="outline"
                                                className={cn('text-xs border', statusBadgeClass(getStr(r, 'status')))}
                                              >
                                                {getStr(r, 'email') || getStr(r, 'first_name')}: {statusLabel(getStr(r, 'status'))}
                                              </Badge>
                                            ))}
                                          </div>
                                          <div className="text-sm">Time {tryFindBulkDuration != null ? `${tryFindBulkDuration}ms` : '-'}</div>
                                        </div>
                                      </div>
                                    )
                                  })()
                                )}
                                {doc.id === 'doc-email-verify-bulk' && (
                                  (() => {
                                    const payloadObj = unwrapData<Record<string, unknown>>(tryVerifyBulkResult)
                                    const resultsRaw = payloadObj ? (payloadObj['results'] as unknown) : undefined
                                    const results = Array.isArray(resultsRaw) ? (resultsRaw as Array<Record<string, unknown>>) : []
                                    return (
                                      <div className="space-y-3">
                                        <div className="text-lg font-semibold">Results</div>
                                        <div className="space-y-2">
                                          <div className="text-sm">Processed {results.length}</div>
                                          <div className="flex flex-wrap gap-2">
                                            {results.slice(0, 10).map((r: Record<string, unknown>, i: number) => (
                                              <Badge
                                                key={i}
                                                variant="outline"
                                                className={cn('text-xs border', statusBadgeClass(getStr(r, 'status')))}
                                              >
                                                {getStr(r, 'email')}: {statusLabel(getStr(r, 'status'))}
                                              </Badge>
                                            ))}
                                          </div>
                                          <div className="text-sm">Time {tryVerifyBulkDuration != null ? `${tryVerifyBulkDuration}ms` : '-'}</div>
                                        </div>
                                      </div>
                                    )
                                  })()
                                )}
                              </div>
                              <div className="space-y-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowRawJson(prev => ({ ...prev, [doc.id]: !prev[doc.id] }))}
                                  className="rounded-lg"
                                >
                                  {showRawJson[doc.id] ? 'Hide Raw JSON' : 'View Raw JSON'}
                                </Button>
                                {showRawJson[doc.id] && (
                                  <div className="bg-muted rounded-lg border p-4 overflow-x-auto">
                                    <pre className="text-xs sm:text-sm font-mono whitespace-pre leading-6">
                                      {(() => {
                                        const value =
                                          doc.id === 'doc-email-find' ? tryFindResult :
                                          doc.id === 'doc-email-verify' ? tryVerifyResult :
                                          doc.id === 'doc-email-find-bulk' ? tryFindBulkResult :
                                          tryVerifyBulkResult
                                        return stringifyJson(value as unknown)
                                      })()}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TabsContent>
                          </Tabs>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </TabsContent>
          </Tabs>
        </div>
        
      </div>
      </div>
    </div>
    </div>
  )
}
