import { getJobQueue } from './job-queue'

/**
 * Initialize application startup tasks
 * This should be called when the application starts
 */
export async function initializeApplication() {
  console.log('Initializing application...')
  
  try {
    // Initialize job queue
    const jobQueue = getJobQueue()
    console.log('Job queue initialized')
    
    // Recover any stuck jobs (only if Supabase is configured)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await jobQueue.recoverStuckJobs()
      console.log('Stuck job recovery completed')
    } else {
      console.log('Skipping stuck job recovery: Supabase not configured')
    }
    
    // Get initial queue status
    const status = await jobQueue.getQueueStatus()
    console.log('Job queue status:', status)
    
    return true
  } catch (error) {
    console.error('Error initializing application:', error)
    return false
  }
}

// Auto-initialize if running in Node.js environment
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'test') {
  // Delay initialization to allow environment to be ready
  setTimeout(() => {
    initializeApplication().catch(error => {
      console.error('Failed to initialize application:', error)
    })
  }, 2000)
}
