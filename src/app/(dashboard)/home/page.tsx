'use client'

import Link from 'next/link'
import {
  Search,
  Users,
  CheckCircle,
  CreditCard,
  Code2,
  PlayCircle,
  Lock,
  Zap,
  TrendingUp,
  CalendarClock,
  BadgeCheck,
  UploadCloud,
  ArrowRight,
} from 'lucide-react'
import { useCreditsData } from '@/hooks/useCreditsData'
import { toast } from 'sonner'

/** Stitch metric tile: label, value, and a tinted icon chip. */
function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  tint,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  tint: string
}) {
  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-xl p-5 border border-gray-200 dark:border-white/10 shadow-2xs flex flex-col justify-between hover:border-gray-300 dark:hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <span className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center ${tint}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3">
        <p className="text-[26px] leading-none font-bold tracking-tight text-ink dark:text-white tabular-nums">
          {value}
        </p>
        {sub && <p className="mt-2 text-[11px] font-medium text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

export default function HomePage() {
  const { profile, creditUsage } = useCreditsData()
  const isLifetime = (profile?.plan || '').toString().trim().toLowerCase() === 'lifetime'
  const communityLink = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_LINK || 'https://chat.whatsapp.com/'

  const firstName = (profile?.full_name || '').toString().trim().split(/\s+/)[0] || 'there'
  const credits = Math.max(Number(profile?.available_credits ?? 0), 0)

  // Derived from the credit-usage series this page already loads.
  const usage = Array.isArray(creditUsage) ? creditUsage : []
  const usedTotal = usage.reduce((sum, d) => sum + (Number(d?.totalCreditsUsed) || 0), 0)
  const todayKey = new Date().toISOString().slice(0, 10)
  const usedToday = usage
    .filter((d) => String(d?.date || '').slice(0, 10) === todayKey)
    .reduce((sum, d) => sum + (Number(d?.totalCreditsUsed) || 0), 0)
  const planLabel = (profile?.plan || 'free').toString()

  const features = [
    {
      title: 'Find Email',
      description: 'Find professional email addresses.',
      href: '/find',
      icon: Search,
      cta: 'Launch finder',
    },
    {
      title: 'Bulk Find Email',
      description: 'Process lists to find emails in bulk.',
      href: '/bulk-finder',
      icon: Users,
      cta: 'Upload list',
    },
    {
      title: 'Verify Email',
      description: 'Validate deliverability and status.',
      href: '/verify',
      icon: CheckCircle,
      cta: 'Run verification',
    },
    {
      title: 'Credits & Billing',
      description: 'Manage credits and payments.',
      href: '/credits',
      icon: CreditCard,
      cta: 'View billing',
    },
    {
      title: 'API',
      description: 'Use programmatic access for automation.',
      href: '/api-calls',
      icon: Code2,
      cta: 'View API docs',
    },
    {
      title: 'Video Tutorials',
      description: 'Learn how to use MailFinder.',
      href: '/video-tutorials',
      icon: PlayCircle,
      cta: 'Watch tutorials',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Here&apos;s what&apos;s happening across your email prospecting and verification queues today.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/bulk-finder"
            className="h-9 px-3.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 font-semibold text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 hover:border-gray-300 transition-colors flex items-center gap-2 shadow-2xs"
          >
            <UploadCloud className="h-4 w-4 text-gray-500" />
            <span>Upload CSV for Bulk Find</span>
          </Link>
          <Link
            href="/find"
            className="h-9 px-3.5 bg-brand text-white font-bold text-xs rounded-lg hover:bg-brand-hover transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Search className="h-4 w-4" />
            <span>Find Single Email</span>
          </Link>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Available Credits"
          value={credits.toLocaleString()}
          sub="Spendable balance"
          icon={Zap}
          tint="bg-brand-light text-brand dark:bg-brand/15"
        />
        <MetricCard
          label="Credits Used"
          value={usedTotal.toLocaleString()}
          sub="Across recorded usage"
          icon={TrendingUp}
          tint="bg-[#ECFDF5] text-[#059669] dark:bg-[#059669]/15"
        />
        <MetricCard
          label="Used Today"
          value={usedToday.toLocaleString()}
          sub="Resets daily"
          icon={CalendarClock}
          tint="bg-[#EFF6FF] text-[#2563EB] dark:bg-[#2563EB]/15"
        />
        <MetricCard
          label="Current Plan"
          value={planLabel.charAt(0).toUpperCase() + planLabel.slice(1)}
          sub="Manage in Billing & Quota"
          icon={BadgeCheck}
          tint="bg-[#FFFBEB] text-[#D97706] dark:bg-[#D97706]/15"
        />
      </div>

      {/* Tool grid */}
      <div>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="flex items-center gap-2 text-[11px] font-bold text-ink dark:text-white uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
            Core Engines &amp; Workflows
          </h2>
          <span className="text-[11px] text-gray-400 hidden sm:block">
            High-throughput lead enrichment tools
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ title, description, href, icon: Icon, cta }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white dark:bg-[#1a1a1a] rounded-xl p-5 border border-gray-200 dark:border-white/10 shadow-2xs hover:border-gray-300 dark:hover:border-white/20 hover:shadow-card-hover transition-all flex flex-col"
            >
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 shrink-0 rounded-lg bg-brand-light dark:bg-brand/15 text-brand flex items-center justify-center">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <h3 className="text-[15px] font-semibold text-ink dark:text-white tracking-tight">
                  {title}
                </h3>
              </div>
              <p className="mt-3 text-[13px] leading-5 text-gray-500 dark:text-gray-400 flex-1">
                {description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 group-hover:text-brand transition-colors">
                {cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}

          {/* Community card — lifetime-gated, behaviour unchanged */}
          {isLifetime ? (
            <Link
              href={communityLink}
              className="group bg-white dark:bg-[#1a1a1a] rounded-xl p-5 border border-gray-200 dark:border-white/10 shadow-2xs hover:border-gray-300 dark:hover:border-white/20 hover:shadow-card-hover transition-all flex flex-col"
            >
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 shrink-0 rounded-lg bg-brand-light dark:bg-brand/15 text-brand flex items-center justify-center">
                  <Users className="h-[18px] w-[18px]" />
                </span>
                <h3 className="text-[15px] font-semibold text-ink dark:text-white tracking-tight">
                  Join Our Community
                </h3>
              </div>
              <p className="mt-3 text-[13px] leading-5 text-gray-500 dark:text-gray-400 flex-1">
                Access the WhatsApp community
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 group-hover:text-brand transition-colors">
                Open community
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ) : (
            <div
              role="button"
              tabIndex={-1}
              aria-disabled="true"
              onClick={() =>
                toast.info('Community is available only for Lifetime plan users. Upgrade to access.')
              }
              className="bg-white/70 dark:bg-[#1a1a1a]/70 rounded-xl p-5 border border-gray-200/70 dark:border-white/10 shadow-2xs opacity-60 cursor-not-allowed flex flex-col"
            >
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 shrink-0 rounded-lg bg-brand-light dark:bg-brand/15 text-brand flex items-center justify-center">
                  <Users className="h-[18px] w-[18px]" />
                </span>
                <h3 className="text-[15px] font-semibold text-ink dark:text-white tracking-tight flex-1">
                  Join Our Community
                </h3>
                <Lock className="h-4 w-4 text-gray-400 shrink-0" />
              </div>
              <p className="mt-3 text-[13px] leading-5 text-gray-500 dark:text-gray-400 flex-1">
                WhatsApp community
              </p>
              <span className="mt-4 text-[11px] font-medium text-gray-400">
                Only for Lifetime Plan Users
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
