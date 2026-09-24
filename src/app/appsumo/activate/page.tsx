'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, BadgeCheck, Clock, Loader2, ShieldAlert, Tag } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

/**
 * AppSumo licence activation.
 *
 * Reached from the Redeem button on AppSumo as
 *   /appsumo/activate?code=<one-time-code>
 *
 * The code is single-use: exchanging it twice fails, and the buyer would see
 * an error for an activation that actually succeeded. So the POST is fired
 * exactly once per page load, guarded by a ref rather than an effect
 * dependency list (React StrictMode double-invokes effects in development).
 *
 * The page must answer a plain GET with no query string with HTTP 200 —
 * AppSumo's validator pings it during certification.
 */

/* ------------------------------ API shapes ------------------------------ */

/** Standard envelope: the payload lives at `data`, not at the top level. */
interface Envelope<T> {
  success?: boolean
  message?: string
  data?: T
}

interface ActivateResult {
  status?: 'active' | 'pending'
  tier?: number | null
  licenseKey?: string
  message?: string
}

interface StatusResult {
  connected?: boolean
  tier?: number | null
  label?: string
  status?: string
  license_key?: string
  daily_verify_cap?: number
  credits_remaining?: number
  api_rate_limit_per_minute?: number
  activated_at?: string
}

type Phase = 'checking' | 'no-code' | 'working' | 'active' | 'pending' | 'error'

/* --- polling: every 5s for ~2 minutes while AppSumo's webhook catches up --- */
const POLL_INTERVAL_MS = 5_000
const POLL_MAX_ATTEMPTS = 24

