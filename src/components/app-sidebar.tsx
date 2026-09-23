'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  UserSearch,
  ShieldCheck,
  Code2,
  CreditCard,
  Zap,
  Settings as SettingsIcon,
  LogOut,
  X,
  Coins,
  PanelLeftClose,
  PanelLeftOpen,
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
  // Domain Search hidden for now — to restore, uncomment the line below
  // and re-add the `Globe` icon to the lucide-react import above.
  // { href: '/domain-search', label: 'Domain Search', icon: Globe },
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
  collapsed,
  onNavigate,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  active: boolean
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      // Collapsed rails have no visible label, so the accessible name and the
      // hover tooltip both come from `label`.
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={[
        'relative flex items-center gap-3 py-2 rounded-lg text-sm transition-colors',
        collapsed ? 'justify-center px-2' : 'justify-between px-3',
        active
          ? 'bg-brand-light text-brand font-semibold border border-brand-border/60 dark:bg-brand/15 dark:border-brand/30'
          : 'text-gray-600 dark:text-gray-300 font-medium border border-transparent hover:text-ink dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5',
      ].join(' ')}
    >
      <span className={collapsed ? '' : 'flex items-center gap-3 min-w-0'}>
        <Icon
          className={[
            'h-[18px] w-[18px] shrink-0',
            active ? 'text-brand' : 'text-gray-400 dark:text-gray-500',
          ].join(' ')}
        />
        {!collapsed && <span className="truncate">{label}</span>}
      </span>
      {badge && !collapsed && (
        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded shrink-0">
          {badge}
        </span>
      )}
      {/* Keep the badge's signal without its text when collapsed. */}
      {badge && collapsed && (
        <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
      )}
    </Link>
  )
}

export function AppSidebar({
  profile,
  onSignOut,
  onNavigate,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  profile: SidebarProfile
  onSignOut: () => void
  onNavigate?: () => void
  onClose?: () => void
  /** Icon-only rail. Desktop only — the mobile drawer always renders full. */
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const credits = Math.max(Number(profile.credits || 0), 0)
  const planLabel = (profile.plan || 'free').toString()
  /** Short form so a six-figure balance still fits the 64px rail. */
  const compactCredits =
    credits >= 1_000_000
      ? `${(credits / 1_000_000).toFixed(credits % 1_000_000 === 0 ? 0 : 1)}M`
      : credits >= 1_000
        ? `${Math.round(credits / 1_000)}k`
        : credits.toString()

  return (
    <aside
      className={[
        'relative flex-shrink-0 bg-white dark:bg-[#121212] border-r border-gray-200 dark:border-white/10',
        'flex flex-col justify-between h-full z-30 select-none transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-64',
      ].join(' ')}
    >
      {/* Collapse handle — sits on the border so it needs no header width. */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:flex absolute top-8 -right-3 z-40 h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-400 hover:text-brand hover:border-brand-border dark:hover:border-brand/30 shadow-2xs transition-colors"
        >
          {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      )}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Logo header */}
        <div
          className={[
            'h-16 flex items-center justify-between border-b border-gray-100 dark:border-white/10 shrink-0',
            collapsed ? 'px-0 justify-center' : 'px-5',
          ].join(' ')}
        >
          <Link
            href="/home"
            onClick={onNavigate}
            title={collapsed ? 'Mailsfinder' : undefined}
            className="flex items-center gap-2.5"
          >
            <Image
              src="/favicon-v2.png"
              alt="Mailsfinder"
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
              priority
            />
            {!collapsed && (
              <span className="text-lg font-bold tracking-tight text-ink dark:text-white">Mailsfinder</span>
            )}
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
        <div className={collapsed ? 'px-2 pt-4' : 'px-3 pt-4'}>
          {collapsed ? (
            <span className="sr-only">Prospecting Tools</span>
          ) : (
            <p className="px-3 pb-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Prospecting Tools
            </p>
          )}
          <nav aria-label="Prospecting Tools" className="flex flex-col gap-0.5">
            {PROSPECTING.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                active={isActive(item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        </div>

        {/* Developer & account */}
        <div className={collapsed ? 'px-2 pt-5 pb-4' : 'px-3 pt-5 pb-4'}>
          {collapsed ? (
            <div className="mx-2 mb-2 border-t border-gray-100 dark:border-white/10" aria-hidden="true" />
          ) : (
            <p className="px-3 pb-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Developer &amp; Account
            </p>
          )}
          <nav aria-label="Developer and Account" className="flex flex-col gap-0.5">
            {ACCOUNT.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                active={isActive(item.href)}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* Bottom: credits + user */}
      <div
        className={[
          'border-t border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02]',
          'flex flex-col gap-3 shrink-0',
          collapsed ? 'p-2' : 'p-3',
        ].join(' ')}
      >
        {collapsed ? (
          <Link
            href="/credits"
            onClick={onNavigate}
            title={`${credits.toLocaleString()} credits left · ${planLabel}`}
            aria-label={`Available credits: ${credits.toLocaleString()} left`}
            className="flex flex-col items-center gap-1 py-2 rounded-lg bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 shadow-2xs hover:border-gray-300 dark:hover:border-white/20 transition-colors"
          >
            <Coins className="h-4 w-4 text-brand" />
            <span className="text-[10px] font-bold text-ink dark:text-white tabular-nums leading-none">
              {compactCredits}
            </span>
          </Link>
        ) : (
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
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={collapsed ? profile.full_name || profile.email : undefined}
              aria-label={collapsed ? `Account: ${profile.full_name || profile.email}` : undefined}
              className={[
                'w-full flex items-center rounded-lg hover:bg-white dark:hover:bg-white/5 transition-colors',
                'border border-transparent hover:border-gray-200 dark:hover:border-white/10 text-left',
                collapsed ? 'justify-center px-0 py-1.5' : 'justify-between px-2 py-1.5',
              ].join(' ')}
            >
              <span className={collapsed ? '' : 'flex items-center gap-2.5 overflow-hidden'}>
                <span className="w-8 h-8 shrink-0 rounded-full bg-brand-light dark:bg-brand/20 text-brand border border-brand-border dark:border-brand/30 flex items-center justify-center text-xs font-bold">
                  {initialsOf(profile.full_name, profile.email)}
                </span>
                {!collapsed && (
                  <span className="truncate">
                    <span className="block text-xs font-semibold text-ink dark:text-white leading-tight truncate">
                      {profile.full_name || 'User'}
                    </span>
                    <span className="block text-[11px] text-gray-400 truncate leading-tight">
                      {profile.email}
                    </span>
                  </span>
                )}
              </span>
              {!collapsed && <SettingsIcon className="h-4 w-4 text-gray-400 shrink-0" />}
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
