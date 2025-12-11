'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiGet } from '@/lib/api'
import { User, Mail, Calendar, Crown, Coins } from 'lucide-react'

type UserDetails = {
  full_name: string
  email: string
  created_at?: string | null
  plan?: string
  plan_expiry?: string | null
  credits_find: number
  credits_verify: number
}

export const dynamic = 'force-dynamic'

export default function UserDetailsPage() {
  const [data, setData] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchData = async () => {
      try {
        const pRes = await apiGet<Record<string, unknown>>('/api/user/profile/getProfile', { useProxy: true })
        const cRes = await apiGet<Record<string, unknown>>('/api/user/credits', { useProxy: true })

        const pRaw = pRes.ok && pRes.data ? (pRes.data as Record<string, unknown>) : {}
        const p = (pRaw && typeof pRaw === 'object' && 'data' in pRaw)
          ? ((pRaw['data'] as Record<string, unknown>))
          : pRaw

        const find = cRes.ok && cRes.data
          ? Number((cRes.data as Record<string, unknown>)['find'] ?? (cRes.data as Record<string, unknown>)['credits_find'] ?? 0)
          : 0
        const verify = cRes.ok && cRes.data
          ? Number((cRes.data as Record<string, unknown>)['verify'] ?? (cRes.data as Record<string, unknown>)['credits_verify'] ?? 0)
          : 0

        const first = typeof p['firstName'] === 'string' ? (p['firstName'] as string) : ''
        const last = typeof p['lastName'] === 'string' ? (p['lastName'] as string) : ''
        const fullName = typeof p['full_name'] === 'string' && (p['full_name'] as string).trim().length > 0
          ? (p['full_name'] as string)
          : (`${first} ${last}`.trim() || (typeof p['email'] === 'string' ? ((p['email'] as string).split('@')[0]) : 'User'))

        const created = (p['created_at'] as string) ?? (p['createdAt'] as string) ?? null
        const email = typeof p['email'] === 'string' ? (p['email'] as string) : ''
        const plan = typeof p['plan'] === 'string' ? (p['plan'] as string) : 'free'
        const planExpiry = (p['plan_expiry'] as string) ?? null

        const details: UserDetails = {
          full_name: fullName,
          email,
          created_at: created,
          plan,
          plan_expiry: planExpiry,
          credits_find: Math.max(Number(find || 0), 0),
          credits_verify: Math.max(Number(verify || 0), 0)
        }
        if (!cancelled) setData(details)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchData()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>User Details</CardTitle>
            <CardDescription>Loading your information...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const createdStr = data?.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A'
  const planName = (data?.plan || 'free').toString().trim().toLowerCase()
  const planColor = planName === 'agency' ? 'bg-purple-100 text-purple-800' : planName === 'lifetime' ? 'bg-green-100 text-green-800' : planName === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
  const expiryStr = data?.plan_expiry ? new Date(data.plan_expiry).toLocaleDateString() : 'N/A'

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User Details</h1>
          <p className="text-sm text-gray-500">Essential information about your account</p>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Identity</CardTitle>
            <CardDescription>Basic profile information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <span className="font-medium">{data?.full_name || 'User'}</span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <span className="text-gray-700">{data?.email || ''}</span>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-gray-700">Joined {createdStr}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plan & Credits</CardTitle>
            <CardDescription>Current subscription and available credits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Crown className="h-5 w-5 text-gray-400" />
                <span className="font-medium capitalize">{data?.plan || 'free'}</span>
              </div>
              <Badge className={planColor}>{(data?.plan || 'Free').toString()}</Badge>
            </div>
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-gray-700">Expires {expiryStr}</span>
            </div>
            <div className="flex items-center space-x-3">
              <Coins className="h-5 w-5 text-gray-400" />
              <span className="text-gray-700">Find: {Math.max(data?.credits_find || 0, 0)}</span>
            </div>
            <div className="flex items-center space-x-3">
              <Coins className="h-5 w-5 text-gray-400" />
              <span className="text-gray-700">Verify: {Math.max(data?.credits_verify || 0, 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

