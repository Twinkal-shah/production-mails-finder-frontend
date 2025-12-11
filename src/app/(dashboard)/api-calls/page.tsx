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
  Copy
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
      full_name: 'John Doe',
      domain: 'example.com'
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
  const parts: string[] = [`curl -X ${method} "${url}"`]
  for (const [k, v] of Object.entries(headers)) parts.push(`  -H "${k}: ${v}"`)
  if (body !== undefined) parts.push(`  -d '${JSON.stringify(body)}'`)
  return parts.join(' \\\n')
}

const buildJs = (method: string, url: string, headers: Record<string, string>, body?: unknown) => {
  let s = `await fetch("${url}", {\n  method: "${method}",\n  headers: ${JSON.stringify(headers, null, 2)}`
  if (body !== undefined) s += `,\n  body: JSON.stringify(${JSON.stringify(body, null, 2)})`
  s += `\n})`
  return s
}

const buildPy = (method: string, url: string, headers: Record<string, string>, body?: unknown) => {
  const m = method.toLowerCase()
  let s = `import requests\nr = requests.${m}("${url}", headers=${JSON.stringify(headers, null, 2)}`
  if (body !== undefined) s += `, json=${JSON.stringify(body, null, 2)}`
  s += `)\nprint(r.json())`
  return s
}

