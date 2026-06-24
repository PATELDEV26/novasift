import type { SyncStatus } from '../../electron/shared/types'

interface StatusBarProps {
  status: SyncStatus
  connected: boolean
  onSyncNow: () => void
  isOffline?: boolean
}

export function StatusBar({ status, connected, onSyncNow, isOffline }: StatusBarProps) {
  const lastSync = status.last_sync_at
    ? new Date(status.last_sync_at).toLocaleTimeString()
    : 'Never'
    
  let backoffMsg = null
  if (status.backoff_until && Date.now() < status.backoff_until) {
    const mins = Math.ceil((status.backoff_until - Date.now()) / 60000)
    backoffMsg = `Sync paused (Rate Limited) - Retrying in ${mins}m`
  }

  return (
    <div className="h-10 px-4 flex items-center justify-between border-b border-surface-border bg-surface-raised text-xs text-gray-500">
      <div className="flex items-center gap-4">
        {isOffline ? (
          <span className="flex items-center gap-1.5 text-amber-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            Offline (Showing Cached Data)
          </span>
        ) : (
          <span className={`flex items-center gap-1.5 ${connected ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            {connected ? 'Gmail connected' : 'Gmail disconnected'}
          </span>
        )}
        {status.is_syncing && <span className="text-accent">Syncing...</span>}
        {status.is_classifying && <span className="text-accent">Classifying...</span>}
        <span>{status.total_messages} messages</span>
        {status.unclassified_count > 0 && (
          <span className="text-yellow-500">
            {status.unclassified_count} waiting for AI
          </span>
        )}
        {backoffMsg && <span className="text-amber-400 font-medium">{backoffMsg}</span>}
        {!backoffMsg && status.error && <span className="text-red-400 truncate max-w-[200px]" title={status.error}>{status.error}</span>}
      </div>
      <div className="flex items-center gap-3">
        <span>Last sync: {lastSync}</span>
        <button
          onClick={onSyncNow}
          disabled={status.is_syncing || !connected || isOffline || !!status.backoff_until}
          className="px-3 py-1 rounded bg-surface-border hover:bg-accent/30 text-gray-300 disabled:opacity-40"
        >
          Sync now
        </button>
      </div>
    </div>
  )
}
