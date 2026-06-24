import { useEffect, useState } from 'react'
import { Sparkles, Newspaper, ArchiveX, ShieldX, CheckCircle2, AlertCircle } from 'lucide-react'
import type { SenderSummary } from '../../electron/shared/types'
import type { Page } from '../App'

interface SubscriptionsProps {
  isPro: boolean
  email: string
  onNavigate: (page: Page) => void
}

export function Subscriptions({ isPro, email, onNavigate }: SubscriptionsProps) {
  const [subscriptions, setSubscriptions] = useState<SenderSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  
  const isAdmin = email === 'removed_admin@gmail.com'
  const isProAccess = isPro || isAdmin

  const loadSubscriptions = async () => {
    try {
      const data = await window.api.senders.getSubscriptions()
      setSubscriptions(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isProAccess) {
      loadSubscriptions()
    } else {
      setLoading(false)
    }
  }, [isProAccess])

  const handleUnsubscribeAndClean = async (senderAddress: string) => {
    setProcessing(senderAddress)
    try {
      // 1. Archive all existing
      await window.api.senders.archiveAll(senderAddress)
      // 2. Block future ones (mark as spam-like, low importance, skip AI)
      await window.api.senders.upsertRule({
        sender: senderAddress,
        match_type: 'exact',
        importance: 'low',
        category: 'spam_like',
        skip_ai: true
      })
      // Remove from list
      setSubscriptions(prev => prev.filter(s => s.from_address !== senderAddress))
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-surface relative h-full flex flex-col">
      <div className="p-8 border-b border-surface-border bg-surface-raised/30 backdrop-blur-md sticky top-0 z-20 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Newspaper className="text-indigo-400" /> Newsletter Manager
          </h2>
          <p className="text-sm text-gray-400">Instantly clean up your inbox by bulk-archiving newsletters and auto-blocking future ones.</p>
        </div>
        {!isProAccess && (
          <div className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center gap-2">
            <Sparkles size={14} className="text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300">Pro Feature</span>
          </div>
        )}
      </div>

      <div className="p-8 relative flex-1">
        {!isProAccess ? (
          <div className="max-w-2xl mx-auto mt-12 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/30 shadow-[0_0_50px_rgba(99,102,241,0.2)]">
              <ArchiveX size={48} className="text-indigo-400" />
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">Take Back Your Inbox</h3>
            <p className="text-gray-400 mb-8 leading-relaxed">
              Tired of endless promotional emails? The Newsletter Manager automatically detects frequent senders, letting you 1-click archive all their past emails and block future ones forever.
            </p>
            <button
              onClick={() => onNavigate('upgrade')}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-white font-bold shadow-lg transition-all flex items-center gap-2 mx-auto"
            >
              <Sparkles size={20} /> Upgrade to Pro to Unlock
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <CheckCircle2 size={48} className="text-emerald-500/50 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Inbox Clean!</h3>
            <p className="text-gray-400 text-sm max-w-md">We didn't find any high-volume newsletters or promotional senders in your inbox.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {subscriptions.map((sub) => (
              <div key={sub.from_address} className="bg-surface-raised border border-surface-border rounded-xl p-5 flex items-center justify-between hover:border-indigo-500/30 transition-all group shadow-sm">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-surface-hover flex items-center justify-center flex-shrink-0 text-gray-300 font-bold uppercase">
                    {(sub.from_name || sub.from_address).charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-white font-medium truncate text-sm">
                      {sub.from_name || sub.from_address}
                    </h4>
                    <p className="text-gray-500 text-xs truncate">{sub.from_address}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface border border-surface-border text-gray-400">
                        {sub.message_count} emails
                      </span>
                      <span className="text-[10px] text-gray-500">
                        Last received: {new Date(sub.latest_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0 ml-6">
                  <button
                    onClick={() => handleUnsubscribeAndClean(sub.from_address)}
                    disabled={processing === sub.from_address}
                    className="px-4 py-2 bg-critical/10 hover:bg-critical/20 text-critical border border-critical/20 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {processing === sub.from_address ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-critical"></div>
                    ) : (
                      <ShieldX size={14} />
                    )}
                    {processing === sub.from_address ? 'Cleaning...' : 'Unsubscribe & Clean'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
