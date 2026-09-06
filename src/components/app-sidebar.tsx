'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  UserSearch,
  ShieldCheck,
  Globe,
  Code2,
  CreditCard,
  Zap,
  Settings as SettingsIcon,
  LogOut,
  X,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface SidebarProfile {
  full_name: string | null
  email: string
  credits: number
  plan: string
}

const PROSPECTING = [
  { href: '/home', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/find', label: 'Find Email', icon: UserSearch },
  { href: '/verify', label: 'Verify Email', icon: ShieldCheck },
  { href: '/domain-search', label: 'Domain Search', icon: Globe },
]

const ACCOUNT = [
  { href: '/api-calls', label: 'API', icon: Code2 },
  { href: '/credits', label: 'Billing & Quota', icon: CreditCard },
  { href: '/upgrade', label: 'Upgrade Plan', icon: Zap, badge: 'Pro' },
  { href: '/user', label: 'Settings', icon: SettingsIcon },
]

function initialsOf(name: string | null, email: string) {
  const source = (name || email || 'U').trim()
  const parts = source.split(/[\s@.]+/).filter(Boolean)
  return ((parts[0]?.[0] || 'U') + (parts[1]?.[0] || '')).toUpperCase()
}

function NavItem({
  href,
  label,
  icon: Icon,
  badge,
  active,
  onNavigate,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  active: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
        active
          ? 'bg-brand-light text-brand font-semibold border border-brand-border/60 dark:bg-brand/15 dark:border-brand/30'
          : 'text-gray-600 dark:text-gray-300 font-medium border border-transparent hover:text-ink dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5',
      ].join(' ')}
    >
      <span className="flex items-center gap-3 min-w-0">
        <Icon
          className={[
            'h-[18px] w-[18px] shrink-0',
            active ? 'text-brand' : 'text-gray-400 dark:text-gray-500',
          ].join(' ')}
        />
        <span className="truncate">{label}</span>
      </span>
      {badge && (
        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded shrink-0">
          {badge}
        </span>
      )}
    </Link>
  )
}

export function AppSidebar({
  profile,
  onSignOut,
  onNavigate,
  onClose,
}: {
  profile: SidebarProfile
  onSignOut: () => void
  onNavigate?: () => void
  onClose?: () => void
}) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const credits = Math.max(Number(profile.credits || 0), 0)
  const planLabel = (profile.plan || 'free').toString()

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-[#121212] border-r border-gray-200 dark:border-white/10 flex flex-col justify-between h-full z-30 select-none">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Logo header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-gray-100 dark:border-white/10 shrink-0">
          <Link href="/home" onClick={onNavigate} className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand text-white">
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
                <path d="M20 4H4a2 2 0 0 0-2 2v.5l10 6 10-6V6a2 2 0 0 0-2-2Zm0 4.236-8 4.8-8-4.8V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.236Z" />
              </svg>
            </span>
            <span className="text-lg font-bold tracking-tight text-ink dark:text-white">Mailsfinder</span>
          </Link>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="lg:hidden p-1 rounded-md text-gray-400 hover:text-ink hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Prospecting tools */}
        <div className="px-3 pt-4">
          <p className="px-3 pb-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Prospecting Tools
          </p>
          <nav className="flex flex-col gap-0.5">
            {PROSPECTING.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>

        {/* Developer & account */}
        <div className="px-3 pt-5 pb-4">
          <p className="px-3 pb-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            Developer &amp; Account
          </p>
          <nav className="flex flex-col gap-0.5">
            {ACCOUNT.map((item) => (
              <NavItem key={item.href} {...item} active={isActive(item.href)} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>
      </div>

      {/* Bottom: credits + user */}
      <div className="p-3 border-t border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02] flex flex-col gap-3 shrink-0">
        <Link
          href="/credits"
          onClick={onNavigate}
          className="bg-white dark:bg-[#1a1a1a] p-3 rounded-lg border border-gray-200 dark:border-white/10 shadow-2xs hover:border-gray-300 dark:hover:border-white/20 transition-colors"
        >
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-gray-500 dark:text-gray-400">Available Credits</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-brand bg-brand-light dark:bg-brand/15 border border-brand-border dark:border-brand/30 px-1.5 py-0.5 rounded">
              {planLabel}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-ink dark:text-white tabular-nums leading-none">
              {credits.toLocaleString()}
            </span>
            <span className="text-[11px] text-gray-400">left</span>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white dark:hover:bg-white/5 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-white/10 text-left"
            >
              <span className="flex items-center gap-2.5 overflow-hidden">
                <span className="w-8 h-8 shrink-0 rounded-full bg-brand-light dark:bg-brand/20 text-brand border border-brand-border dark:border-brand/30 flex items-center justify-center text-xs font-bold">
                  {initialsOf(profile.full_name, profile.email)}
                </span>
                <span className="truncate">
                  <span className="block text-xs font-semibold text-ink dark:text-white leading-tight truncate">
                    {profile.full_name || 'User'}
                  </span>
                  <span className="block text-[11px] text-gray-400 truncate leading-tight">
                    {profile.email}
                  </span>
                </span>
              </span>
              <SettingsIcon className="h-4 w-4 text-gray-400 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56 dark:bg-[#121212] dark:text-gray-100">
            <div className="px-3 py-2 text-sm">
              <div className="font-medium">{profile.full_name || 'User'}</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs">{profile.email}</div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/user">
                <SettingsIcon className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/credits">
                <CreditCard className="mr-2 h-4 w-4" />
                Credits &amp; Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
