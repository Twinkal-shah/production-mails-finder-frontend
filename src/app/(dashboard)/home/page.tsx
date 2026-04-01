'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Users, CheckCircle, CreditCard, Code2, PlayCircle, Lock } from 'lucide-react'
import { useCreditsData } from '@/hooks/useCreditsData'
import { toast } from 'sonner'

export default function HomePage() {
  const { profile } = useCreditsData()
  const isLifetime = (profile?.plan || '').toString().trim().toLowerCase() === 'lifetime'
  const communityLink = process.env.NEXT_PUBLIC_WHATSAPP_COMMUNITY_LINK || 'https://chat.whatsapp.com/'
  const features = [
    {
      title: 'Find Email',
      description: 'Find professional email addresses.',
      href: '/find',
      icon: Search,
    },
    {
      title: 'Bulk Find Email',
      description: 'Process lists to find emails in bulk.',
      href: '/bulk-finder',
      icon: Users,
    },
    {
      title: 'Verify Email',
      description: 'Validate deliverability and status.',
      href: '/verify',
      icon: CheckCircle,
    },
    {
      title: 'Credits & Billing',
      description: 'Manage credits and payments.',
      href: '/credits',
      icon: CreditCard,
    },
    {
      title: 'API',
      description: 'Use programmatic access for automation.',
      href: '/api-calls',
      icon: Code2,
    },
    {
      title: 'Video Tutorials',
      description: 'Learn how to use MailFinder.',
      href: '/video-tutorials',
      icon: PlayCircle,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mailsfinder</h1>
        <p className="text-gray-600 dark:text-gray-300">Quick access to all tools</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map(({ title, description, href, icon: Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="bg-white dark:bg-[#131313] border-gray-200 dark:border-white/10 transition-transform duration-200 ease-out motion-reduce:transition-none relative hover:-translate-y-[2px] hover:scale-[1.01] hover:shadow-none hover:border-gray-200 dark:hover:border-white/10 hover-gradient-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-gray-900 dark:text-gray-50">
                  <span className="inline-flex p-2 rounded-md" style={{ backgroundColor: 'rgba(183,29,63,0.06)', color: 'var(--primary)' }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  {title}
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  {description}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-gray-500 dark:text-gray-400">
                Open {title.toLowerCase()}
              </CardContent>
            </Card>
          </Link>
        ))}
        {isLifetime ? (
          <Link href={communityLink} className="group">
            <Card className="bg-white dark:bg-[#131313] border-gray-200 dark:border-white/10 transition-transform duration-200 ease-out motion-reduce:transition-none relative hover:-translate-y-[2px] hover:scale-[1.01] hover:shadow-none hover:border-gray-200 dark:hover:border-white/10 hover-gradient-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-gray-900 dark:text-gray-50">
                  <span className="inline-flex p-2 rounded-md" style={{ backgroundColor: 'rgba(183,29,63,0.06)', color: 'var(--primary)' }}>
                    <Users className="h-5 w-5" />
                  </span>
                  Join Our Community
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Access the WhatsApp community
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-gray-500 dark:text-gray-400">
                Open community
              </CardContent>
            </Card>
          </Link>
        ) : (
          <div className="group">
            <Card
              className="bg-white/70 dark:bg-[#131313]/70 border-gray-200/70 dark:border-white/20 transition-all opacity-60 relative cursor-not-allowed"
              aria-disabled="true"
              tabIndex={-1}
              onClick={() => toast.info('Community is available only for Lifetime plan users. Upgrade to access.')}
              role="button"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-gray-900 dark:text-gray-50">
                  <span className="inline-flex p-2 rounded-md" style={{ backgroundColor: 'rgba(183,29,63,0.06)', color: 'var(--primary)' }}>
                    <Users className="h-5 w-5" />
                  </span>
                  Join Our Community
                  <Lock className="ml-auto h-4 w-4 text-gray-400 dark:text-gray-500" />
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  WhatsApp community
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-gray-500 dark:text-gray-400">
                <span className="text-xs text-gray-500 dark:text-gray-400">Only for Lifetime Plan Users</span>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
