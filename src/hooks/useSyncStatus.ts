import { useEffect, useState } from 'react'
import type { SyncStatus } from '../../electron/shared/types'

export function useSyncStatus(): SyncStatus & { refresh: () => Promise<void> } {
  const [status, setStatus] = useState<SyncStatus>({
    is_syncing: false,
    is_classifying: false,
    last_sync_at: null,
    unclassified_count: 0,
    total_messages: 0,
    error: null,
    backoff_until: null
  })

  const refresh = async () => {
    if (!window.api) return
    const s = await window.api.sync.status()
    setStatus(s)
  }

  useEffect(() => {
    if (!window.api) return
    refresh()
    const unsub = window.api.onSyncStatusChanged(setStatus)
    const interval = setInterval(refresh, 5000)
    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [])

  return { ...status, refresh }
}
