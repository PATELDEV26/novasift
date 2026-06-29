import { useState, useEffect } from 'react'
import { LayoutDashboard, Inbox, Shield, Settings2, TerminalSquare, Newspaper, LogOut } from 'lucide-react'
import type { Category, Importance, SyncStatus } from '../../electron/shared/types'
import { DEFAULT_CATEGORY_LABELS, IMPORTANCE_LABELS, getCategoryLabels } from '../../electron/shared/types'
import type { Page } from '../App'

export type ViewMode = 'importance' | 'category' | 'all'
export type FilterValue = Importance | Category | 'all'

interface SidebarProps {
  viewMode: ViewMode
  activeFilter: FilterValue
  onViewModeChange: (mode: ViewMode) => void
  onFilterChange: (filter: FilterValue) => void
  currentPage: Page
  onPageChange: (page: Page) => void
  syncStatus: SyncStatus
  isPro?: boolean
  email?: string
  focusMode?: boolean
  onToggleFocus?: (focus: boolean) => void
  hiddenCount?: number
  actionReqCount?: number
}

export function Sidebar({
  viewMode,
  activeFilter,
  onViewModeChange,
  onFilterChange,
  currentPage,
  onPageChange,
  syncStatus,
  isPro,
  email,
  focusMode,
  onToggleFocus,
  hiddenCount = 0,
  actionReqCount = 0
}: SidebarProps) {
  const importanceFilters = Object.entries(IMPORTANCE_LABELS) as [Importance, string][]
  const [labels, setLabels] = useState<Record<string, string>>(DEFAULT_CATEGORY_LABELS)
  
  useEffect(() => {
    window.api.settings.get().then(s => setLabels(getCategoryLabels(s)))
  }, [])

  const categoryFilters = Object.entries(labels) as [Category, string][]

  const handleLogout = async () => {
    await window.api.gmail.disconnect()
    window.location.reload()
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'triage', label: 'Triage', icon: Inbox },
    { id: 'subscriptions', label: 'Subscriptions', icon: Newspaper },
    { id: 'rules', label: 'Sender Rules', icon: Shield },
    { id: 'logs', label: 'System Logs', icon: TerminalSquare },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ] as const

  return (
    <aside className="w-64 flex-shrink-0 bg-surface-raised/50 backdrop-blur-md border-r border-surface-border flex flex-col h-full">
      <div className="p-5 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent flex items-center justify-center text-white font-bold text-xs shadow-glass-sm">N</div>
          <h1 className="text-sm font-semibold text-white tracking-wide">NovaSift</h1>
        </div>
      </div>

      <nav className="p-3 flex-1 overflow-y-auto space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-accent/10 text-accent' : 'text-gray-400 hover:text-gray-200 hover:bg-surface-hover'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          )
        })}

        {currentPage === 'triage' && (
          <div className="mt-6 pt-6 border-t border-surface-border/50">
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Inbox Mode</p>
            <div className="px-2 mb-4">
              <button
                onClick={() => onToggleFocus?.(!focusMode)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  focusMode 
                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-glass-sm' 
                    : 'text-gray-400 hover:text-gray-200 hover:bg-surface-hover border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${focusMode ? 'bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-gray-600'}`}></span>
                  Focus Mode
                </div>
                <span className={`text-[10px] uppercase font-bold tracking-wider ${focusMode ? 'text-indigo-400' : 'text-gray-600'}`}>
                  {focusMode ? 'ON' : 'OFF'}
                </span>
              </button>
              <p className="px-1 mt-3 text-[10px] text-gray-500 leading-relaxed font-medium">
                {focusMode ? (
                  <>Hiding <span className="text-gray-300 font-bold">{hiddenCount}</span> emails · <span className={actionReqCount > 0 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>{actionReqCount}</span> need your attention</>
                ) : (
                  <>When active, only <span className="text-critical">Critical</span> and <span className="text-warning">High</span> importance emails are visible.</>
                )}
              </p>
            </div>
            
            <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Triage Filters</p>
            {(['importance', 'category', 'all'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  onViewModeChange(mode)
                  onFilterChange('all')
                }}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium mb-0.5 capitalize transition-colors ${
                  viewMode === mode ? 'text-white bg-surface-hover border border-surface-border' : 'text-gray-400 hover:text-gray-300 hover:bg-surface-hover/50 border border-transparent'
                }`}
              >
                {mode === 'all' ? 'All mail' : mode}
              </button>
            ))}

            <div className="mt-4 px-3">
              {viewMode === 'importance' && (
                <div className="space-y-1">
                  <button
                    onClick={() => onFilterChange('all')}
                    className={`w-full text-left text-xs ${activeFilter === 'all' ? 'text-accent font-medium' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    All Importance
                  </button>
                  {importanceFilters.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => onFilterChange(key)}
                      className={`w-full text-left text-xs py-1 ${
                        activeFilter === key ? 'text-accent font-medium' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {viewMode === 'category' && (
                <div className="space-y-1">
                  <button
                    onClick={() => onFilterChange('all')}
                    className={`w-full text-left text-xs ${activeFilter === 'all' ? 'text-accent font-medium' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    All Categories
                  </button>
                  {categoryFilters.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => onFilterChange(key)}
                      className={`w-full text-left text-xs py-1 ${
                        activeFilter === key ? 'text-accent font-medium' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {!isPro && email !== 'removed_admin@gmail.com' && (
        <div className="px-4 pb-4">
          <div 
            onClick={() => onPageChange('upgrade')}
            className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-500/20 rounded-xl p-4 cursor-pointer group transition-all relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <h4 className="text-sm font-semibold text-white mb-1 flex items-center gap-1.5 relative z-10 tracking-tight">
              ✨ Unlock NovaSift Pro
            </h4>
            <p className="text-[11px] text-indigo-200/70 leading-relaxed relative z-10">
              Custom folders, zero-touch archiving, and unlimited AI drafts.
            </p>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-surface-border bg-surface-raised/30 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-2 w-2">
              {syncStatus.is_syncing && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${syncStatus.is_syncing ? 'bg-emerald-500' : 'bg-gray-600'}`}></span>
            </div>
            <span className="text-xs font-medium text-gray-400">
              {syncStatus.is_syncing ? 'Syncing...' : 'Idle'}
            </span>
          </div>
          <span className="text-[10px] text-gray-600">{syncStatus.unclassified_count} pending</span>
        </div>
        
        {email && (
          <div className="mt-1 pt-3 border-t border-surface-border/50 flex items-center justify-between gap-2">
            <button 
              onClick={() => onPageChange('upgrade')}
              className="flex-1 flex items-center justify-between hover:bg-surface-hover/50 p-2 -mx-2 rounded-lg transition-colors cursor-pointer text-left overflow-hidden"
              title="View Free & Premium Features"
            >
              <span className="text-xs font-medium text-gray-400 truncate max-w-[120px]" title={email}>{email}</span>
              {isPro ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)] flex items-center gap-1 shrink-0">
                  PRO 👑
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface text-gray-500 border border-surface-border group-hover:border-indigo-500/50 transition-colors shrink-0">
                  FREE
                </span>
              )}
            </button>
            <button 
              onClick={handleLogout}
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors shrink-0"
              title="Log Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
