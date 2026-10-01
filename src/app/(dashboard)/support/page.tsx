'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { LifeBuoy, Lock, Mail, MessageCircle } from 'lucide-react'
import { useUserProfile } from '@/hooks/useCreditsData'
import {
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_DISPLAY,
  appsumoTier,
  supportChannelFor,
  supportMailtoHref,
  supportWhatsappHref,
} from '@/lib/support'

/**
 * Support — AppSumo license holders only.
 *
 * Tier 1 and Tier 2 get the email inbox; Tier 3 and Tier 4 get a direct WhatsApp
 * chat. The tier is read from the plan the profile already carries, so no new
 * API call is involved. Everyone who is not an AppSumo buyer sees the same
 * "not part of your plan" fallback the skills page uses — the sidebar entry is
 * hidden for them, so this only shows for someone typing the URL in.
 */
export default function SupportPage() {
  const { data: profile, isLoading } = useUserProfile()

  /* ------------------------------- loading -------------------------------- */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full sm:w-56" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const tier = appsumoTier(profile?.plan)
  const channel = supportChannelFor(profile?.plan)

  /* ------------------- not an AppSumo license: no channel ------------------ */
  if (channel === null) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Support</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Priority support is included with AppSumo licenses. For help with your current plan,
          email us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/credits">View my plan</Link>
        </Button>
      </div>
    )
  }

  const accountEmail = profile?.email ?? null

  return (
    <div className="space-y-6">
      {/* ------------------------------ header ------------------------------- */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">Support</h1>
          {tier !== null && <Badge variant="secondary">AppSumo Tier {tier}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {channel === 'whatsapp'
            ? 'Your license includes direct WhatsApp support. Message us and we will reply as soon as we can.'
            : 'Your license includes email support. Write to us and we will get back to you.'}
        </p>
      </div>

      {/* ------------------------------ channel ------------------------------ */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
              {channel === 'whatsapp' ? (
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Mail className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">
                {channel === 'whatsapp' ? 'WhatsApp support' : 'Email support'}
              </CardTitle>
              <CardDescription className="break-words">
                {channel === 'whatsapp' ? SUPPORT_WHATSAPP_DISPLAY : SUPPORT_EMAIL}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {channel === 'whatsapp'
              ? 'Opens a WhatsApp chat with our support team. Include your account email so we can find you faster.'
              : 'Opens your email app with a new message to our support team.'}
          </p>

          {channel === 'whatsapp' ? (
            <Button asChild className="w-full sm:w-auto">
              {/* External app link: new tab, and noopener since target is _blank. */}
              <a
                href={supportWhatsappHref(accountEmail, tier)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Chat on WhatsApp
              </a>
            </Button>
          ) : (
            <Button asChild className="w-full sm:w-auto">
              {/* mailto: must stay same-tab so the OS handler takes over. */}
              <a href={supportMailtoHref(accountEmail, tier)}>
                <Mail className="mr-2 h-4 w-4" />
                Email support
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------- footer ------------------------------ */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground">
        <LifeBuoy className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Include the email address on your Mailsfinder account when you reach out — it is the
          fastest way for us to look up your license.
        </p>
      </div>
    </div>
  )
}
