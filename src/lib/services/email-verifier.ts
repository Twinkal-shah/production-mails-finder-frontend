interface EmailVerifierResult {
  email: string
  status: 'valid' | 'invalid' | 'risky' | 'unknown' | 'error'
  confidence: number
  reason?: string
  deliverable?: boolean
  disposable?: boolean
  role_account?: boolean
  catch_all?: boolean
  domain?: string
  mx?: string
  user_name?: string
  email_provider?: string
  confidence_score?: number
  safe_to_send?: boolean | 'risky'
  is_catch_all_domain?: boolean
  notice?: string
}

interface EmailVerifierRequest {
  email: string
}

export async function verifyEmailReal(
  request: EmailVerifierRequest
): Promise<EmailVerifierResult> {
  try {
    // Get JWT token from cookies
    const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
    const accessToken = await getAccessTokenFromCookies()
    const { getBackendBaseUrl } = await import('@/lib/api')

    const backend = getBackendBaseUrl()

    // Call the Mailtester Ninja verify endpoint directly (JSON body)
    const res = await fetch(`${backend}/api/email/verifyEmailNinja`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      body: JSON.stringify({ email: request.email })
    })

    if (!res.ok) {
      const errorText = await res.text()
      const { humanizeApiError } = await import('@/lib/api-error')
      throw new Error(humanizeApiError(errorText, 'Failed to verify email'))
    }

    const json = await res.json()

    // Extract data fields
    const details = json?.data?.details || {}
    const data = json?.data || {}

    // -------------------------------
    // 1️⃣ Extract raw status
    // -------------------------------
    let rawStatus =
      details?.status ||
      data?.status ||
      json?.status ||
      json?.email_status ||
      null

    rawStatus =
      typeof rawStatus === 'string'
        ? rawStatus.toLowerCase()
        : 'unknown'

    // -------------------------------
    // 2️⃣ Normalize into final status
    // -------------------------------
    let normalizedStatus: 'valid' | 'invalid' | 'risky' | 'unknown'

    switch (rawStatus) {
      case 'valid':
      case 'deliverable':
      case 'ok':
        normalizedStatus = 'valid'
        break

      case 'invalid':
      case 'undeliverable':
        normalizedStatus = 'invalid'
        break

      case 'risky':
      case 'catch_all':
      case 'catchall':
        normalizedStatus = 'risky'
        break

      default:
        normalizedStatus = 'unknown'
        break
    }

    // -------------------------------
    // 3️⃣ Extract reason/message
    // -------------------------------
    const reason =
      details?.reason ||
      data?.reason ||
      json?.reason ||
      undefined

    const rawDeliverable = details?.deliverable ?? data?.deliverable ?? json?.deliverable
    const deliverable = typeof rawDeliverable === 'boolean'
      ? rawDeliverable
      : normalizedStatus === 'valid'

    // -------------------------------
    // 4️⃣ Confidence (SMTP connections when reported, else Ninja's score)
    // -------------------------------
    const ninjaScore = (json?.confidence_score ?? data?.confidence_score ?? details?.confidence_score)
    const confidence =
      typeof details?.connections === 'number'
        ? Math.min(100, details.connections * 20)
        : typeof ninjaScore === 'number'
          ? ninjaScore
          : 0

    const rawProvider = (json?.email_provider ?? data?.email_provider ?? details?.email_provider)
    const email_provider = typeof rawProvider === 'string' ? rawProvider : undefined
    const rawConfidenceScore = (json?.confidence_score ?? data?.confidence_score ?? details?.confidence_score)
    const confidence_score = typeof rawConfidenceScore === 'number' ? rawConfidenceScore : undefined
    const rawSafeToSend = (json?.safe_to_send ?? data?.safe_to_send ?? details?.safe_to_send)
    // Ninja returns safe_to_send as a string ("deliverable" / "risky" /
    // "undeliverable"); legacy returned a boolean. Normalise to boolean | 'risky'.
    const safeStr = typeof rawSafeToSend === 'string' ? rawSafeToSend.toLowerCase() : ''
    const safe_to_send: boolean | 'risky' | undefined =
      typeof rawSafeToSend === 'boolean' ? rawSafeToSend :
      safeStr === 'risky' ? 'risky' :
      safeStr === 'deliverable' || safeStr === 'safe' || safeStr === 'true' || safeStr === 'yes' ? true :
      safeStr === 'undeliverable' || safeStr === 'unsafe' || safeStr === 'false' || safeStr === 'no' ? false :
      undefined

    const rawIsCatchAllDomain = (json?.is_catch_all_domain ?? data?.is_catch_all_domain ?? details?.is_catch_all_domain)
    const is_catch_all_domain = rawIsCatchAllDomain === true
    const rawNotice = (json?.notice ?? data?.notice ?? details?.notice)
    const notice = typeof rawNotice === 'string' ? rawNotice : undefined

    // -------------------------------
    // 5️⃣ Final return object
    // -------------------------------
    return {
      email: request.email,
      status: normalizedStatus,
      confidence,
      deliverable,
      reason,
      catch_all: details?.catch_all ?? data?.catch_all ?? json?.catch_all,
      domain: details?.domain ?? data?.domain ?? json?.domain ?? (request.email.split('@')[1] || undefined),
      mx: details?.mx ?? data?.mx ?? json?.mx,
      user_name: details?.user_name ?? data?.user_name ?? json?.user_name ?? (request.email.split('@')[0] || undefined),
      email_provider,
      confidence_score,
      safe_to_send,
      is_catch_all_domain,
      notice
    }
  } catch (error) {
    const { humanizeApiError } = await import('@/lib/api-error')
    return {
      email: request.email,
      status: 'error',
      confidence: 0,
      deliverable: false,
      reason: humanizeApiError(error, 'Failed to verify email')
    }
  }
}

export async function verifyEmail(
  request: EmailVerifierRequest
): Promise<EmailVerifierResult> {
  return verifyEmailReal(request)
}

export type { EmailVerifierResult, EmailVerifierRequest }
