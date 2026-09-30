"use client"

import { useEffect, useRef } from "react"
import { identifyUser } from "@/lib/posthog"
import { useUserProfile } from "@/hooks/useCreditsData"

/**
 * Attaches PostHog activity to the signed-in user.
 *
 * Mounted inside the dashboard shell, which already runs `useUserProfile()` —
 * React Query dedupes on the shared `['userProfile']` key, so this adds no
 * network request of its own.
 *
 * This covers both cases the install doc calls for: login and signup end in a
 * full page reload into the dashboard, and an already-logged-in session
 * re-identifies on every reload from here.
 */
export default function PostHogIdentify() {
  const { data: profile } = useUserProfile()
  /* `useUserProfile` refetches on focus and after credit changes. Re-sending an
     identical payload every time would be pure noise, so only changed values go
     out. */
  const lastSent = useRef<string | null>(null)

  useEffect(() => {
    // 'guest' is the hook's signed-out placeholder, not a real user id.
    if (!profile || !profile.id || profile.id === "guest") return

    const plan = profile.plan || "free"
    const properties: Record<string, unknown> = {
      email: profile.email,
      name: profile.full_name,
      plan,
      credits_left: profile.available_credits,
      is_paying: plan !== "free",
    }
    // Only sent when the backend actually returns it — never fabricated.
    if (profile.created_at) properties.signed_up_at = profile.created_at

    const fingerprint = JSON.stringify([profile.id, properties])
    if (fingerprint === lastSent.current) return
    lastSent.current = fingerprint

    // The immutable internal user id, never the email: an email-keyed history
    // splits in two the moment a customer changes their address.
    identifyUser(profile.id, properties)
  }, [profile])

  return null
}
