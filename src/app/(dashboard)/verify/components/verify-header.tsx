'use client'

/**
 * Page header: eyebrow, title and one-line purpose, styled to the Stitch
 * "Email Deliverability Verifier" screen.
 *
 * The credit balance is intentionally not repeated here — it already lives in
 * the app header, and the Stitch review called out the duplicate on this page.
 * The `credits` prop is kept so the existing call site is unchanged.
 */
export function VerifyHeader({ credits: _credits }: { credits?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
          Deliverability Verifier
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">
          Email Deliverability Verifier
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          Check deliverability before you send — one address or a whole list.
        </p>
      </div>
    </div>
  )
}
