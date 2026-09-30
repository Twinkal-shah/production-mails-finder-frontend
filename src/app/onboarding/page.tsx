'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Building2,
  Globe,
  UserCog,
  TrendingUp,
  Megaphone,
  Terminal,
  SlidersHorizontal,
  UserSearch,
  FileUp,
  Server,
  Webhook,
  Shield,
  Compass,
  BadgePercent,
  Coins,
  Gauge,
  AtSign,
  BadgeCheck,
  Check,
  Activity,
  Lock,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react'
import { useUserProfile } from '@/hooks/useCreditsData'
import { useQueryInvalidation } from '@/lib/query-invalidation'
import { humanizeApiError } from '@/lib/api-error'
import {
  markOnboardingCompleted,
  saveOnboardingAnswers,
  persistOnboardingAnswers,
  type OnboardingAnswers,
} from '@/lib/onboarding'

/* ------------------------------ option data ------------------------------ */

const COMPANY_SIZES = ['1-10 (Startup)', '11-50 (Growth)', '51-200 (Mid-Market)', '201-1000', '1000+ Enterprise']

const ROLES: Array<{ label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { label: 'Founder / Executive', icon: UserCog },
  { label: 'Sales / SDR', icon: TrendingUp },
  { label: 'Marketing / Growth', icon: Megaphone },
  { label: 'Developer / Technical', icon: Terminal },
]

const NEEDS: Array<{ label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { label: 'Single B2B Work Email Finder', icon: UserSearch },
  { label: 'Bulk CSV / List Enrichment', icon: FileUp },
  { label: 'Catch-All & MX Server Diagnostic', icon: Server },
  { label: 'REST API & Webhooks Automation', icon: Webhook },
  { label: 'Disposable & Spam Trap Shield', icon: Shield },
  { label: 'Domain Mailbox Discovery', icon: Compass },
]

const VOLUMES: Array<{ range: string; tier: string }> = [
  { range: '< 1,000 / mo', tier: 'Testing & Free' },
  { range: '1K – 10K / mo', tier: 'Starter' },
  { range: '10K – 50K / mo', tier: 'Growth Pro' },
  { range: '50K – 250K / mo', tier: 'High Scale' },
  { range: '250,000+ / mo', tier: 'Enterprise' },
]

const SOURCES = [
  'Product Hunt / Launch',
  'Twitter / X',
  'LinkedIn',
  'Google Search',
  'Cold Email / Outbound',
  'Colleague / Referral',
  'Other',
]

const STEPS = ['1. Company Profile', '2. Volume & Needs', '3. Discovery & LTD', '4. Live Sandbox']

/* ------------------------------ small pieces ------------------------------ */

const chipBase = 'px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all'
const chipIdle = 'font-medium border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-slate-700 dark:text-gray-200 hover:border-slate-300 dark:hover:border-white/25'
const chipActive = 'font-bold border-2 border-brand bg-brand-light text-brand dark:text-[#ff8da3] shadow-sm'

function SectionHeader({
  icon: Icon,
  eyebrow,
  hint,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>
  eyebrow: string
  hint: string
  title: string
}) {
  return (
    <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-white/5">
      <div className="w-10 h-10 rounded-xl bg-brand-light border border-brand-border flex items-center justify-center text-brand dark:text-[#ff8da3] shrink-0">
        <Icon className="h-[22px] w-[22px]" />
      </div>
      <div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand dark:text-[#ff8da3]">{eyebrow}</span>
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-white/25" />
          <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">{hint}</span>
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      </div>
    </div>
  )
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider">
      {children}
    </label>
  )
}

/* ------------------------------ sandbox result ------------------------------ */

interface SandboxResult {
  email: string
  status: string
  reason?: string
  catchAll: boolean
  mx?: string
  confidence?: number
  safeToSend?: boolean | string
  creditsUsed?: number
}

function initialsOf(email: string) {
  const local = email.split('@')[0] || ''
  const parts = local.split(/[._-]+/).filter(Boolean)
  return ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase()
}

