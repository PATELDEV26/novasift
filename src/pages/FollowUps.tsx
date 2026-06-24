import { useEffect, useState } from 'react'
import { Mail, ArrowLeft, Clock, SearchX } from 'lucide-react'
import type { Message } from '../../electron/shared/types'
import { MessageDetail } from '../components/MessageDetail'

export function FollowUps({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const fups = await window.api.messages.getFollowUps()
        setMessages(fups)
        if (fups.length > 0 && !selectedId) {
          setSelectedId(fups[0].gmail_id)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    if (window.api) load()
  }, [])

  return (
    <div className="flex-1 flex h-full min-h-0 bg-surface">
      {/* Left List */}
      <div className="w-[400px] flex-shrink-0 border-r border-surface-border flex flex-col h-full bg-surface-raised/30">
        <div className="p-4 border-b border-surface-border bg-surface flex items-center gap-4">
          <button onClick={() => onNavigate?.('dashboard')} className="text-gray-400 hover:text-gray-200 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Mail className="text-amber-400" size={18} /> Needs Follow-up
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Awaiting replies for 3+ days</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
              <SearchX size={48} className="mb-4 text-surface-border" />
              <p className="text-sm font-medium text-gray-300">You're all caught up!</p>
              <p className="text-xs mt-2">No pending follow-ups found.</p>
            </div>
          ) : (
            <ul className="divide-y divide-surface-border">
              {messages.map(msg => (
                <li
                  key={msg.gmail_id}
                  onClick={() => setSelectedId(msg.gmail_id)}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedId === msg.gmail_id
                      ? 'bg-accent/10 border-l-2 border-accent'
                      : 'hover:bg-surface-hover border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span className="font-semibold text-sm text-gray-200 truncate flex-1">
                      {msg.from_name || msg.from_address}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1 shrink-0">
                      <Clock size={12} />
                      {new Date(msg.received_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className={`text-sm mb-1 ${selectedId === msg.gmail_id ? 'text-gray-200 font-medium' : 'text-gray-400 truncate'}`}>
                    {msg.subject || '(no subject)'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right Detail */}
      <div className="flex-1 min-w-0 bg-surface">
        {selectedId ? (
          <MessageDetail message={messages.find(m => m.gmail_id === selectedId) || null} onUpdate={() => {}} isPro={true} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            Select a conversation to view
          </div>
        )}
      </div>
    </div>
  )
}
