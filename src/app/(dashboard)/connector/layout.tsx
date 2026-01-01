'use client'

import { ConnectorProvider } from '@/components/providers/connector-provider'

export const dynamic = 'force-dynamic'

export default function ConnectorLayout({ children }: { children: React.ReactNode }) {
  return <ConnectorProvider>{children}</ConnectorProvider>
}

