'use client'

/**
 * Thin, guarded access to the PostHog browser SDK.
 *
 * The SDK is installed via the official snippet in `app/layout.tsx` rather than
 * the npm package, matching how GTM and Tawk.to are already loaded here. The
 * snippet defines `window.posthog` as a queueing stub before `array.js` arrives,
 * so calls made early are replayed once it loads — but the stub only exists
 * after that script has run, and never during SSR. Every helper below therefore
 * no-ops rather than throwing when it is absent.
 */

type PostHogBrowser = {
  identify: (distinctId: string, properties?: Record<string, unknown>) => void
  capture: (event: string, properties?: Record<string, unknown>) => void
  reset: () => void
}

declare global {
  interface Window {
    posthog?: PostHogBrowser
  }
}

function client(): PostHogBrowser | null {
  if (typeof window === 'undefined') return null
  return window.posthog ?? null
}

/**
 * Attaches app activity to a person so it joins up with the marketing-site
 * visit from the same browser.
 *
 * `distinctId` must be the immutable internal user id, never the email: if a
 * customer later changes their address, an email-keyed history splits in two.
 */
export function identifyUser(
  distinctId: string,
  properties?: Record<string, unknown>
) {
  if (!distinctId) return
  client()?.identify(distinctId, properties)
}

export function captureEvent(event: string, properties?: Record<string, unknown>) {
  client()?.capture(event, properties)
}

/**
 * Clears the stored identity on logout. Without it, the next person to log in
 * on a shared machine inherits the previous user's identity.
 */
export function resetPostHog() {
  client()?.reset()
}

/**
 * Reads the `mf_attr` first-party cookie written by the marketing site on
 * `.mailsfinder.com`. It holds the first landing page, referrer and UTMs, plus
 * the last signup CTA clicked. Readable here because it is set on the parent
 * domain.
 */
export type MarketingAttribution = {
  lp?: string
  ref?: string
  utm?: Record<string, string>
  cta?: { page?: string; loc?: string; text?: string }
  first_seen?: string
}

export function readMarketingAttribution(): MarketingAttribution {
  if (typeof document === 'undefined') return {}
  const match = document.cookie.match(/(?:^|; )mf_attr=([^;]*)/)
  if (!match) return {}
  try {
    return JSON.parse(decodeURIComponent(match[1])) as MarketingAttribution
  } catch {
    return {}
  }
}
