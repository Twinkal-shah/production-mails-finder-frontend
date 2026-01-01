'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConnectorProvider } from '@/components/providers/connector-provider'

export const dynamic = 'force-dynamic'

export default function ConnectorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    const flag = typeof window !== 'undefined' && localStorage.getItem('connector_os_enabled') === 'true'
    setEnabled(flag)
    if (!flag) {
      router.replace('/find')
    }
  }, [router])

  if (!enabled) {
    return null
  }

  return <ConnectorProvider>{children}</ConnectorProvider>
}
