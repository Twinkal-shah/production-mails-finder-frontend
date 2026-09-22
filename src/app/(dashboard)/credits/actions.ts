'use server'

import { apiGet } from '@/lib/api'
import type { LemonSqueezyWebhookEvent } from '@/lib/services/lemonsqueezy'

interface CreditUsage {
  date: string
  totalCreditsUsed: number
}

interface CreditTransaction {
  created_at: string
  amount: number
}

interface Transaction {
  id: string
  user_id: string
  lemonsqueezy_order_id?: string
  lemonsqueezy_subscription_id?: string
  product_name: string
  product_type: string
  amount: number
  credits_find_added: number
  credits_verify_added: number
  status: string
  webhook_event: string
  metadata?: Record<string, unknown>
  created_at: string
}


// Get user profile with credits breakdown
export async function getUserProfileWithCredits() {
  try {
    // For server-side, we'll use the auth-server functions
    const { getCurrentUserFromCookies } = await import('@/lib/auth-server')
    const user = await getCurrentUserFromCookies()
    
    if (!user) {
      console.log('No user found in cookies for getUserProfileWithCredits')
      return {
        id: 'client-user',
        email: '',
        full_name: null,
        plan: 'free',
        credits_find: 0,
        credits_verify: 0,
        total_credits: 0
      }
    }
    
    // Map user data from cookies to profile structure
    return {
      id: user.id || user._id || 'client-user',
      email: user.email || '',
      full_name: user.full_name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email?.split('@')[0] || null,
      plan: user.plan || 'free',
      credits_find: user.credits_find || 0,
      credits_verify: user.credits_verify || 0,
      total_credits: (user.credits_find || 0) + (user.credits_verify || 0)
    }
  } catch (error) {
    console.error('Error fetching user profile:', error)
    // Return minimal profile on error
    return {
      id: 'client-user',
      email: '',
      full_name: null,
      plan: 'free',
      credits_find: 0,
      credits_verify: 0,
      total_credits: 0
    }
  }
}

export async function getCreditUsageHistory(): Promise<CreditUsage[]> {
  try {
    const res = await apiGet<unknown>('/api/credit-usage/daily', { useProxy: true })
    if (!res.ok || !res.data) return []
    const d = res.data as unknown
    if (Array.isArray(d)) return d as CreditUsage[]
    if (typeof d === 'object' && d !== null) {
      const inner = (d as Record<string, unknown>)['data']
      if (Array.isArray(inner)) return inner as CreditUsage[]
    }
    return []
  } catch (error) {
    return []
  }
}

/*
 * The `createLemonSqueezyCheckout` / `createCustomCreditCheckout` server
 * actions were removed here. They had no callers — all checkouts go through
 * `/api/checkout`, which posts the live plan taxonomy to the backend — and
 * because this is a `'use server'` module their exported plan table remained a
 * reachable endpoint for the retired $9.99 / 300,000-credit "Monthly" tier,
 * which is no longer for sale.
 */

export async function createLemonSqueezyPortal(): Promise<{ url?: string; error?: string }> {
  try {
    const { getCurrentUserFromCookies } = await import('@/lib/auth-server')
    const user = await getCurrentUserFromCookies()
    if (!user) {
      return { error: 'Not authenticated. Please log in to manage billing.' }
    }

    // Get user's profile including plan information from backend
    interface ProfileResponse {
      plan?: string
      lemonsqueezy_customer_id?: string
    }
    const profRes = await apiGet<ProfileResponse>('/api/user/profile/getProfile', { useProxy: true })
    const profile = profRes.ok ? profRes.data : null

    if (profile?.plan === 'free') {
      return { error: 'You are currently on the Free Plan. Upgrade to a paid plan to manage billing.' }
    }

    const customerId = profile?.lemonsqueezy_customer_id
    if (!customerId) {
      return { error: 'No billing record found. Complete a purchase or subscription first.' }
    }

    const { createLemonSqueezyPortal: createLSPortal } = await import('@/lib/services/lemonsqueezy')
    const portalResponse = await createLSPortal(customerId)
    return { url: portalResponse.url }
  } catch (error) {
    console.error('LemonSqueezy portal error:', error)
    return { error: 'Failed to open billing portal. Please try again later.' }
  }
}