function SandboxResultCard({ result }: { result: SandboxResult }) {
  const status = result.status
  const deliverable = status === 'valid'
  const risky = status === 'risky' || status === 'catch_all' || result.catchAll
  const badge = deliverable
    ? { text: 'Deliverable', cls: 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' }
    : risky
      ? { text: 'Risky / Catch-all', cls: 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' }
      : status === 'invalid'
        ? { text: 'Undeliverable', cls: 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300', dot: 'bg-red-500' }
        : { text: 'Unknown', cls: 'bg-slate-100 dark:bg-white/10 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300', dot: 'bg-slate-400 dark:bg-white/30' }
  const confidence =
    typeof result.confidence === 'number'
      ? result.confidence <= 1
        ? Math.round(result.confidence * 100)
        : Math.round(result.confidence)
      : null
  const summary =
    result.reason ||
    (deliverable
      ? 'Mailbox is active, reachable, and ready for outbound deliverability.'
      : risky
        ? 'The server accepts all addresses — deliverability cannot be confirmed.'
        : status === 'invalid'
          ? 'The mailbox was rejected by the receiving server.'
          : 'The receiving server did not return a conclusive verdict.')

  const good = 'text-emerald-700 dark:text-emerald-300'
  const neutral = 'text-slate-800 dark:text-gray-100'
  const bad = 'text-red-700 dark:text-red-300'
  const diagnostics: Array<{ label: string; value: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = [
    {
      label: 'MX Records',
      value: result.mx ? 'Verified Valid' : status === 'invalid' ? 'Not Found' : 'Resolved',
      icon: Check,
      cls: result.mx || status !== 'invalid' ? good : bad,
    },
    {
      label: 'SMTP Handshake',
      value: deliverable ? '250 OK (Live)' : status === 'invalid' ? 'Rejected' : risky ? 'Accepted (Catch-all)' : 'Inconclusive',
      icon: Activity,
      cls: deliverable ? good : status === 'invalid' ? bad : neutral,
    },
    {
      label: 'Catch-All State',
      value: result.catchAll || status === 'catch_all' ? 'True (Accept-all)' : 'False (Strict)',
      icon: Lock,
      cls: neutral,
    },
    {
      label: 'Spam Trap Risk',
      value: result.safeToSend === true ? '0 Spam Risk' : risky ? 'Elevated' : deliverable ? 'Low' : 'Unknown',
      icon: ShieldCheck,
      cls: result.safeToSend === true || deliverable ? good : neutral,
    },
  ]

  return (
    <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-white/15 text-white font-bold flex items-center justify-center text-sm tracking-wide shadow-sm">
            {initialsOf(result.email)}
          </div>
          <div>
            <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white break-all" data-ph-mask>{result.email}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-bold ${badge.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse ${badge.dot}`} />
                {badge.text}
                {confidence !== null ? ` (${confidence}% Confidence)` : ''}
              </span>
            </div>
            <div className="flex items-center space-x-2 pt-1 text-xs text-slate-500 dark:text-gray-400">
              <span>{summary}</span>
            </div>
          </div>
        </div>
        {typeof result.creditsUsed === 'number' && (
          <div className="flex items-center space-x-2 self-start md:self-auto">
            <span className="px-3 py-1 rounded-lg bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-500 dark:text-gray-400 shadow-2xs">
              Deducted:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {result.creditsUsed} {result.creditsUsed === 1 ? 'Credit' : 'Credits'}
              </strong>
            </span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
        {diagnostics.map((d) => (
          <div key={d.label} className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl p-3 flex flex-col justify-between">
            <span className="text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[10px] font-bold">{d.label}</span>
            <span className={`font-bold flex items-center mt-1 text-xs ${d.cls}`}>
              <d.icon className="h-4 w-4 mr-1" /> {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------- page --------------------------------- */

export default function OnboardingPage() {
  const router = useRouter()
  const { data: profile } = useUserProfile()
  const { invalidateUserProfile } = useQueryInvalidation()

  const [companyName, setCompanyName] = useState('')
  const [companySize, setCompanySize] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [needs, setNeeds] = useState<string[]>([])
  const [volume, setVolume] = useState<string | null>(null)
  const [ltd, setLtd] = useState<'yes' | 'no' | null>(null)
  const [source, setSource] = useState<string | null>(null)

  const [testEmail, setTestEmail] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [sandbox, setSandbox] = useState<SandboxResult | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const email = profile?.email && profile.email !== 'Please log in' ? profile.email : ''
  const credits = typeof profile?.available_credits === 'number' ? profile.available_credits : null

  // Not signed in (profile resolved without an email) — go to login.
  useEffect(() => {
    if (profile && !email) router.replace('/auth/login')
  }, [profile, email, router])

  /* --- stepper derived from what has been filled in --- */
  const stepDone = useMemo(
    () => [
      companyName.trim().length > 0 && !!companySize && !!role,
      needs.length > 0 && !!volume,
      !!ltd && !!source,
      !!sandbox,
    ],
    [companyName, companySize, role, needs, volume, ltd, source, sandbox]
  )
  const doneCount = stepDone.filter(Boolean).length
  const activeStep = Math.min(stepDone.findIndex((d) => !d) === -1 ? 3 : stepDone.findIndex((d) => !d), 3)
  const progressPct = Math.round((doneCount / STEPS.length) * 100)

  const toggleNeed = (label: string) =>
    setNeeds((prev) => (prev.includes(label) ? prev.filter((n) => n !== label) : [...prev, label]))

  /* --- live sandbox: same endpoint as the single verifier --- */
  const runSandboxVerification = async () => {
    const value = testEmail.trim()
    if (!value || !/.+@.+\..+/.test(value)) {
      toast.error('Please enter a valid email address')
      return
    }
    setIsVerifying(true)
    setSandbox(null)
    try {
      const response = await fetch('/verify/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: value }),
      })
      const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
      const inner = (typeof data.data === 'object' && data.data !== null ? data.data : data) as Record<string, unknown>
      if (!response.ok) {
        const raw = [inner.error, data.error, data.message].find((v) => typeof v === 'string' && v.trim()) as string | undefined
        throw new Error(humanizeApiError(raw || '', 'Failed to verify email'))
      }
      const rawStatus = typeof inner.status === 'string' ? inner.status.toLowerCase() : 'unknown'
      const isCatchAllDomain = inner.is_catch_all_domain === true
      const catchAll = inner.catch_all === true || isCatchAllDomain
      const creditsUsed = Number(inner.credits_used ?? inner.creditsUsed ?? data.credits_used)
      setSandbox({
        email: value,
        status: isCatchAllDomain ? 'catch_all' : catchAll ? 'risky' : rawStatus,
        reason: [inner.notice, inner.reason].find((v) => typeof v === 'string' && v.trim()) as string | undefined,
        catchAll,
        mx: typeof inner.mx === 'string' ? inner.mx : undefined,
        confidence: typeof inner.confidence_score === 'number' ? inner.confidence_score : undefined,
        safeToSend: inner.safe_to_send as boolean | string | undefined,
        creditsUsed: Number.isFinite(creditsUsed) ? creditsUsed : undefined,
      })
      invalidateUserProfile()
    } catch (err) {
      toast.error(humanizeApiError(err, 'Failed to verify email'))
    } finally {
      setIsVerifying(false)
    }
  }

  /* --- finish: persist answers, company name, then enter the workspace --- */
  const finish = async (skipped: boolean) => {
    setIsSaving(true)
    const answers: OnboardingAnswers = {
      companyName: companyName.trim(),
      companySize,
      role,
      needs,
      volume,
      lifetimeDealInterest: ltd,
      source,
      sandboxVerified: !!sandbox,
      skipped,
      completedAt: new Date().toISOString(),
    }
    try {
      saveOnboardingAnswers(email, answers)
      // Also store them on the account — localStorage only lives in this one
      // browser. Best-effort; never blocks entry to the workspace.
      await persistOnboardingAnswers(answers)
      if (!skipped && answers.companyName) {
        const res = await fetch('/api/user/profile/updateProfile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ company: answers.companyName }),
        })
        if (res.ok) invalidateUserProfile()
      }
    } catch {
      // Never block entry to the workspace on a failed save.
    } finally {
      markOnboardingCompleted(email)
      router.push('/home')
    }
  }

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] dark:bg-[#1b1c1b] text-slate-900 dark:text-white antialiased py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-7 pb-20">
        {/* ---------------------------- header ---------------------------- */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center space-x-3">
            <Image src="/favicon-v2.png" alt="Mailsfinder" width={36} height={36} className="w-9 h-9 object-contain" priority />
            <div className="flex items-center space-x-2.5">
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Mailsfinder</span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-300 font-semibold text-[11px] tracking-wider uppercase">
                Setup Wizard
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
            <div className="flex items-center space-x-2 bg-white dark:bg-[#1a1a1a] px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-white/10 shadow-sm text-xs font-medium text-slate-600 dark:text-gray-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>
                SMTP Nodes: <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">Online</strong>
              </span>
            </div>
            <div className="flex items-center space-x-1.5 bg-brand-light px-3.5 py-1.5 rounded-full border border-brand-border text-xs font-bold text-brand dark:text-[#ff8da3]">
              <Coins className="h-4 w-4" />
              <span>{credits !== null ? `Trial: ${credits.toLocaleString()} Credits Granted` : 'Free Trial Active'}</span>
            </div>
          </div>
        </header>

        {/* ---------------------------- stepper ---------------------------- */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-5 border border-slate-200 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-white/5 pb-3">
            <div className="inline-flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-md bg-brand-light text-brand dark:text-[#ff8da3] text-xs font-bold tracking-wider uppercase">
                Step {activeStep + 1} of {STEPS.length}
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-gray-100">Workspace Customization &amp; Diagnostics</span>
            </div>
            <span className="text-xs font-semibold text-slate-400 dark:text-gray-500 font-mono-code tracking-wider">CALIBRATION · {progressPct}%</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {STEPS.map((label, i) => {
              const done = stepDone[i]
              const active = i === activeStep && !done
              return (
                <div key={label} className="space-y-2">
                  <div className={`h-2 w-full rounded-full ${done || active ? 'bg-brand' : 'bg-slate-200 dark:bg-white/15'}`} />
                  <div className="flex items-center space-x-1.5">
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <span className={`rounded-full ${active ? 'h-2 w-2 bg-brand' : 'h-1.5 w-1.5 bg-slate-300 dark:bg-white/25'}`} />
                    )}
                    <span
                      className={`text-xs ${
                        done ? 'font-semibold text-slate-800 dark:text-gray-100' : active ? 'font-bold text-brand dark:text-[#ff8da3]' : 'font-medium text-slate-400 dark:text-gray-500'
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ---------------------------- intro ---------------------------- */}
        <div className="space-y-1.5 pt-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Set up your account</h1>
          <p className="text-slate-600 dark:text-gray-300 text-sm sm:text-base max-w-2xl leading-relaxed">
            Tell us about your company and what you&apos;re looking for, so Mailsfinder can give you
            better matches and faster results.
          </p>
        </div>

        {/* ---------------------- set 1: company & team ---------------------- */}
        <section className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm space-y-6">
          <SectionHeader icon={Building2} eyebrow="Question Set 1" hint="Organization Basics" title="Company & Team Profile" />
          <div className="space-y-5">
            <div className="space-y-2">
              <FieldLabel htmlFor="company-name">Company Name</FieldLabel>
              <div className="relative max-w-lg">
                <input
                  id="company-name"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp or Stripe"
                  className="w-full h-11 px-3 pl-10 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
                />
                <Globe className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-gray-500 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2.5">
              <FieldLabel>Company Size</FieldLabel>
              <div className="flex flex-wrap gap-2.5">
                {COMPANY_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setCompanySize(size)}
                    className={`${chipBase} ${companySize === size ? chipActive : chipIdle}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <FieldLabel>Your Role / Department</FieldLabel>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {ROLES.map(({ label, icon: Icon }) => {
                  const active = role === label
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setRole(label)}
                      className={`p-3 rounded-xl text-left transition-all ${
                        active ? 'border-2 border-brand bg-brand-light' : 'border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] hover:border-slate-300 dark:hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={`h-5 w-5 ${active ? 'text-brand dark:text-[#ff8da3]' : 'text-slate-500 dark:text-gray-400'}`} />
                        <span className={`w-2 h-2 rounded-full ${active ? 'bg-brand' : 'bg-transparent'}`} />
                      </div>
                      <div className={`mt-2 text-xs sm:text-sm ${active ? 'font-bold text-brand dark:text-[#ff8da3]' : 'font-semibold text-slate-700 dark:text-gray-200'}`}>
                        {label}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------- set 2: needs & volume ---------------------- */}
        <section className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm space-y-6">
          <SectionHeader
            icon={SlidersHorizontal}
            eyebrow="Question Set 2"
            hint="Requirements Calibration"
            title="Needs & Monthly Verification Volume"
          />
          <div className="space-y-6">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <FieldLabel>What do you need apart from email verification?</FieldLabel>
                <span className="text-[11px] text-slate-400 dark:text-gray-500 font-medium">Select all that apply</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {NEEDS.map(({ label, icon: Icon }) => {
                  const active = needs.includes(label)
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleNeed(label)}
                      className={`rounded-xl p-3.5 flex items-center justify-between text-left transition-all ${
                        active ? 'border-2 border-brand bg-brand-light' : 'border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] hover:border-slate-300 dark:hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-brand dark:text-[#ff8da3]' : 'text-slate-600 dark:text-gray-300'}`} />
                        <span className={`text-xs sm:text-sm leading-snug ${active ? 'font-bold text-brand dark:text-[#ff8da3]' : 'font-semibold text-slate-700 dark:text-gray-200'}`}>
                          {label}
                        </span>
                      </div>
                      {active ? (
                        <CheckCircle2 className="h-[18px] w-[18px] text-brand dark:text-[#ff8da3] shrink-0" />
                      ) : (
                        <span className="h-[18px] w-[18px] rounded-full border-2 border-slate-300 dark:border-white/20 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2.5">
              <FieldLabel>Estimated # of emails you need to verify/find monthly</FieldLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {VOLUMES.map(({ range, tier }) => {
                  const active = volume === range
                  return (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setVolume(range)}
                      className={`p-3 rounded-xl text-left transition-all ${
                        active ? 'border-2 border-brand bg-brand-light shadow-sm' : 'border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] hover:border-slate-300 dark:hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs uppercase ${active ? 'text-brand dark:text-[#ff8da3] font-bold' : 'text-slate-400 dark:text-gray-500 font-semibold'}`}>{range}</span>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-brand" />}
                      </div>
                      <div className={`text-sm font-bold mt-1 ${active ? 'text-brand dark:text-[#ff8da3]' : 'text-slate-800 dark:text-gray-100'}`}>{tier}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------- set 3: LTD & discovery ---------------------- */}
        <section className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 border border-slate-200 dark:border-white/10 shadow-sm space-y-6">
          <SectionHeader icon={BadgePercent} eyebrow="Question Set 3" hint="Offers & Attribution" title="Lifetime Deal & Discovery Channel" />
          <div className="space-y-6">
            <div className="space-y-2.5">
              <FieldLabel>Are you interested in our exclusive Lifetime Deal (LTD) offer?</FieldLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLtd('yes')}
                  className={`p-4 rounded-xl text-left flex items-start space-x-3.5 transition-all ${
                    ltd === 'yes' ? 'border-2 border-brand bg-brand-light shadow-sm' : 'border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] hover:border-slate-300 dark:hover:border-white/25'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      ltd === 'yes' ? 'border-2 border-brand bg-brand-light' : 'border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1a1a1a]'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${ltd === 'yes' ? 'bg-brand' : 'bg-transparent'}`} />
                  </span>
                  <span className="space-y-1">
                    <span className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">Yes, notify me of Lifetime Deal access</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand text-white uppercase tracking-wider">Limited Slots</span>
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-gray-300">
                      Lock in one-time pricing for unlimited verification runs, dedicated API tokens, and prioritized queueing.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setLtd('no')}
                  className={`p-4 rounded-xl text-left flex items-start space-x-3.5 transition-all ${
                    ltd === 'no' ? 'border-2 border-brand bg-brand-light shadow-sm' : 'border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] hover:border-slate-300 dark:hover:border-white/25'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      ltd === 'no' ? 'border-2 border-brand bg-brand-light' : 'border border-slate-300 dark:border-white/20 bg-white dark:bg-[#1a1a1a]'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${ltd === 'no' ? 'bg-brand' : 'bg-transparent'}`} />
                  </span>
                  <span className="space-y-1">
                    <span className="block text-sm font-semibold text-slate-800 dark:text-gray-100">No, I prefer monthly / pay-as-you-go</span>
                    <span className="block text-xs text-slate-500 dark:text-gray-400">
                      Standard flexible monthly tiers with on-demand credit top-ups as our verification volume varies.
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <FieldLabel>Where did you hear about Mailsfinder?</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {SOURCES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSource(s)}
                    className={`px-3 py-2 rounded-xl text-xs sm:text-sm transition-all ${source === s ? chipActive : chipIdle}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------- set 4: live sandbox ---------------------- */}
        <section className="bg-white dark:bg-[#1a1a1a] rounded-2xl p-6 border-2 border-brand-border shadow-sm space-y-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-brand-light rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/5">
            <div className="space-y-1">
              <div className="flex items-center space-x-2.5">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                  Free Trial Activated
                </span>
                {credits !== null && (
                  <span className="text-xs font-mono-code text-slate-400 dark:text-gray-500">{credits.toLocaleString()} Credits Available</span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Test your free trial now — Verify 1 email to unlock your full dashboard</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">
                Run a live 12-factor SMTP handshake right now. Experience sub-400ms syntax and MX verification.
              </p>
            </div>
            <div className="flex items-center space-x-1.5 text-slate-600 dark:text-gray-300 text-xs font-semibold bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 shrink-0 self-start sm:self-auto">
              <Gauge className="h-4 w-4 text-brand dark:text-[#ff8da3]" />
              <span>
                Latency: <strong className="text-slate-900 dark:text-white font-bold">~380ms</strong>
              </span>
            </div>
          </div>

          <form
            className="grid grid-cols-1 sm:grid-cols-12 gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              runSandboxVerification()
            }}
          >
            <div className="sm:col-span-8 space-y-1.5">
              <FieldLabel htmlFor="test-email-input">Work Email Address to Verify</FieldLabel>
              <div className="relative">
                <input
                  id="test-email-input"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="e.g. satya.nadella@microsoft.com"
                  className="w-full h-11 px-3 pl-10 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-colors"
                />
                <AtSign className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-gray-500 pointer-events-none" />
              </div>
            </div>
            <div className="sm:col-span-4 flex items-end">
              <button
                type="submit"
                disabled={isVerifying}
                className="w-full h-11 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center space-x-2 shadow-sm shadow-brand/25 transition-all duration-150"
              >
                {isVerifying ? <Loader2 className="h-[19px] w-[19px] animate-spin" /> : <BadgeCheck className="h-[19px] w-[19px]" />}
                <span>{isVerifying ? 'Verifying…' : 'Verify Email'}</span>
              </button>
            </div>
          </form>

          {sandbox ? (
            <SandboxResultCard result={sandbox} />
          ) : (
            <div className="bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/15 rounded-xl p-5 text-center text-xs text-slate-400 dark:text-gray-500">
              Enter a work email above and run a verification to see live MX, SMTP and catch-all diagnostics here.
            </div>
          )}
        </section>

        {/* ---------------------------- footer ---------------------------- */}
        <footer className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={() => finish(true)}
            disabled={isSaving}
            className="text-sm font-semibold text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors py-2 px-1 text-left flex items-center gap-1.5 disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" />
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => finish(false)}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-hover active:bg-brand-dark disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-sm shadow-brand/25 transition-all duration-150"
          >
            {isSaving ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : null}
            <span>Save &amp; Enter Workspace</span>
            {!isSaving && <ArrowRight className="h-[18px] w-[18px]" />}
          </button>
        </footer>
      </div>
    </div>
  )
}
