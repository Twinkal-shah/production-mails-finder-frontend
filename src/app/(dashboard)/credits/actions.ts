'use server'

import { apiGet } from '@/lib/api'
import type { LemonSqueezyWebhookEvent } from '@/lib/services/lemonsqueezy'

interface CreditUsage {
  date: string
  credits_used: number
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
    const { getCurrentUserFromCookies } = await import('@/lib/auth-server')
    const user = await getCurrentUserFromCookies()
    if (!user) {
      return []
    }
    const transactions = await getTransactionHistory()
    const todayStr = new Date().toISOString().split('T')[0]
    const usageToday = transactions.filter((t) => {
      const dateStr = new Date(t.created_at).toISOString().split('T')[0]
      const isToday = dateStr === todayStr
      const isPurchase = (t.product_type || '').toLowerCase() === 'purchase' || (t.webhook_event || '').toLowerCase().includes('order')
      const addedCredits = (t.credits_find_added || 0) > 0 || (t.credits_verify_added || 0) > 0
      const meta = (t.metadata ?? {}) as Record<string, unknown>
      const op = String(meta['operation'] ?? '').toLowerCase()
      const pt = (t.product_type || '').toLowerCase()
      const isUsageType = pt.includes('usage') || pt.includes('deduct') || pt.includes('consum')
      const isUsageOp = op.includes('email') || op.includes('verify') || op.includes('find')
      const isUsageCandidate = !isPurchase && !addedCredits && (isUsageOp || isUsageType || typeof t.amount === 'number')
      return isToday && isUsageCandidate
    })
    if (usageToday.length === 0) return []
    const totalUsed = usageToday.reduce((sum, t) => {
      const meta = (t.metadata ?? {}) as Record<string, unknown>
      const summary = (meta['summary'] && typeof meta['summary'] === 'object') ? (meta['summary'] as Record<string, unknown>) : undefined
      const dataObj = (meta['data'] && typeof meta['data'] === 'object') ? (meta['data'] as Record<string, unknown>) : undefined
      const dataSummary = (dataObj && typeof dataObj['summary'] === 'object') ? (dataObj['summary'] as Record<string, unknown>) : undefined
      const metaUsed =
        Number(meta['credits_used'] ?? 0) ||
        Number(meta['used'] ?? 0) ||
        Number(meta['totalCredits'] ?? 0) ||
        Number(meta['total_credits'] ?? 0) ||
        Number(meta['credits'] ?? 0) ||
        Number(meta['processed_emails'] ?? 0) ||
        Number(meta['total_emails'] ?? 0) ||
        Number(meta['count'] ?? 0) ||
        Number(summary?.['valid_emails'] ?? 0) ||
        Number(dataSummary?.['valid_emails'] ?? 0)
      const byMeta = Number.isFinite(metaUsed) && metaUsed > 0 ? metaUsed : 0
      const byAmount = typeof t.amount === 'number' && Number.isFinite(t.amount) ? Math.abs(Number(t.amount)) : 0
      const used = byMeta || byAmount || 1
      return sum + used
    }, 0)
    let todayUsed = totalUsed
    try {
      const res = await apiGet<CreditTransaction[]>('/api/user/credits/transactions', { useProxy: true })
      if (res.ok && Array.isArray(res.data)) {
        const backendToday = (res.data as CreditTransaction[]).filter((tx) => {
          const ds = new Date(tx.created_at).toISOString().split('T')[0]
          return ds === todayStr && Number(tx.amount) <= 0
        })
        const backendTotal = backendToday.reduce((sum, tx) => {
          const n = Math.abs(Number(tx.amount))
          return sum + (Number.isFinite(n) ? n : 0)
        }, 0)
        if (backendTotal > todayUsed) todayUsed = backendTotal
      }
    } catch {}
    if (todayUsed <= 0) return []
    return [{ date: todayStr, credits_used: todayUsed }]
  } catch (error) {
    console.error('Error in getCreditUsageHistory:', error)
    return []
  }
}

