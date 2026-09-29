'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Loader2, Lock, PackageOpen, Sparkles, Terminal } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'

/**
 * Outbound skills — AppSumo Tier 3 and Tier 4.
 *
 * The skills live in two private repositories; buyers never touch GitHub. The
 * backend decides what each account may see from `appsumo.bundle_level` and
 * streams a zip, so this page renders whatever it is given rather than knowing
 * anything about tiers or skill names itself.
 *
 * Tier 1 and Tier 2 get `available: false` and no skill data at all, which is
 * also why the sidebar entry is hidden for them — this page is the fallback for
 * someone who reaches the URL directly.
 */

/** Standard API envelope: the payload is at `data`, not the top level. */
interface Envelope<T> {
  success?: boolean
  message?: string
  data?: T
}

interface Skill {
  slug: string
  name: string
  description: string
}

interface SkillsPayload {
  available?: boolean
  bundle_level?: number
  bundle_label?: string | null
  tier?: number | null
  tier_label?: string | null
  requires_claude_code?: boolean
  total?: number
  skills?: Skill[]
}

/**
 * Downloads an authenticated file.
 *
 * A plain <a href> cannot carry the bearer token, so the request is made with
 * fetch and the response turned into an object URL. The filename comes from
 * Content-Disposition when present — the server already sanitises it — and
 * falls back to a slug-derived name.
 */
async function downloadZip(path: string, fallbackName: string): Promise<void> {
  const token = getAccessToken()
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })

  if (!res.ok) {
    // Errors come back as JSON even though the happy path is binary.
    let message = 'Download failed. Please try again.'
    try {
      const body = await res.json()
      if (body?.message && typeof body.message === 'string') message = body.message
    } catch {
      /* non-JSON error body — keep the generic message */
    }
    throw new Error(message)
  }

  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="?([^";]+)"?/i)
  const filename = match?.[1] || fallbackName

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function SkillsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function SkillsPage() {
  const [payload, setPayload] = useState<SkillsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Slug currently downloading, or '__all__' for the full bundle. */
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await apiGet<Envelope<SkillsPayload>>('/api/appsumo/skills', { useProxy: true })
        if (cancelled) return
        if (!res.ok) {
          setError('We could not load your skills right now. Please try again shortly.')
          return
        }
        setPayload(res.data?.data ?? {})
      } catch {
        if (!cancelled) setError('We could not load your skills right now. Please try again shortly.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleDownload = useCallback(async (slug: string | null, label: string) => {
    const key = slug ?? '__all__'
    setBusy(key)
    try {
      await downloadZip(
        slug ? `/api/appsumo/skills/${encodeURIComponent(slug)}/download` : '/api/appsumo/skills/download-all',
        slug ? `${slug}.zip` : 'mailsfinder-outbound-skills.zip'
      )
      toast.success(`${label} downloaded`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed. Please try again.')
    } finally {
      setBusy(null)
    }
  }, [])

  /* ------------------------------- loading ------------------------------- */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <SkillsSkeleton />
      </div>
    )
  }

  /* -------------------------------- error -------------------------------- */
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  /* --------------------- not included in this plan ----------------------- */
  if (!payload?.available) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Outbound skills</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Outbound skills are included with AppSumo Tier 3 and Tier 4. Upgrade your license on
          AppSumo to unlock the full library.
        </p>
        <Button asChild className="mt-6">
          <Link href="/credits">View my plan</Link>
        </Button>
      </div>
    )
  }

  const skills = payload.skills ?? []
  const total = payload.total ?? skills.length

  return (
    <div className="space-y-6">
      {/* ------------------------------ header ------------------------------ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Outbound skills</h1>
            {payload.tier_label && <Badge variant="secondary">{payload.tier_label}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {payload.bundle_label ? `${payload.bundle_label} — ` : ''}
            {total} {total === 1 ? 'skill' : 'skills'} included with your license.
          </p>
        </div>

        <Button
          onClick={() => handleDownload(null, 'Full library')}
          disabled={busy !== null}
          className="shrink-0"
        >
          {busy === '__all__' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PackageOpen className="mr-2 h-4 w-4" />
          )}
          Download all
        </Button>
      </div>

      {/* --------------------------- how to install -------------------------- */}
      {payload.requires_claude_code && (
        <Alert>
          <Terminal className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium text-foreground">Requires Claude Code.</span>{' '}
            Each download is a zip containing the skill files and an installer. Unzip it, then run{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">./install.sh</code>{' '}
            (or{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">install.ps1</code>{' '}
            on Windows) from inside the folder.
          </AlertDescription>
        </Alert>
      )}

      {/* ------------------------------ skills ------------------------------ */}
      {skills.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No skills are available right now. Please contact support.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <Card key={skill.slug} className="flex flex-col">
              <CardHeader className="flex-1 space-y-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <CardTitle className="text-base leading-snug text-foreground">
                    {skill.name || skill.slug}
                  </CardTitle>
                </div>
                {skill.description && (
                  <CardDescription className="line-clamp-4 leading-relaxed">
                    {skill.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleDownload(skill.slug, skill.name || skill.slug)}
                  disabled={busy !== null}
                >
                  {busy === skill.slug ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
