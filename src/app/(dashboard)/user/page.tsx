'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { apiGet } from '@/lib/api'
import { User as UserIcon, Mail, Calendar, Crown, Coins, ChevronRight } from 'lucide-react'

/** Stitch settings field: label above a bordered, read-only value row. */
function Field({
  label,
  icon: Icon,
  value,
  mono,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink dark:text-gray-200 mb-2">{label}</label>
      <div className="flex items-center gap-2.5 h-10 px-3 rounded-lg border border-gray-200 dark:border-white/10 bg-[#F8FAFC] dark:bg-white/5">
        <Icon className="h-4 w-4 shrink-0 text-gray-400" />
        <span className={`text-sm text-ink dark:text-white truncate ${mono ? 'font-mono-code text-[13px]' : ''}`}>
          {value}
        </span>
      </div>
    </div>
  )
}

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
      <div className="flex flex-col gap-6 user-details">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            Workspace Configuration
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">Account Settings</h1>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/10" />
            <div className="h-10 w-full rounded-lg bg-gray-100 dark:bg-white/5" />
            <div className="h-10 w-full rounded-lg bg-gray-100 dark:bg-white/5" />
          </div>
          <p className="mt-4 text-xs text-gray-400">Loading your information…</p>
        </div>
      </div>
    )
  }

  const createdStr = data?.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A'
  const expiryStr = data?.plan_expiry ? new Date(data.plan_expiry).toLocaleDateString() : 'N/A'
  const planName = (data?.plan || 'free').toString()

  return (
    <div className="flex flex-col gap-6 user-details">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
            Workspace Configuration
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">Account Settings</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Essential information about your account and current plan.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/credits"
            className="h-9 px-3.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 font-semibold text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300 transition-colors flex items-center gap-2 shadow-2xs"
          >
            <Coins className="h-4 w-4 text-gray-500" />
            Billing &amp; Quota
          </Link>
          <Link
            href="/upgrade"
            className="h-9 px-3.5 bg-brand text-white font-bold text-xs rounded-lg hover:bg-brand-hover transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Crown className="h-4 w-4" />
            Upgrade Plan
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)] items-start">
        {/* Section rail */}
        <nav className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-2 lg:sticky lg:top-2">
          <span
            aria-current="page"
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-semibold bg-brand-light text-brand border border-brand-border/60 dark:bg-brand/15 dark:border-brand/30"
          >
            <span className="flex items-center gap-3">
              <UserIcon className="h-[18px] w-[18px]" />
              General
            </span>
            <ChevronRight className="h-4 w-4" />
          </span>
        </nav>

        {/* Content */}
        <div className="space-y-6 min-w-0">
          {/* Profile */}
          <section className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-6">
            <h2 className="text-[15px] font-semibold text-ink dark:text-white">Profile</h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5 mb-5">
              Basic profile information for your Mailsfinder account.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" icon={UserIcon} value={data?.full_name || 'User'} />
              <Field label="Email Address" icon={Mail} value={data?.email || '—'} mono />
              <Field label="Member Since" icon={Calendar} value={createdStr} />
              <Field label="Plan Expires" icon={Calendar} value={expiryStr} />
            </div>
          </section>

          {/* Plan & credits */}
          <section className="bg-white dark:bg-[#1a1a1a] rounded-xl border border-gray-200 dark:border-white/10 shadow-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink dark:text-white">Plan &amp; Credits</h2>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Current subscription and available credits.
                </p>
              </div>
              <Badge className="capitalize shrink-0">{planName}</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mt-5">
              <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Find Credits
                </p>
                <p className="mt-1.5 text-xl font-bold text-ink dark:text-white tabular-nums">
                  {Math.max(data?.credits_find || 0, 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-white/10 p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Verify Credits
                </p>
                <p className="mt-1.5 text-xl font-bold text-ink dark:text-white tabular-nums">
                  {Math.max(data?.credits_verify || 0, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
