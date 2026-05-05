/**
 * Convert raw backend / fetch error strings into short, user-friendly messages.
 * Handles common patterns like:
 *   "API request failed: 400 - {\"status\":400,\"success\":false,\"message\":\"Daily email limit reached...\"}"
 * and known business errors (daily limit, insufficient credits, plan expired).
 */
export function humanizeApiError(raw: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (raw == null) return fallback
  let text = typeof raw === 'string' ? raw : raw instanceof Error ? raw.message : ''
  if (!text) return fallback

  // Strip common prefixes and try to pull out an embedded JSON error body
  const jsonStart = text.indexOf('{')
  if (jsonStart >= 0) {
    const candidate = text.slice(jsonStart)
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>
      const inner = (typeof parsed.message === 'string' && parsed.message)
        || (typeof parsed.error === 'string' && parsed.error)
      if (inner) text = inner
    } catch {
      // not valid JSON — keep the original text
    }
  }

  const lower = text.toLowerCase()

  if (lower.includes('daily') && lower.includes('limit')) {
    return "You've hit today's email limit. Please try again tomorrow."
  }
  if (lower.includes('insufficient') && lower.includes('credit')) {
    return "You don't have enough credits to perform this action."
  }
  if (lower.includes('plan') && lower.includes('expired')) {
    return 'Your plan has expired. Please upgrade to continue.'
  }
  if (lower.includes('rate limit')) {
    return 'Too many requests. Please slow down and try again in a moment.'
  }
  if (lower.includes('unauthorized') || lower.includes('authentication required')) {
    return 'Please sign in again to continue.'
  }

  // Strip noisy prefixes like "API request failed: 400 - "
  const cleaned = text
    .replace(/^api request failed:\s*\d+\s*-?\s*/i, '')
    .replace(/^job poll failed\s*\(\d+\):\s*/i, '')
    .trim()

  return cleaned || fallback
}

/**
 * Convert a raw SMTP / verification "reason" string into a short, user-friendly
 * line. Used when displaying verification results where the backend returned a
 * technical SMTP response (e.g. "450 4.2.1 ... receiving mail at a rate that...").
 */
export function humanizeVerificationReason(reason: unknown, fallback = 'Verification completed. Status is unknown.'): string {
  if (reason == null) return fallback
  const text = typeof reason === 'string' ? reason.trim() : reason instanceof Error ? reason.message.trim() : ''
  if (!text) return fallback

  const lower = text.toLowerCase()

  // SMTP enhanced status codes
  if (/\b4\.2\.1\b/.test(text) || (lower.includes('receiving mail at a rate') || lower.includes('rate that'))) {
    return "The recipient's mailbox is temporarily busy. Please try again later."
  }
  if (/\b5\.1\.1\b/.test(text) || lower.includes('user unknown') || lower.includes('no such user') || lower.includes('does not exist')) {
    return "This email address doesn't exist."
  }
  if (/\b5\.2\.2\b/.test(text) || lower.includes('mailbox full') || lower.includes('over quota')) {
    return "The recipient's mailbox is full."
  }
  if (/\b5\.7\.1\b/.test(text) || lower.includes('blocked') || lower.includes('rejected')) {
    return "The recipient's server rejected the verification."
  }
  if (/\b4\.7\.\d+\b/.test(text) || lower.includes('temporarily') || lower.includes('try again')) {
    return 'The recipient server is temporarily unavailable. Please try again later.'
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Verification timed out. Please try again.'
  }
  if (lower.includes('greylist')) {
    return 'The recipient server is greylisting requests. Please try again in a few minutes.'
  }
  if (lower.startsWith('421') || /\b4\d{2}\b/.test(text.slice(0, 4))) {
    return 'The recipient server is temporarily unavailable. Please try again later.'
  }
  if (lower.startsWith('550') || lower.startsWith('5')) {
    return "The recipient's server refused the verification."
  }

  // Fall back to the same generic API-error humanizer (handles daily-limit, etc.)
  return humanizeApiError(text, fallback)
}
