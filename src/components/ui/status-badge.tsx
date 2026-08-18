import { Badge } from '@/components/ui/badge'

/**
 * Shared verification/find status badge.
 *
 * Class strings are intentionally identical to the original inline version in
 * `recent-results-table.tsx` so every existing surface keeps rendering exactly
 * the same colours in light and dark mode.
 */
export function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  if (s === 'valid' || s === 'found') {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">{s === 'found' ? 'Found' : 'Valid'}</Badge>
  }
  if (s === 'invalid') {
    // `text-destructive-foreground` from the destructive variant resolves to
    // nothing (--destructive-foreground is not defined), so the label inherits
    // its parent colour — near-black on red in light mode. Force white there.
    // `dark:text-inherit` keeps dark mode on the existing inherited colour.
    return <Badge variant="destructive" className="text-white dark:text-inherit">Invalid</Badge>
  }
  if (s === 'risky' || s === 'catch_all') {
    return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">{s === 'catch_all' ? 'Catch-All' : 'Risky'}</Badge>
  }
  if (s === 'unknown' || s === 'guessed') {
    return <Badge variant="secondary">{s === 'guessed' ? 'Guessed' : 'Unknown'}</Badge>
  }
  return <Badge variant="outline">{status || 'Unknown'}</Badge>
}
