'use client'

import { BulkFinderWorkspace } from '@/components/bulk-finder-workspace'

/**
 * Standalone Bulk Find route.
 *
 * The workspace itself lives in a shared component so the identical UI and
 * logic also render as the "Bulk File Upload (CSV)" tab on the Find Email
 * page, without duplicating any behaviour.
 */
export default function BulkFinderPage() {
  return <BulkFinderWorkspace />
}
