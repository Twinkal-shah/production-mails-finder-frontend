'use client'

import { JobHistoryTable } from '@/components/job-history-table'
import { ActiveJobsBanner } from '@/components/active-jobs-banner'

export default function JobHistoryPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Job History</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          View and manage your bulk find and verify jobs.
        </p>
      </div>

      <ActiveJobsBanner />

      <JobHistoryTable />
    </div>
  )
}
