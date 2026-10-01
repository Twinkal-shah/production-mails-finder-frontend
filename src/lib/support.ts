/**
 * Support routing for AppSumo buyers.
 *
 * AppSumo licenses get a dedicated support channel that depends on the tier they
 * bought: Tier 1 and Tier 2 go to email, Tier 3 and Tier 4 get direct WhatsApp.
 * Regular Mailsfinder plans (free / starter / growth / agency / monthly /
 * lifetime / payg) are deliberately NOT covered here — `appsumoTier` returns
 * null for them and the Support page stays hidden.
 *
 * The tier comes from the plan string the profile already carries, the same
 * field the sidebar reads for the Outbound Skills gate (`appsumo_t3`,
 * `appsumo_t4`), so this costs no extra request.
 */

/** Support inbox for Tier 1 and Tier 2. */
export const SUPPORT_EMAIL = 'harsh@klientsgrowth.com'

/**
 * Direct WhatsApp line for Tier 3 and Tier 4, in the digits-only international
 * form wa.me requires (country code, no "+", no spaces).
 * 91 = India, for the number 8511212442.
 */
export const SUPPORT_WHATSAPP = '918511212442'

/** Human-readable version of the same number, for display only. */
export const SUPPORT_WHATSAPP_DISPLAY = '+91 85112 12442'

/**
 * Matches the AppSumo plan ids the backend reports. Written tolerantly
 * (`appsumo_t3`, `appsumo-t3`, `appsumo_tier3`) because only the Tier 3 and
 * Tier 4 spellings are pinned down in the frontend today; anything that is not
 * an AppSumo plan falls through to null.
 */
const APPSUMO_PLAN = /^appsumo[_-]?t(?:ier)?[_-]?([1-9]\d*)$/

/** Highest license tier AppSumo sells for Mailsfinder. */
const MAX_TIER = 4

/**
 * License tier for an AppSumo account, or null for every other kind of user.
 *
 * Null covers both "not an AppSumo buyer" and "an AppSumo tier we do not have a
 * support channel for", so callers can treat null as "no AppSumo support".
 */
export function appsumoTier(plan: unknown): number | null {
  const match = String(plan ?? '').trim().toLowerCase().match(APPSUMO_PLAN)
  if (!match) return null
  const tier = Number(match[1])
  return tier >= 1 && tier <= MAX_TIER ? tier : null
}

export type SupportChannel = 'email' | 'whatsapp'

/**
 * Which channel a tier is entitled to, or null when the user gets neither.
 * Tiers 1-2 -> email, tiers 3-4 -> WhatsApp.
 */
export function supportChannelFor(plan: unknown): SupportChannel | null {
  const tier = appsumoTier(plan)
  if (tier === null) return null
  return tier <= 2 ? 'email' : 'whatsapp'
}

/**
 * `mailto:` URL with the account email in the body, so a buyer writing in is
 * identifiable without being asked which account they are on.
 */
export function supportMailtoHref(accountEmail?: string | null, tier?: number | null): string {
  const subject = `Mailsfinder support${tier ? ` — AppSumo Tier ${tier}` : ''}`
  const body = accountEmail ? `\n\n---\nAccount: ${accountEmail}` : ''
  const query = `subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`
  return `mailto:${SUPPORT_EMAIL}?${query}`
}

/** wa.me deep link that opens a direct chat, with the opening line prefilled. */
export function supportWhatsappHref(accountEmail?: string | null, tier?: number | null): string {
  const text =
    `Hi, I need help with Mailsfinder.` +
    (tier ? ` (AppSumo Tier ${tier})` : '') +
    (accountEmail ? ` My account is ${accountEmail}.` : '')
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`
}
