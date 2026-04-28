'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useRecentFindResults, useRecentVerifyResults, useClearRecentResults } from '@/hooks/useRecentResults'
import { Loader2, Trash2, Clock } from 'lucide-react'
import type { RecentFindResult, RecentVerifyResult } from '@/types/jobs'

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  if (s === 'valid' || s === 'found') {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">{s === 'found' ? 'Found' : 'Valid'}</Badge>
  }
  if (s === 'invalid') {
    return <Badge variant="destructive">Invalid</Badge>
  }
  if (s === 'risky' || s === 'catch_all') {
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">{s === 'catch_all' ? 'Catch-All' : 'Risky'}</Badge>
  }
  if (s === 'unknown' || s === 'guessed') {
    return <Badge variant="secondary">{s === 'guessed' ? 'Guessed' : 'Unknown'}</Badge>
  }
  return <Badge variant="outline">{status || 'Unknown'}</Badge>
}

export function RecentFindResultsTable() {
  const { data: results, isLoading } = useRecentFindResults()
  const clearMutation = useClearRecentResults('find')

  if (isLoading) return null
  if (!results || results.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Recent Searches
          </CardTitle>
          <CardDescription>Your last {results.length} email find results</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={clearMutation.isPending}
          onClick={() => clearMutation.mutate()}
        >
          {clearMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          <span className="ml-1.5 hidden sm:inline">Clear</span>
        </Button>
      </CardHeader>
      <CardContent>
        {/* Header */}
        <div className="hidden sm:grid sm:grid-cols-[1fr_1.5fr_80px_80px_80px_80px] gap-3 px-3 pb-2 text-xs font-medium text-muted-foreground border-b">
          <span>Name</span>
          <span>Email Found</span>
          <span>Status</span>
          <span>Confidence</span>
          <span>Provider</span>
          <span>Date</span>
        </div>
        <div className="divide-y">
          {results.map((item: RecentFindResult, i: number) => (
            <div
              key={`${item.result.email}-${item.created_at}-${i}`}
              className="grid grid-cols-2 sm:grid-cols-[1fr_1.5fr_80px_80px_80px_80px] gap-3 px-3 py-2.5 items-center text-sm"
            >
              <span className="font-medium truncate">{item.result.full_name || '--'}</span>
              <span className="text-muted-foreground font-mono text-xs truncate">
                {item.result.email || '--'}
              </span>
              <StatusBadge status={item.result.status} />
              <span className="text-muted-foreground">
                {typeof item.result.confidence_score === 'number'
                  ? (item.result.confidence_score <= 1
                    ? Math.round(item.result.confidence_score * 100)
                    : Math.round(item.result.confidence_score))
                  : '--'}
              </span>
              <span className="text-muted-foreground text-xs truncate">
                {item.result.email_provider || '--'}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatRelativeDate(item.created_at)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function RecentVerifyResultsTable() {
  const { data: results, isLoading } = useRecentVerifyResults()
  const clearMutation = useClearRecentResults('verify')

  if (isLoading) return null
  if (!results || results.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Recent Verifications
          </CardTitle>
          <CardDescription>Your last {results.length} email verify results</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={clearMutation.isPending}
          onClick={() => clearMutation.mutate()}
        >
          {clearMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          <span className="ml-1.5 hidden sm:inline">Clear</span>
        </Button>
      </CardHeader>
      <CardContent>
        {/* Header */}
        <div className="hidden sm:grid sm:grid-cols-[1.5fr_80px_80px_80px_80px] gap-3 px-3 pb-2 text-xs font-medium text-muted-foreground border-b">
          <span>Email</span>
          <span>Status</span>
          <span>Confidence</span>
          <span>Provider</span>
          <span>Date</span>
        </div>
        <div className="divide-y">
          {results.map((item: RecentVerifyResult, i: number) => (
            <div
              key={`${item.result.email}-${item.created_at}-${i}`}
              className="grid grid-cols-2 sm:grid-cols-[1.5fr_80px_80px_80px_80px] gap-3 px-3 py-2.5 items-center text-sm"
            >
              <span className="font-mono text-xs truncate">{item.result.email}</span>
              <StatusBadge status={item.result.catch_all ? 'catch_all' : item.result.status} />
              <span className="text-muted-foreground">
                {typeof item.result.confidence_score === 'number'
                  ? (item.result.confidence_score <= 1
                    ? Math.round(item.result.confidence_score * 100)
                    : Math.round(item.result.confidence_score))
                  : '--'}
              </span>
              <span className="text-muted-foreground text-xs truncate">
                {item.result.email_provider || '--'}
              </span>
              <span className="text-muted-foreground text-xs">
                {formatRelativeDate(item.created_at)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
