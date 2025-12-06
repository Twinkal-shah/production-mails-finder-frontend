'use server'

// Supabase-based server actions disabled

// Server action to initialize user credits
export async function initializeUserCreditsAction(userId: string): Promise<boolean> {
  try {
    return false
  } catch (error) {
    console.error('Error in initializeUserCredits:', error)
    return false
  }
}