const extractTypes = (obj: unknown): { key: string; type: string }[] => {
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
    url: '/api/email/findEmail',
    displayUrl: 'https://app.mailsfinder.com/api/email/findEmail',
    description: 'Find email by name and domain',
    headers: { 'Authorization': 'Bearer <ACCESS_TOKEN>', 'Content-Type': 'application/json' },
    requestBody: { full_name: 'John Doe', domain: 'example.com' },
    requestBodyAlt: { first_name: 'John', last_name: 'Doe', domain: 'example.com' },
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
    url: '/api/email/findBulkEmail',
    displayUrl: 'https://app.mailsfinder.com/api/email/findBulkEmail',
    description: 'Find emails in bulk',
    headers: { 'Authorization': 'Bearer <ACCESS_TOKEN>', 'Content-Type': 'application/json' },
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
    url: '/api/email/verifyBulkEmail',
    displayUrl: 'https://app.mailsfinder.com/api/email/verifyBulkEmail',
    description: 'Verify a list of emails',
    headers: { 'Authorization': 'Bearer <ACCESS_TOKEN>', 'Content-Type': 'application/json' },
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
    url: '/api/email/verifyEmail',
    displayUrl: 'https://app.mailsfinder.com/api/email/verifyEmail',
    description: 'Verify a single email',
    headers: { 'Authorization': 'Bearer <ACCESS_TOKEN>', 'Content-Type': 'application/json' },
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

  const [activeTab, setActiveTab] = useState('request')
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
const normalizeKey = (raw: any): ApiKeyRecord => {
  if (!raw || typeof raw !== 'object') return { id: '' }
  return {
    id: raw._id ?? raw.id ?? '',
    key_name: raw.keyName ?? raw.key_name ?? '',
    api_key: typeof raw.apiKey === 'string' ? raw.apiKey : (raw.api_key ?? undefined),
    key_prefix: raw.keyPrefix ?? raw.key_prefix ?? undefined,
    is_active: typeof raw.isActive === 'boolean' ? raw.isActive : !!raw.is_active,
    rate_limit_per_minute: typeof raw.rateLimitPerMinute === 'number' ? raw.rateLimitPerMinute : raw.rate_limit_per_minute,
    usage_count: typeof raw.usageCount === 'number' ? raw.usageCount : raw.usage_count ?? 0,
    created_at: raw.createdAt ?? raw.created_at ?? '',
    last_used_at: raw.lastUsedAt ?? raw.last_used_at ?? null
  }
}

  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [creatingKey, setCreatingKey] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState('')
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [accessTokenDisplay, setAccessTokenDisplay] = useState<string>('')
  const [tokenLoading, setTokenLoading] = useState(false)

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

    setApiKeys(mappedList)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch API keys'
    toast.error(msg)
    setApiKeys([])
  } finally {
    setKeysLoading(false)
  }
}, [])


  const generateAccessToken = async () => {
    setTokenLoading(true)
    try {
      const refresh = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null
      const headers: Record<string, string> = {}
      if (refresh) headers['refreshtoken'] = `Bearer ${refresh}`
      const res = await apiGet<Record<string, unknown>>('/api/user/auth/refresh', { useProxy: true, includeAuth: false, headers })
      if (!res.ok) {
        const msg = typeof res.error === 'string' ? res.error : (res.error && typeof res.error === 'object' && 'message' in res.error ? String((res.error as Record<string, unknown>).message) : 'Failed to generate access token')
        toast.error(msg)
        return
      }
      const d = (res.data as Record<string, unknown>)?.['data'] as Record<string, unknown> | undefined
      const newAccess = typeof d?.['access_token'] === 'string' ? (d['access_token'] as string) : undefined
      const newRefresh = typeof d?.['refresh_token'] === 'string' ? (d['refresh_token'] as string) : undefined
      if (newAccess) {
        setAccessTokenDisplay(newAccess)
        if (typeof window !== 'undefined') localStorage.setItem('access_token', newAccess)
      }
      if (newRefresh && typeof window !== 'undefined') localStorage.setItem('refresh_token', newRefresh)
      toast.success('Access token generated')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate access token'
      toast.error(msg)
    } finally {
      setTokenLoading(false)
    }
  }

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

    let createdRaw: any = null
    if (root && typeof root === 'object' && 'data' in root) {
      createdRaw = (root as any).data
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
    <div className="container mx-auto p-6 space-y-6 relative">
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
          <div>
          <h1 className="text-3xl font-bold">API</h1>
          <p className="text-muted-foreground">
            Test and debug your API endpoints with a comprehensive testing interface
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Access Token</CardTitle>
          <CardDescription>Generate and copy your JWT for Postman and API examples</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button onClick={generateAccessToken} disabled={tokenLoading}>
              {tokenLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating
                </div>
              ) : (
                'Generate Access Token'
              )}
            </Button>
            <Button
              variant="outline"
              disabled={!accessTokenDisplay}
              onClick={() => {
                if (!accessTokenDisplay) return
                navigator.clipboard.writeText(accessTokenDisplay).then(() => toast.success('Copied'))
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Token
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Your Access Token</Label>
            <div className="rounded-md border bg-muted p-3 overflow-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap break-all">{accessTokenDisplay || 'Generate a token to display it here'}</pre>
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>✔ Use this token in Postman or API examples</div>
            <div>✔ Do NOT share it with anyone</div>
            <div>✔ You can regenerate anytime</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Keys</CardTitle>
          <CardDescription>Manage your API keys for authenticated requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-sm font-medium">Key name</Label>
              <Input
                placeholder="e.g., Production Client"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <Button onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()}>
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
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={!k.is_active || deactivatingId === k.id}
                          onClick={() => handleDeactivate(k.id)}
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
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Request/Response Area */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="request">Request Builder</TabsTrigger>
              <TabsTrigger value="response">Response</TabsTrigger>
              <TabsTrigger value="docs">API Docs</TabsTrigger>
            </TabsList>

            <TabsContent value="request" className="space-y-4">
              {/* Predefined Endpoints */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Start</CardTitle>
                  <CardDescription>
                    Select a predefined endpoint to get started quickly
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {PREDEFINED_ENDPOINTS.map((endpoint) => (
                      <Button
                        key={endpoint.name}
                        variant="outline"
                        className="justify-start h-auto p-3"
                        onClick={() => loadPredefinedEndpoint(endpoint)}
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {endpoint.method}
                            </Badge>
                            <span className="font-medium">{endpoint.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {endpoint.description}
                          </p>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Request Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Request Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Method and URL */}
                  <div className="flex gap-2">
                    <Select
                      value={state.currentRequest.method}
                      onValueChange={(method: HttpMethod) => updateCurrentRequest({ method })}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HTTP_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Enter URL (e.g., /api/health or https://api.example.com/users)"
                      value={state.currentRequest.url}
                      onChange={(e) => updateCurrentRequest({ url: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      onClick={sendRequest}
                      disabled={state.isLoading || !state.currentRequest.url.trim()}
                      className="px-6"
                    >
                      {state.isLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Sending
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          Send
                        </div>
                      )}
                    </Button>
                  </div>

                  {/* Headers */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Headers</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addHeader}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Header
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {state.currentRequest.headers.map((header) => (
                        <div key={header.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={header.enabled}
                            onChange={(e) => updateHeader(header.id, { enabled: e.target.checked })}
                            className="rounded"
                          />
                          <Input
                            placeholder="Header name"
                            value={header.key}
                            onChange={(e) => updateHeader(header.id, { key: e.target.value })}
                            className="flex-1"
                          />
                          <Input
                            placeholder="Header value"
                            value={header.value}
                            onChange={(e) => updateHeader(header.id, { value: e.target.value })}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeHeader(header.id)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Request Body */}
                  {['POST', 'PUT', 'PATCH'].includes(state.currentRequest.method) && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Request Body</Label>
                      <JsonEditor
                        value={state.currentRequest.body}
                        onChange={(body) => updateCurrentRequest({ body })}
                        placeholder="Enter JSON request body..."
                        minHeight="150px"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="response">
              {state.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}
              <ResponseViewer response={state.response} />
            </TabsContent>

            <TabsContent value="docs" className="space-y-6">
              {API_DOCS.map((doc) => {
                const url = doc.displayUrl || doc.url
                const curl = buildCurl(doc.method, url, doc.headers, doc.requestBody)
                const js = buildJs(doc.method, url, doc.headers, doc.requestBody)
                const py = buildPy(doc.method, url, doc.headers, doc.requestBody)
                const wrapperTypes = [] as { key: string; type: string }[]
                const dataTypes = [] as { key: string; type: string }[]
                return (
                  <Card key={doc.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{doc.method}</Badge>
                          <CardTitle className="text-lg">{doc.name}</CardTitle>
                        </div>
                      </div>
                      <CardDescription>{doc.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{url}</span>
                      </div>
                      <Tabs defaultValue="curl">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="curl">cURL</TabsTrigger>
                          <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                          <TabsTrigger value="python">Python</TabsTrigger>
                        </TabsList>
                        <TabsContent value="curl">
                          <div className="bg-muted rounded-md p-4 overflow-auto">
                            <pre className="text-sm font-mono whitespace-pre-wrap">{curl}</pre>
                          </div>
                        </TabsContent>
                        <TabsContent value="javascript">
                          <div className="bg-muted rounded-md p-4 overflow-auto">
                            <pre className="text-sm font-mono whitespace-pre-wrap">{js}</pre>
                          </div>
                        </TabsContent>
                        <TabsContent value="python">
                          <div className="bg-muted rounded-md p-4 overflow-auto">
                            <pre className="text-sm font-mono whitespace-pre-wrap">{py}</pre>
                          </div>
                        </TabsContent>
                      </Tabs>
                      {doc.requestBody !== undefined && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Request Body</div>
                          <div className="bg-muted rounded-md p-4 overflow-auto">
                            <pre className="text-sm font-mono whitespace-pre-wrap">{stringifyJson(doc.requestBody)}</pre>
                          </div>
                        </div>
                      )}
                      {doc.requestBodyAlt !== undefined && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium">Alternative Body</div>
                          <div className="bg-muted rounded-md p-4 overflow-auto">
                            <pre className="text-sm font-mono whitespace-pre-wrap">{stringifyJson(doc.requestBodyAlt)}</pre>
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Response Example</div>
                        <div className="bg-muted rounded-md p-4 overflow-auto">
                          <pre className="text-sm font-mono whitespace-pre-wrap">{stringifyJson(doc.success)}</pre>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Error Example</div>
                        <div className="bg-muted rounded-md p-4 overflow-auto">
                          <pre className="text-sm font-mono whitespace-pre-wrap">{stringifyJson(doc.error)}</pre>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Response Fields</div>
                        {doc.responseFields ? (
                          <div className="space-y-2">
                            {Object.entries(doc.responseFields).map(([key, desc]) => (
                              <div key={key} className="flex items-center gap-3">
                                <Badge variant="secondary" className="rounded-full font-mono text-[11px] px-2 py-1">
                                  {key}
                                </Badge>
                                <div className="text-xs text-muted-foreground">
                                  {desc}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">No fields documented yet</div>
                        )}
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
                    </CardContent>
                  </Card>
                )
              })}
            </TabsContent>
          </Tabs>
        </div>

        {/* History Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Request History
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearHistory}
                  disabled={state.history.length === 0}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <CardDescription>
                {state.history.length} saved requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {state.history.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No requests in history yet
                  </p>
                ) : (
                  state.history.map((item) => (
                    <div
                      key={`${item.request.id}-${item.timestamp}`}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                        state.selectedHistoryId === item.request.id && "bg-muted"
                      )}
                      onClick={() => loadFromHistory(item)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {item.request.method}
                          </Badge>
                          {item.response ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                item.response.status >= 200 && item.response.status < 300
                                  ? "text-green-600 border-green-600"
                                  : "text-red-600 border-red-600"
                              )}
                            >
                              {item.response.status}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              Error
                            </Badge>
                          )}
                        </div>
                        {item.response && (
                          <span className="text-xs text-muted-foreground">
                            {item.response.duration}ms
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium truncate">
                        {item.request.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.request.url}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  )
}