export async function createLemonSqueezyCheckout(planData: {
  name: string
  price: number
  period: string
  findCredits: number
  verifyCredits: number
}) {
  const { getCurrentUserFromCookies } = await import('@/lib/auth-server')
  const user = await getCurrentUserFromCookies()
  if (!user) {
    throw new Error('User not authenticated')
  }
  
  // Validate plan data
  const validPlans = {
    'Pro': { price: 49, period: 'month', findCredits: 5000, verifyCredits: 5000 },
    'Agency': { price: 99, period: 'month', findCredits: 50000, verifyCredits: 50000 },
    'Lifetime': { price: 249, period: 'lifetime', findCredits: 150000, verifyCredits: 150000 }
  }
  
  const validPlan = validPlans[planData.name as keyof typeof validPlans]
  if (!validPlan || validPlan.price !== planData.price) {
    throw new Error('Invalid subscription plan')
  }
  
  try {
    const { createLemonSqueezyCheckout: createCheckout } = await import('@/lib/services/lemonsqueezy')
    
    // Map plan names to LemonSqueezy variant IDs (these would be configured in your LemonSqueezy dashboard)
    const variantIds = {
      'Pro': process.env.LEMONSQUEEZY_PRO_VARIANT_ID || 'pro-variant-id',
      'Agency': process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID || 'agency-variant-id',
      'Lifetime': process.env.LEMONSQUEEZY_LIFETIME_VARIANT_ID || 'lifetime-variant-id'
    }
    
    const variantId = variantIds[planData.name as keyof typeof variantIds]
    if (!variantId) {
      throw new Error('Invalid plan selected')
    }
    
    const checkoutData = {
      productId: process.env.LEMONSQUEEZY_PRODUCT_ID || 'product-id',
      variantId,
      customData: {
        plan_name: planData.name,
        find_credits: planData.findCredits,
        verify_credits: planData.verifyCredits,
      },
    }
    
    const userId = (user as Record<string, unknown>).id as string | undefined || (user as Record<string, unknown>)._id as string | undefined || ''
    const result = await createCheckout(checkoutData, userId)
    
    return { url: result.url }
  } catch (error) {
    console.error('LemonSqueezy checkout error:', error)
    throw new Error('Failed to create checkout session')
  }
}

export async function createCustomCreditCheckout(creditData: {
  credits: number
  price: number
}) {
  const { getCurrentUserFromCookies } = await import('@/lib/auth-server')
  const user = await getCurrentUserFromCookies()
  if (!user) {
    throw new Error('User not authenticated')
  }
  
  // Validate credit package data
  const validPackages = {
    7200: 35,
    4100: 20,
    2500: 12,
    2000: 9
  }
  
  const validPrice = validPackages[creditData.credits as keyof typeof validPackages]
  if (!validPrice || validPrice !== creditData.price) {
    throw new Error('Invalid credit package')
  }
  
  try {
    const { createLemonSqueezyCheckout: createCheckout } = await import('@/lib/services/lemonsqueezy')
    
    // Map credit amounts to LemonSqueezy variant IDs
    const creditVariantIds = {
      7200: process.env.LEMONSQUEEZY_CREDITS_7200_VARIANT_ID || 'credits-7200-variant-id',
      4100: process.env.LEMONSQUEEZY_CREDITS_4100_VARIANT_ID || 'credits-4100-variant-id',
      2500: process.env.LEMONSQUEEZY_CREDITS_2500_VARIANT_ID || 'credits-2500-variant-id',
      2000: process.env.LEMONSQUEEZY_CREDITS_2000_VARIANT_ID || 'credits-2000-variant-id'
    }
    
    const variantId = creditVariantIds[creditData.credits as keyof typeof creditVariantIds]
    if (!variantId) {
      throw new Error('Invalid credit package selected')
    }
    
    const userId = (user as Record<string, unknown>).id as string | undefined || (user as Record<string, unknown>)._id as string | undefined || ''
    const result = await createCheckout(
      {
        productId: process.env.LEMONSQUEEZY_CREDITS_PRODUCT_ID || process.env.LEMONSQUEEZY_PRODUCT_ID || 'credits-product-id',
        variantId,
        customData: {
          credits: creditData.credits,
          package_type: 'credits',
          find_credits: creditData.credits,
          verify_credits: 0,
        },
      },
      userId
    )
    
    return { url: result.url }
  } catch (error) {
    console.error('Mock checkout error:', error)
    throw new Error('Failed to create checkout session')
  }
}

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