function readMessage(value: unknown, fallback: string): string {
  if (value && typeof value === 'object') {
    const m = (value as Record<string, unknown>).message
    if (typeof m === 'string' && m.trim()) return m
  }
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

/* -------------------------------- layout -------------------------------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#121212] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg flex flex-col gap-6">
        <div className="flex items-center justify-center gap-2.5">
          <Image
            src="/favicon-v2.png"
            alt="Mailsfinder"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            priority
          />
          <span className="text-xl font-bold tracking-tight text-ink dark:text-white">Mailsfinder</span>
        </div>
        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-white/10 shadow-card p-7 flex flex-col gap-5">
          {children}
        </div>
      </div>
    </div>
  )
}

function Header({
  icon,
  tone,
  title,
  blurb,
}: {
  icon: React.ReactNode
  tone: 'brand' | 'success' | 'warning' | 'danger'
  title: string
  blurb: string
}) {
  const tones = {
    brand: 'bg-brand-light border-brand-border text-brand dark:bg-brand/15 dark:border-brand/30',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/15 dark:border-emerald-500/30',
    warning: 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/15 dark:border-amber-500/30',
    danger: 'bg-red-50 border-red-200 text-red-600 dark:bg-red-500/15 dark:border-red-500/30',
  } as const
  return (
    <div className="flex flex-col items-center text-center gap-3">
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${tones[tone]}`}>{icon}</div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-bold tracking-tight text-ink dark:text-white">{title}</h1>
        <p className="text-sm text-ink-muted dark:text-gray-400 leading-relaxed">{blurb}</p>
      </div>
    </div>
  )
}

/* --------------------------------- page --------------------------------- */

function ActivateInner() {
  const router = useRouter()
  const params = useSearchParams()
  const code = params.get('code')

  const [phase, setPhase] = useState<Phase>('checking')
  const [tier, setTier] = useState<number | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')

  /** One-shot latch. Survives re-renders and StrictMode's double-invoke. */
  const startedRef = useRef(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollCountRef = useRef(0)
  const unmountedRef = useRef(false)

  const applyTier = useCallback((nextTier: unknown, nextLabel?: unknown) => {
    // Never invent a tier: a null/absent value renders no number at all.
    setTier(typeof nextTier === 'number' ? nextTier : null)
    setLabel(typeof nextLabel === 'string' && nextLabel.trim() ? nextLabel : null)
  }, [])

  /** Poll status while the licence is linked but AppSumo's webhook is in flight. */
  const pollStatus = useCallback(() => {
    if (unmountedRef.current) return
    if (pollCountRef.current >= POLL_MAX_ATTEMPTS) return
    pollCountRef.current += 1

    pollTimerRef.current = setTimeout(async () => {
      if (unmountedRef.current) return
      try {
        const res = await apiGet<Envelope<StatusResult>>('/api/appsumo/status', { useProxy: true })
        const payload = res.ok ? res.data?.data : undefined
        if (payload?.connected && payload.status === 'active') {
          applyTier(payload.tier, payload.label)
          setPhase('active')
          return
        }
      } catch {
        // A failed poll is not fatal — keep waiting for the webhook.
      }
      pollStatus()
    }, POLL_INTERVAL_MS)
  }, [applyTier])

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  useEffect(() => {
    // The latch is set synchronously, before any await, so a second invocation
    // (StrictMode, or any re-render) can never reach the POST.
    if (startedRef.current) return
    startedRef.current = true

    // No code: explain what to do. Still a 200 — this is the validator's view.
    if (!code) {
      setPhase('no-code')
      return
    }

    const toLogin = () => {
      const returnTo = `${window.location.pathname}${window.location.search}`
      router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`)
    }

    // Signed out: bounce to login carrying the full URL so the code survives.
    if (!isAuthenticated()) {
      toLogin()
      return
    }

    setPhase('working')
    ;(async () => {
      try {
        const res = await apiPost<Envelope<ActivateResult>>(
          '/api/appsumo/activate',
          { code },
          { useProxy: true }
        )

        if (!res.ok) {
          // A stale token fails auth before the code is exchanged, so the code
          // is still unused — send them to log in and come straight back
          // rather than showing a raw "Invalid access token".
          if (res.status === 401 || res.status === 403) {
            toLogin()
            return
          }
          // 400 messages are written for the buyer — show them verbatim.
          setErrorMessage(
            readMessage(res.error, 'We could not activate this license. Please try again shortly.')
          )
          setPhase('error')
          return
        }

        const payload = res.data?.data
        applyTier(payload?.tier)
        setDetail(typeof payload?.message === 'string' ? payload.message : null)

        if (payload?.status === 'pending') {
          setPhase('pending')
          pollStatus()
          return
        }
        setPhase('active')
      } catch {
        setErrorMessage('We could not reach the activation service. Please try again shortly.')
        setPhase('error')
      }
    })()
  }, [code, router, applyTier, pollStatus])

  const tierLine = tier !== null ? `Tier ${tier}` : label

  /* ------------------------------- states ------------------------------- */

  if (phase === 'checking' || phase === 'working') {
    return (
      <Shell>
        <Header
          tone="brand"
          icon={<Loader2 className="h-6 w-6 animate-spin" />}
          title="Activating your license"
          blurb="Hold on while we attach your AppSumo license to your Mailsfinder account."
        />
      </Shell>
    )
  }

  if (phase === 'no-code') {
    return (
      <Shell>
        <Header
          tone="brand"
          icon={<Tag className="h-6 w-6" />}
          title="Activate your AppSumo license"
          blurb="Open this page from the Redeem button on AppSumo to attach your license to your Mailsfinder account."
        />
        <div className="rounded-xl bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4">
          <p className="text-[13px] leading-5 text-ink-muted dark:text-gray-400">
            Already redeemed? Sign in and your plan will be waiting on your dashboard.
          </p>
        </div>
        <Link
          href="/home"
          className="w-full h-11 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          Go to dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Shell>
    )
  }

  if (phase === 'active') {
    return (
      <Shell>
        <Header
          tone="success"
          icon={<BadgeCheck className="h-6 w-6" />}
          title="Your license is active"
          blurb={detail || 'Your AppSumo license is attached to your Mailsfinder account and ready to use.'}
        />
        {tierLine && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 p-4 flex items-center justify-center gap-2">
            <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{tierLine}</span>
          </div>
        )}
        <Link
          href="/home"
          className="w-full h-11 rounded-xl bg-brand hover:bg-brand-hover text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          Go to dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Shell>
    )
  }

  if (phase === 'pending') {
    return (
      <Shell>
        <Header
          tone="warning"
          icon={<Clock className="h-6 w-6" />}
          title="Your license is linked"
          blurb={detail || "It'll unlock within a few minutes. You can keep this page open — it updates on its own."}
        />
        <div className="rounded-xl bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4 flex items-center gap-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-brand shrink-0" />
          <span className="text-[13px] text-ink-muted dark:text-gray-400">
            Waiting for AppSumo to confirm your purchase…
          </span>
        </div>
        <Link
          href="/home"
          className="w-full h-11 rounded-xl bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 text-ink dark:text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          Go to dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Shell>
    )
  }

  return (
    <Shell>
      <Header
        tone="danger"
        icon={<ShieldAlert className="h-6 w-6" />}
        title="We couldn't activate this license"
        blurb={errorMessage}
      />
      <div className="rounded-xl bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4">
        <p className="text-[13px] leading-5 text-ink-muted dark:text-gray-400">
          Head back to AppSumo and click <strong className="text-ink dark:text-white">Redeem</strong> again to
          start a fresh activation. If it keeps failing, contact support and we&apos;ll sort it out.
        </p>
      </div>
      <Link
        href="/home"
        className="w-full h-11 rounded-xl bg-[#F8FAFC] dark:bg-white/5 border border-gray-200 dark:border-white/10 text-ink dark:text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        Go to dashboard
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Shell>
  )
}

export default function AppSumoActivatePage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <Header
            tone="brand"
            icon={<Loader2 className="h-6 w-6 animate-spin" />}
            title="Activating your license"
            blurb="Hold on while we attach your AppSumo license to your Mailsfinder account."
          />
        </Shell>
      }
    >
      <ActivateInner />
    </Suspense>
  )
}