// Mock transaction history for demo
export async function getTransactionHistory(): Promise<Transaction[]> {
  try {
    const res = await apiGet<Record<string, unknown>>('/api/transaction/getMyTransaction', { useProxy: true })
    if (!res.ok || !res.data) return []
    const root = res.data as Record<string, unknown>
    const arr = Array.isArray(root)
      ? (root as Array<Record<string, unknown>>)
      : Array.isArray((root as Record<string, unknown>)['data'])
        ? ((root as Record<string, unknown>)['data'] as Array<Record<string, unknown>>)
        : Array.isArray((root as Record<string, unknown>)['transactions'])
          ? ((root as Record<string, unknown>)['transactions'] as Array<Record<string, unknown>>)
          : Array.isArray((root as Record<string, unknown>)['result'])
            ? ((root as Record<string, unknown>)['result'] as Array<Record<string, unknown>>)
            : []
    return arr.map((t) => {
      const dataObj = (t['data'] && typeof t['data'] === 'object') ? (t['data'] as Record<string, unknown>) : {}
      const attributes = (dataObj['attributes'] && typeof dataObj['attributes'] === 'object') ? (dataObj['attributes'] as Record<string, unknown>) : {}
      const meta = (t['meta'] && typeof t['meta'] === 'object') ? (t['meta'] as Record<string, unknown>) : {}
      const customData = (attributes['custom_data'] && typeof attributes['custom_data'] === 'object')
        ? (attributes['custom_data'] as Record<string, unknown>)
        : (meta['custom_data'] && typeof meta['custom_data'] === 'object')
          ? (meta['custom_data'] as Record<string, unknown>)
          : {}

      const idRaw = t['id'] ?? t['transaction_id'] ?? t['order_id'] ?? t['subscription_id'] ?? dataObj['id']
      const id = idRaw ? String(idRaw) : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const user_id = String(t['user_id'] ?? '')

      const lemonsqueezy_order_id = typeof (t['lemonsqueezy_order_id'] ?? dataObj['id']) === 'string' 
        ? String(t['lemonsqueezy_order_id'] ?? dataObj['id']) 
        : (typeof t['order_id'] === 'string' ? String(t['order_id']) : undefined)
      const lemonsqueezy_subscription_id = typeof (t['lemonsqueezy_subscription_id'] ?? attributes['subscription_id']) === 'string' 
        ? String(t['lemonsqueezy_subscription_id'] ?? attributes['subscription_id']) 
        : (typeof t['subscription_id'] === 'string' ? String(t['subscription_id']) : undefined)

      const product_name = String(attributes['product_name'] ?? t['product_name'] ?? t['product'] ?? t['plan_name'] ?? 'Transaction')
      let product_type = String(t['product_type'] ?? t['type'] ?? '')

      const amountCandidates = [
        t['amount'],
        t['total'],
        t['amount_paid'],
        t['price'],
        t['subtotal'],
        t['sub_total'],
        attributes['total'],
        attributes['amount_paid'],
      ]
      let amount = 0
      for (const c of amountCandidates) {
        const n = Number(c)
        if (!Number.isNaN(n) && n !== 0) { amount = n; break }
      }
      const isLemon = !!lemonsqueezy_order_id || !!lemonsqueezy_subscription_id || typeof meta['event_name'] === 'string'
      if (isLemon && amount >= 100) amount = Math.round(amount) / 100

      const credits_find_added = Number(t['credits_find_added'] ?? t['find_credits'] ?? customData['find_credits'] ?? 0)
      const credits_verify_added = Number(t['credits_verify_added'] ?? t['verify_credits'] ?? customData['verify_credits'] ?? 0)
      const status = String(t['status'] ?? attributes['status'] ?? 'completed')
      let webhook_event = String(t['webhook_event'] ?? t['event'] ?? meta['event_name'] ?? '')

      if (!webhook_event && isLemon) webhook_event = 'order_created'
      if (!product_type && isLemon) product_type = 'purchase'

      const metadata = typeof t['metadata'] === 'object' && t['metadata'] !== null 
        ? (t['metadata'] as Record<string, unknown>) 
        : (typeof attributes['custom_data'] === 'object' ? (attributes['custom_data'] as Record<string, unknown>) : undefined)
      const created_at = typeof t['created_at'] === 'string' 
        ? String(t['created_at']) 
        : (typeof t['createdAt'] === 'string' 
          ? String(t['createdAt']) 
          : (typeof attributes['ends_at'] === 'string' ? String(attributes['ends_at']) : new Date().toISOString()))

      return {
        id,
        user_id,
        lemonsqueezy_order_id,
        lemonsqueezy_subscription_id,
        product_name,
        product_type,
        amount,
        credits_find_added,
        credits_verify_added,
        status,
        webhook_event,
        metadata,
        created_at,
      }
    })
  } catch (error) {
    console.error('Get transactions error:', error)
    return []
  }
}

// LemonSqueezy webhook handler
export async function handleLemonSqueezyWebhook(event: LemonSqueezyWebhookEvent) {
  try {
    const { handleLemonSqueezyWebhook: handleWebhook } = await import('@/lib/services/lemonsqueezy')
    await handleWebhook(event)
  } catch (error) {
    console.error('LemonSqueezy webhook error:', error)
    throw error
  }
}
