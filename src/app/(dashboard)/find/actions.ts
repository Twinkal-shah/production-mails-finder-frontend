'use server'


import { getUserCredits } from '@/lib/profile-server'
import { revalidatePath } from 'next/cache'
import { findEmail as findEmailService, type EmailFinderRequest } from '@/lib/services/email-finder'

interface FindEmailRequest {
  domain: string
  first_name: string
  last_name: string
}

interface EmailResult {
  email: string | null
  confidence: number
  status: 'found' | 'not_found' | 'error'
  verificationStatus?: 'valid' | 'invalid' | 'risky' | 'unknown' | 'error'
  verificationReason?: string
}

interface FindEmailResponse {
  success: boolean
  result?: EmailResult
  error?: string
  invalidateQueries?: boolean
}



export async function findEmail(request: FindEmailRequest): Promise<FindEmailResponse> {
  try {
    // Use server-side function instead of client-side getCurrentUser
    const { getCurrentUserFromCookies } = await import('@/lib/auth-server')
    const user = await getCurrentUserFromCookies()
    
    if (!user) {
      return {
        success: false,
        error: 'You must be logged in to perform this action.'
      }
    }

    // Check if user has Find Credits via backend
    let credits = await getUserCredits()
    if (!credits) {
      const findFallback = Number((user as Record<string, unknown>).credits_find ?? 0)
      const verifyFallback = Number((user as Record<string, unknown>).credits_verify ?? 0)
      credits = { total: findFallback + verifyFallback, find: findFallback, verify: verifyFallback }
    }
    if ((credits.find || 0) === 0) {
      return {
        success: false,
        error: "You don't have enough Find Credits to perform this action. Please purchase more credits."
      }
    }

    const fullNameForService = [request.first_name, request.last_name].filter(Boolean).join(' ')
    const emailRequest: EmailFinderRequest = {
      full_name: fullNameForService,
      domain: request.domain
    }
    const serviceResult = await findEmailService(emailRequest)
    
    // Map service result to expected format
    const result: EmailResult = {
      email: serviceResult.email || null,
      confidence: serviceResult.confidence || 0,
      status: serviceResult.email ? 'found' : (serviceResult.status === 'error' ? 'error' : 'not_found')
    }

    if (!result.email) {
      try {
        const { cookies } = await import('next/headers')
        const { getAccessTokenFromCookies } = await import('@/lib/auth-server')
        const token = await getAccessTokenFromCookies()
        const payload = {
          domain: request.domain,
          first_name: request.first_name,
          last_name: request.last_name
        }
        const { apiPost } = await import('@/lib/api')
        const apiRes = await apiPost<Record<string, unknown>>('/api/email/findEmail', payload, { useProxy: true, includeAuth: true, token })
        const data: Record<string, unknown> = apiRes.ok && apiRes.data ? (apiRes.data as Record<string, unknown>) : {}
        const root = data
        const p = (typeof root?.data === 'object' && root.data !== null)
          ? (root.data as Record<string, unknown>)
          : (typeof root?.result === 'object' && root.result !== null)
            ? (root.result as Record<string, unknown>)
            : root
        const email = typeof p?.email === 'string' ? (p.email as string) : null
        const confidence = typeof p?.confidence === 'number' ? (p.confidence as number) : (email ? 95 : 0)
        if (email) {
          result.email = email
          result.confidence = confidence
          result.status = 'found'
        }
      } catch {}
    }
    if (result.email) {
      try {
        const { verifyEmail } = await import('@/lib/services/email-verifier')
        const verification = await verifyEmail({ email: result.email })
        result.verificationStatus = verification.status
        const r = typeof verification.reason === 'string' ? verification.reason : undefined
        result.verificationReason = r
      } catch {}
    }
    
    // Deduct credits for all search attempts (found, not_found, but not error)
 // Deduct credit if the finder actually returned an email (means it was a real attempt)
if (result.status === 'found') {
  try {
    const { cookies } = await import('next/headers')
    const { getAccessTokenFromCookies } = await import('@/lib/auth-server')

    const cookieHeader = cookies().toString()
    const token = await getAccessTokenFromCookies()

    const { apiPut } = await import('@/lib/api')
    await apiPut('/api/user/profile/updateProfile', {
      credits_find: credits.find - 1,
      metadata: {
        email: result.email,
        confidence: result.confidence,
        status: result.status,
        operation: 'email_find'
      }
    }, { useProxy: true, includeAuth: true, token })

    // No need to handle response; proxy route updates profile
  } catch (error) {
    console.error('Error deducting credits:', error)
  }
}





    // Mock: Skip database save for demo
    // In a real app, this would save to the searches table

    // Revalidate the layout to update credits display
    revalidatePath('/(dashboard)', 'layout')
    
    return {
      success: true,
      result,
      invalidateQueries: true // Signal to invalidate React Query cache
    }
  } catch (error) {
    console.error('Find email error:', error)
    return {
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    }
  }
}
