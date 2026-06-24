import { useEffect, useState } from 'react'
import { Sidebar, type FilterValue, type ViewMode } from './components/Sidebar'
import { StatusBar } from './components/StatusBar'
import { useSyncStatus } from './hooks/useSyncStatus'
import { useProAccess } from './hooks/useProAccess'
import { Inbox } from './pages/Inbox'
import { Onboarding } from './pages/Onboarding'
import { Senders } from './pages/Senders'
import { Settings } from './pages/Settings'
import { Dashboard } from './pages/Dashboard'
import { Subscriptions } from './pages/Subscriptions'
import { SystemLogs } from './pages/SystemLogs'
import { Upgrade } from './pages/Upgrade'
import { FollowUps } from './pages/FollowUps'
import { OnboardingWizard } from './components/OnboardingWizard'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

export type Page = 'dashboard' | 'triage' | 'subscriptions' | 'rules' | 'followups' | 'logs' | 'settings' | 'upgrade'

export default function App() {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [viewMode, setViewMode] = useState<ViewMode>('importance')
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all')
  const [focusMode, setFocusMode] = useState(false)
  const syncStatus = useSyncStatus()
  const [missingKey, setMissingKey] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const { isValid: isPro, refresh: refreshLicense } = useProAccess()
  const [email, setEmail] = useState('')
  const [hiddenCount, setHiddenCount] = useState(0)
  const [actionReqCount, setActionReqCount] = useState(0)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Custom Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const refreshGlobalState = async () => {
    const s = await window.api.settings.get()
    await refreshLicense()
    setEmail(s.email_address)
    try {
      const keys = JSON.parse(s.ai_api_keys)
      if (!keys[s.ai_provider]) {
        setMissingKey(s.ai_provider)
        setShowWizard(true)
      }
      else {
        setMissingKey(null)
        setShowWizard(false)
      }
    } catch {
      setMissingKey(s.ai_provider)
      setShowWizard(true)
    }
  }

  const handleSaveWizardKey = async (apiKey: string) => {
    if (!missingKey) return
    const settings = await window.api.settings.get()
    let keys: Record<string, string> = {}
    try { keys = JSON.parse(settings.ai_api_keys) } catch {}
    keys[missingKey] = apiKey
    await window.api.settings.save({ ai_api_keys: JSON.stringify(keys) })
    await refreshGlobalState()
  }

  useEffect(() => {
    window.api.gmail.isConnected().then((conn) => {
      setConnected(conn)
      if (conn) refreshGlobalState()
    })
    const unsubConn = window.api.onConnectionChanged((conn) => {
      setConnected(conn)
      if (conn) refreshGlobalState()
    })
    const unsubOpen = window.api.onMessageOpen?.((gmailId) => {
      setSelectedMessageId(gmailId)
      setCurrentPage('triage')
    })
    return () => {
      unsubConn()
      if (unsubOpen) unsubOpen()
    }
  }, [])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
      if ((e.key === 'f' && !e.metaKey && !e.ctrlKey) || ((e.metaKey || e.ctrlKey) && e.key === 'f')) {
        e.preventDefault()
        if (currentPage !== 'triage') setCurrentPage('triage')
        setFocusMode(prev => {
          const next = !prev
          if (!next && actionReqCount === 0) showToast('You cleared your critical inbox 🎯', 'success')
          return next
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, actionReqCount])

  const handleToggleFocus = (focus: boolean) => {
    setFocusMode(focus)
    if (!focus && actionReqCount === 0) showToast('You cleared your critical inbox 🎯', 'success')
  }

  const handleConnect = async () => {
    setConnecting(true)
    setConnectError(null)
    const result = await window.api.gmail.connect()
    setConnecting(false)
    if (result.success) {
      setConnected(true)
      showToast('Successfully connected to Gmail', 'success')
    } else {
      setConnectError(result.error ?? 'Connection failed')
    }
  }

  const handleSyncNow = async () => {
    await window.api.sync.now()
    await syncStatus.refresh()
    showToast('Sync completed', 'success')
  }

  return (
    <div className="h-full flex flex-col bg-surface text-gray-200">
      <div className="h-8 flex-shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
      
      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-surface-raised border border-surface-border shadow-glass text-sm font-medium animate-in slide-in-from-top-4 fade-in">
          {toast.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-critical" />}
          {toast.message}
        </div>
      )}

      {connected && (
        <StatusBar 
          status={syncStatus} 
          connected={connected} 
          isOffline={isOffline}
          onSyncNow={handleSyncNow} 
        />
      )}
      
      <div className="flex-1 flex min-h-0">
        {connected ? (
          <>
            <Sidebar
              viewMode={viewMode}
              activeFilter={activeFilter}
              onViewModeChange={setViewMode}
              onFilterChange={setActiveFilter}
              currentPage={currentPage}
              onPageChange={(p) => setCurrentPage(p as Page)}
              syncStatus={syncStatus}
              isPro={isPro}
              email={email}
              focusMode={focusMode}
              onToggleFocus={handleToggleFocus}
              hiddenCount={hiddenCount}
              actionReqCount={actionReqCount}
            />
            <div className="flex-1 flex flex-col min-w-0">
              {missingKey && showWizard && (
                <OnboardingWizard 
                  missingProvider={missingKey} 
                  onSave={handleSaveWizardKey} 
                  onSkip={() => setShowWizard(false)} 
                />
              )}
              {missingKey && !showWizard && currentPage !== 'settings' && (
                <div className="flex-shrink-0 bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between shadow-glass-sm z-20">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="text-amber-500" size={18} />
                    <p className="text-sm font-medium text-amber-200/90">
                      ⚠️ AI Engine Offline: Please add your {missingKey.charAt(0).toUpperCase() + missingKey.slice(1)} API Key in Settings to begin automated sorting and smart reply generation.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowWizard(true)}
                    className="px-4 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-md text-xs font-semibold transition-colors border border-amber-500/20"
                  >
                    Add Key Now
                  </button>
                </div>
              )}
              {currentPage === 'dashboard' && <Dashboard onNavigate={(p) => setCurrentPage(p as Page)} onSelectMessage={setSelectedMessageId} isPro={isPro} email={email} />}
              {currentPage === 'triage' && (
                <Inbox 
                  viewMode={viewMode} 
                  activeFilter={activeFilter} 
                  focusMode={focusMode}
                  onNavigate={(p) => setCurrentPage(p as Page)} 
                  selectedMessageId={selectedMessageId}
                  onSelectMessage={setSelectedMessageId}
                  isPro={isPro}
                  onStatsUpdate={(h, a) => {
                    setHiddenCount(h)
                    setActionReqCount(a)
                  }}
                />
              )}
              {currentPage === 'subscriptions' && <Subscriptions isPro={isPro} onNavigate={(p) => setCurrentPage(p as Page)} email={email} />}
              {currentPage === 'rules' && <Senders />}
              {currentPage === 'followups' && <FollowUps onNavigate={(p) => setCurrentPage(p as Page)} />}
              {currentPage === 'logs' && <SystemLogs />}
              {currentPage === 'settings' && <Settings onSaveSuccess={() => { showToast('Settings saved', 'success'); refreshGlobalState(); }} showToast={showToast} isPro={isPro} email={email} onNavigate={(p) => setCurrentPage(p as Page)} />}
              {currentPage === 'upgrade' && <Upgrade isPro={isPro} email={email} onSaveSuccess={() => { showToast('Settings saved', 'success'); refreshGlobalState(); }} showToast={showToast} onNavigate={(p) => setCurrentPage(p as Page)} />}
            </div>
          </>
        ) : (
          <Onboarding onConnect={handleConnect} connecting={connecting} error={connectError} />
        )}
      </div>
    </div>
  )
}
