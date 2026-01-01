'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type OutreachPlatform = 'Smartlead' | 'Instantly' | 'Plusvibe'

interface ApiKeys {
  apollo?: string
  mailsfinder?: string
  apify?: string
  smartlead?: string
}

interface DatasetIds {
  demand?: string
  supply?: string
}

interface ConnectorState {
  apiKeys: ApiKeys
  datasetIds: DatasetIds
  outreachPlatform?: OutreachPlatform
}

interface ConnectorContextValue extends ConnectorState {
  setApiKeys: (next: ApiKeys) => void
  setDatasetIds: (next: DatasetIds) => void
  setOutreachPlatform: (next: OutreachPlatform) => void
  reset: () => void
}

const STORAGE_KEY = 'connector_os_state'

const ConnectorContext = createContext<ConnectorContextValue | null>(null)

export function ConnectorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConnectorState>({
    apiKeys: {},
    datasetIds: {},
    outreachPlatform: undefined,
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ConnectorState
        setState({
          apiKeys: parsed.apiKeys || {},
          datasetIds: parsed.datasetIds || {},
          outreachPlatform: parsed.outreachPlatform,
        })
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }, [state])

  const value = useMemo<ConnectorContextValue>(() => ({
    ...state,
    setApiKeys: (next) => setState((prev) => ({ ...prev, apiKeys: { ...prev.apiKeys, ...next } })),
    setDatasetIds: (next) => setState((prev) => ({ ...prev, datasetIds: { ...prev.datasetIds, ...next } })),
    setOutreachPlatform: (next) => setState((prev) => ({ ...prev, outreachPlatform: next })),
    reset: () => setState({ apiKeys: {}, datasetIds: {}, outreachPlatform: undefined }),
  }), [state])

  return <ConnectorContext.Provider value={value}>{children}</ConnectorContext.Provider>
}

export function useConnector() {
  const ctx = useContext(ConnectorContext)
  if (!ctx) {
    throw new Error('useConnector must be used within ConnectorProvider')
  }
  return ctx
}

