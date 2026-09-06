'use client'

import { JobHistoryTable } from '@/components/job-history-table'
import { ActiveJobsBanner } from '@/components/active-jobs-banner'

export default function JobHistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
          Processing Queue
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-white">Job History</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View and manage your bulk find and verify jobs.
        </p>
      </div>

      <ActiveJobsBanner />

      <JobHistoryTable />
    </div>
  )
}
