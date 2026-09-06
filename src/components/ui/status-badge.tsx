import { Badge } from '@/components/ui/badge'

/**
 * Shared verification/find status badge.
 *
 * Styling follows the Stitch "Chips & Verification Status Badges" spec:
 * a 24px pill with a 6px semantic dot — emerald for deliverable, amber for
 * risky/catch-all, red for invalid, slate for unknown/guessed.
 *
 * The status values and labels are unchanged; only the presentation differs.
 */
function Dot({ className }: { className: string }) {
  return <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full shrink-0 ${className}`} />
}

const VALID =
  'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-[#059669]/15 dark:text-[#34D399] dark:border-[#059669]/30'
const RISKY =
  'bg-[#FFFBEB] text-[#D97706] border-[#FDE68A] dark:bg-[#D97706]/15 dark:text-[#FBBF24] dark:border-[#D97706]/30'

export function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase()

  if (s === 'valid' || s === 'found') {
    return (
      <Badge className={VALID}>
        <Dot className="bg-[#059669] dark:bg-[#34D399]" />
        {s === 'found' ? 'Found' : 'Valid'}
      </Badge>
    )
  }
  if (s === 'invalid') {
    return (
      <Badge variant="destructive">
        <Dot className="bg-[#DC2626] dark:bg-[#F87171]" />
        Invalid
      </Badge>
    )
  }
  if (s === 'risky' || s === 'catch_all') {
    return (
      <Badge className={RISKY}>
        <Dot className="bg-[#D97706] dark:bg-[#FBBF24]" />
        {s === 'catch_all' ? 'Catch-All' : 'Risky'}
      </Badge>
    )
  }
  if (s === 'unknown' || s === 'guessed') {
    return (
      <Badge variant="secondary">
        <Dot className="bg-[#94A3B8]" />
        {s === 'guessed' ? 'Guessed' : 'Unknown'}
      </Badge>
    )
  }
  return <Badge variant="outline">{status || 'Unknown'}</Badge>
}
