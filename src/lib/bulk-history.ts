'use client'

import { useSyncExternalStore } from 'react'

/**
 * Client-side history of completed bulk (CSV) find / verify runs.
 *
 * The bulk flows call the synchronous Ninja endpoints and never create a
 * server-side job record, so the only place the finished result set exists is
 * the browser. We keep the ready-to-download CSV for the most recent runs in
 * localStorage so the dashboard can list them and offer the file again.
 */

export type BulkHistoryType = 'bulk_find' | 'bulk_verify'

export interface BulkHistoryEntry {
  id: string
  type: BulkHistoryType
  /** Original upload name (without extension) when known. */
  filename: string | null
  /** File name used for the download. */
  downloadName: string
  created_at: string
  total: number
  /** Emails found (bulk_find) or deliverable (bulk_verify). */
  success: number
  /** Catch-all / risky rows. */
  risky: number
  csv: string
}

const LS_KEY = 'mailsfinder_bulk_history'
const EVENT = 'mailsfinder:bulk-history'
const MAX_ENTRIES = 10
/** Skip persisting a single CSV bigger than this; localStorage is ~5MB total. */
const MAX_CSV_BYTES = 1_500_000
const EMPTY: BulkHistoryEntry[] = []

let cache: BulkHistoryEntry[] | null = null

function read(): BulkHistoryEntry[] {
  if (cache) return cache
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null
    const parsed = raw ? JSON.parse(raw) : []
    cache = Array.isArray(parsed) ? (parsed as BulkHistoryEntry[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(entries: BulkHistoryEntry[]) {
  cache = entries
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries))
  } catch {
    // Quota exceeded — drop the oldest entries until it fits (or give up).
    try {
      const trimmed = entries.slice(0, Math.max(1, Math.floor(entries.length / 2)))
      localStorage.setItem(LS_KEY, JSON.stringify(trimmed))
      cache = trimmed
    } catch {}
  }
  try {
    window.dispatchEvent(new Event(EVENT))
  } catch {}
}

export function saveBulkHistoryEntry(entry: Omit<BulkHistoryEntry, 'id' | 'created_at'>) {
  if (typeof window === 'undefined') return
  if (entry.csv.length > MAX_CSV_BYTES) return
  const full: BulkHistoryEntry = {
    ...entry,
    id: `${entry.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
  }
  write([full, ...read()].slice(0, MAX_ENTRIES))
}

export function downloadBulkHistoryEntry(entry: BulkHistoryEntry) {
  const blob = new Blob([entry.csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = entry.downloadName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === LS_KEY) {
      cache = null
      cb()
    }
  }
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}

export function useBulkHistory(): BulkHistoryEntry[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}
