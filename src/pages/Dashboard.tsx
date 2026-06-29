import { useEffect, useState } from 'react'
import { Activity, Mail, ShieldAlert, BarChart3, Lightbulb, X } from 'lucide-react'
import type { Message } from '../../electron/shared/types'
import { getCategoryLabels, DEFAULT_CATEGORY_LABELS } from '../../electron/shared/types'

export function Dashboard({ onNavigate, onSelectMessage, isPro, email }: { onNavigate?: (page: string) => void, onSelectMessage?: (id: string) => void, isPro?: boolean, email?: string }) {
  const [stats, setStats] = useState({ processed24h: 0, actionsRequired: 0, newslettersBypassed: 0, followUps: 0 })
  const [recent, setRecent] = useState<Message[]>([])
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(DEFAULT_CATEGORY_LABELS)
  const [showSpotlight, setShowSpotlight] = useState(true)

  useEffect(() => {
    async function load() {
      // Approximate using recent messages
      const msgs = await window.api.messages.list({ limit: 300 })
      
      const now = Date.now()
      const dayAgo = now - 24 * 60 * 60 * 1000
      
      const processed24h = msgs.filter(m => m.classified_at && m.classified_at > dayAgo).length
      const actionsRequired = msgs.filter(m => m.action_required).length
      const newslettersBypassed = msgs.filter(m => m.category === 'newsletter' && m.classification_source === 'sender_rule').length
      
      let followUps = 0
      if (isPro) {
        try {
          const fups = await window.api.messages.getFollowUps()
          followUps = fups.length
        } catch (e) {}
      }

      const settings = await window.api.settings.get()
      setCategoryLabels(getCategoryLabels(settings))
      setStats({ processed24h, actionsRequired, newslettersBypassed, followUps })
      setRecent(msgs.filter(m => m.classified_at).slice(0, 10))
    }
    if (window.api) load()
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#09090b] relative">
      {/* Background Glow */}
      <div className="absolute top-0 left-[20%] w-[60%] h-64 bg-indigo-500/10 blur-[100px] pointer-events-none rounded-full"></div>
      
      <div className="max-w-5xl mx-auto relative z-10">
        {!isPro && email !== 'removed_admin@gmail.com' && showSpotlight && (
          <div className="mb-8 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-start sm:items-center justify-between gap-4 shadow-glass-sm animate-in slide-in-from-top-4 fade-in duration-500">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-500/20 p-2 rounded-lg text-indigo-400">
                <Lightbulb size={20} />
              </div>
              <p className="text-sm text-indigo-100 leading-relaxed">
                <span className="font-semibold text-indigo-300">Pro Tip:</span> Tired of deleting newsletters manually? NovaSift Pro can auto-archive them before you even see them.{' '}
                <button onClick={() => onNavigate?.('upgrade')} className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-4 ml-1">
                  Compare Plans
                </button>
              </p>
            </div>
            <button onClick={() => setShowSpotlight(false)} className="text-gray-500 hover:text-gray-300 transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>
        )}

        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-8 tracking-tight">Command Center</h2>
        
        <div className={`grid grid-cols-1 md:grid-cols-${isPro ? '4' : '3'} gap-6 mb-10`}>
          <div className="bg-black/40 backdrop-blur-xl border border-surface-border/50 rounded-2xl p-6 shadow-glass-sm flex flex-col justify-between relative overflow-hidden group hover:border-indigo-500/30 transition-all hover:shadow-[0_8px_30px_rgba(99,102,241,0.1)]">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
              <Activity size={48} className="text-indigo-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-400 tracking-wide uppercase">AI Processed (24h)</h3>
            <p className="text-5xl font-bold text-white mt-6 tracking-tight">{stats.processed24h}</p>
          </div>
          
          <div className="bg-black/40 backdrop-blur-xl border border-surface-border/50 rounded-2xl p-6 shadow-glass-sm flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/30 transition-all hover:shadow-[0_8px_30px_rgba(168,85,247,0.1)]">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
              <ShieldAlert size={48} className="text-purple-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-400 tracking-wide uppercase">Actions Required</h3>
            <p className="text-5xl font-bold text-white mt-6 tracking-tight">{stats.actionsRequired}</p>
          </div>

          <div className="bg-black/40 backdrop-blur-xl border border-surface-border/50 rounded-2xl p-6 shadow-glass-sm flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/30 transition-all hover:shadow-[0_8px_30px_rgba(16,185,129,0.1)]">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
              <Mail size={48} className="text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-400 tracking-wide uppercase">Newsletters Bypassed</h3>
            <p className="text-5xl font-bold text-white mt-6 tracking-tight">{stats.newslettersBypassed}</p>
          </div>

          {isPro && (
            <div 
              onClick={() => onNavigate?.('followups')}
              className="bg-black/40 backdrop-blur-xl border border-surface-border/50 rounded-2xl p-6 shadow-glass-sm flex flex-col justify-between relative overflow-hidden group cursor-pointer hover:border-amber-500/40 transition-all hover:shadow-[0_8px_30px_rgba(245,158,11,0.1)]"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500">
                <Mail size={48} className="text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wide uppercase">Needs Follow-up</h3>
              <div className="mt-6 flex items-baseline gap-2">
                <p className="text-5xl font-bold text-white tracking-tight">{stats.followUps}</p>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-amber-500/30">Pro</span>
              </div>
            </div>
          )}
        </div>

        <h3 className="text-xl font-bold text-white mb-6 tracking-tight">Recent Classifications</h3>
        <div className="bg-black/40 backdrop-blur-xl border border-surface-border/50 rounded-2xl shadow-glass overflow-hidden">
          {recent.length === 0 ? (
            <div className="p-12 text-center text-gray-500 font-medium">No recent emails classified yet.</div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {recent.map((msg) => (
                <li key={msg.gmail_id} 
                  className="p-4 flex items-center justify-between hover:bg-surface-hover transition-colors cursor-pointer"
                  onClick={() => {
                    if (onSelectMessage) onSelectMessage(msg.gmail_id)
                    if (onNavigate) onNavigate('triage')
                  }}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm font-medium text-gray-200 truncate">{msg.subject || '(No Subject)'}</p>
                    <p className="text-xs text-gray-500 truncate mt-1">From: {msg.from_address}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wider uppercase border border-surface-border bg-surface text-gray-400">
                      {msg.category ? (categoryLabels[msg.category] || msg.category) : 'Unknown'}
                    </span>
                    {msg.action_required && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        Action Required
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
