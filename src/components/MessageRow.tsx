import type { Message } from '../../electron/shared/types'
import { IMPORTANCE_LABELS } from '../../electron/shared/types'

interface MessageRowProps {
  message: Message
  selected: boolean
  onClick: () => void
  onArchive: (e: React.MouseEvent) => void
  onMarkDone: (e: React.MouseEvent) => void
  categoryLabels: Record<string, string>
}

const importanceColors: Record<string, string> = {
  critical: 'bg-critical-bg text-critical border-critical/20',
  high: 'bg-warning-bg text-warning border-warning/20',
  medium: 'bg-accent-glow text-accent-muted border-accent/20',
  low: 'bg-surface-raised text-gray-400 border-surface-border'
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function MessageRow({ message, selected, onClick, onArchive, onMarkDone, categoryLabels }: MessageRowProps) {
  const sender = message.from_name ?? message.from_address
  const impColor = message.importance ? importanceColors[message.importance] : 'bg-surface-raised text-gray-500 border-transparent'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-5 py-4 border-b border-surface-border/50 transition-all ${
        selected ? 'bg-surface-hover/80 shadow-[inset_2px_0_0_0_#6366f1]' : 'hover:bg-surface-hover/40'
      } ${message.action_required ? (selected ? 'shadow-[inset_2px_0_0_0_#6366f1]' : 'shadow-[inset_2px_0_0_0_#4f46e5]') : ''}`}
    >
      <div className="flex items-start justify-between gap-3 group relative">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold text-sm truncate ${selected ? 'text-white' : 'text-gray-200'}`}>{sender}</span>
          </div>
          <p className={`text-sm truncate mb-1 ${selected ? 'text-gray-200' : 'text-gray-400'}`}>{message.subject || '(no subject)'}</p>
          <p className="text-xs text-gray-500 truncate">{message.snippet}</p>
          
          <div className="flex items-center gap-2 mt-3">
            {message.importance && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${impColor}`}>
                {IMPORTANCE_LABELS[message.importance]}
              </span>
            )}
            {message.category && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-surface-border bg-surface text-gray-400">
                {categoryLabels[message.category] || message.category}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-xs text-gray-500 font-medium">{formatDate(message.received_at)}</span>
          {message.action_required === 1 && (
            <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 shadow-sm">
              Action
            </span>
          )}
        </div>

        {/* Hover Quick Actions */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-surface-raised/80 backdrop-blur-sm p-1.5 rounded-lg border border-surface-border shadow-glass-sm transition-opacity">
          {message.action_required === 1 && (
            <button
              onClick={onMarkDone}
              title="Mark as Done"
              className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </button>
          )}
          <button
            onClick={onArchive}
            title="Archive"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-surface-hover rounded-md transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="4" rx="2"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>
          </button>
        </div>
      </div>
    </button>
  )
}
