import { useState, useEffect } from 'react'
import type { Category, Importance, Message } from '../../electron/shared/types'
import { IMPORTANCE_LABELS, IMPORTANCE_LEVELS, getCategories, getCategoryLabels, DEFAULT_CATEGORIES, DEFAULT_CATEGORY_LABELS } from '../../electron/shared/types'
import { Bot, Mail, Clock, ShieldAlert } from 'lucide-react'

interface MessageDetailProps {
  message: Message | null
  onUpdate: () => void
  isPro?: boolean
}

export function MessageDetail({ message, onUpdate, isPro }: MessageDetailProps) {
  const [saving, setSaving] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [draftSent, setDraftSent] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(DEFAULT_CATEGORY_LABELS)

  useEffect(() => {
    window.api.settings.get().then(s => {
      setCategories(getCategories(s))
      setCategoryLabels(getCategoryLabels(s))
    })
  }, [])

  // Reset state when message changes
  useEffect(() => {
    setSummary(null)
    setDraftText('')
    setDraftSent(false)
  }, [message?.gmail_id])

  if (!message) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 h-full">
        <Mail size={48} className="mb-4 text-gray-700 opacity-50" />
        <p className="text-sm font-medium tracking-wide">Select a message to view details</p>
      </div>
    )
  }

  const handleSave = async (importance: Importance, category: Category, actionRequired: boolean) => {
    setSaving(true)
    await window.api.messages.updateClassification(message.gmail_id, {
      importance,
      category,
      action_required: actionRequired
    })
    setSaving(false)
    onUpdate()
  }



  return (
    <div className="flex-1 overflow-y-auto p-8 relative">
      <div className="max-w-3xl mx-auto">
        {/* Sleek AI Reasoning Box */}
        {message.ai_reason && (
          <div className="mb-8 rounded-xl bg-black/40 border border-surface-border shadow-glass-sm overflow-hidden backdrop-blur-md">
            <div className="px-4 py-2 bg-accent/10 border-b border-surface-border flex items-center gap-2">
              <Bot size={16} className="text-accent" />
              <span className="text-xs font-semibold text-accent tracking-wider uppercase">AI Analysis</span>
              {message.action_required === 1 && (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                  <ShieldAlert size={12} /> ACTION REQUIRED
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-300 leading-relaxed font-medium">
                Flagged as <span className="text-white font-semibold">{message.importance ? IMPORTANCE_LABELS[message.importance] : 'Unclassified'}</span> because: {message.ai_reason}
              </p>
              {message.classification_source && (
                <p className="text-[10px] text-gray-600 mt-2 font-mono">Source: {message.classification_source}</p>
              )}
            </div>
          </div>
        )}

        {/* Smart Auto-Drafts Box */}
        {message.action_required === 1 && (
          <div className="mb-8 p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 shadow-glass-sm">
            {!draftText && !draftSent ? (
              <button
                onClick={async () => {
                  setDrafting(true)
                  try {
                    const text = await window.api.messages.generateDraft(message.gmail_id)
                    setDraftText(text)
                  } catch (e) {
                    console.error(e)
                    alert('Draft failed: ' + String(e))
                  }
                  setDrafting(false)
                }}
                disabled={drafting}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-lg text-white font-bold tracking-wide shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                ✨ {drafting ? 'Drafting...' : 'Draft Smart Reply'}
              </button>
            ) : draftSent ? (
              <p className="text-emerald-400 font-medium text-center text-sm py-2">✅ Saved to Gmail Drafts</p>
            ) : (
              <div className="space-y-4">
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  rows={4}
                  className="w-full bg-surface border border-surface-border rounded-lg p-3 text-sm text-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition-all resize-y"
                />
                <button
                  onClick={async () => {
                    setDrafting(true)
                    try {
                      await window.api.messages.createDraft(message.thread_id, draftText, message.from_address, message.subject)
                      setDraftSent(true)
                    } catch(e) {
                      alert('Send failed: ' + String(e))
                    }
                    setDrafting(false)
                  }}
                  disabled={drafting}
                  className="w-full py-2.5 bg-accent hover:bg-accent-muted rounded-lg text-white font-medium shadow-glass-sm disabled:opacity-50 transition-all"
                >
                  {drafting ? 'Saving...' : 'Send to Gmail Drafts'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Email Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-4 tracking-tight leading-tight">
              {message.subject || '(no subject)'}
            </h2>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-surface-raised border border-surface-border flex items-center justify-center text-white font-medium shadow-sm">
                  {(message.from_name || message.from_address || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-gray-200 font-medium">{message.from_name || (message.from_address || 'Unknown').split('@')[0]}</p>
                  <p className="text-xs text-gray-500">{message.from_address || 'Unknown Sender'}</p>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-xs">
                <Clock size={14} />
                {new Date(message.received_at).toLocaleString()}
              </div>
            </div>
          </div>
          
          {/* Summarizer Button */}
          {isPro && !summary && (
            <button
              onClick={async () => {
                setSummarizing(true)
                try {
                  const result = await window.api.messages.summarize(message.gmail_id)
                  setSummary(result)
                } catch (e) {
                  console.error(e)
                  alert('Summary failed: ' + String(e))
                }
                setSummarizing(false)
              }}
              disabled={summarizing}
              className="ml-4 px-4 py-2 bg-surface border border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm whitespace-nowrap disabled:opacity-50"
            >
              <Bot size={16} />
              {summarizing ? 'Summarizing...' : '✨ TL;DR'}
            </button>
          )}
        </div>

        {/* AI Summary Box */}
        {summary && (
          <div className="mb-8 p-5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 shadow-glass-sm backdrop-blur-md">
            <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Bot size={14} /> AI Summary
            </h3>
            <div className="text-sm text-gray-200 leading-relaxed font-medium whitespace-pre-wrap">
              {summary}
            </div>
          </div>
        )}

        {/* Email Content */}
        <div className="p-6 rounded-xl bg-surface-raised border border-surface-border shadow-glass-sm mb-8">
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">
            {message.body_text || message.snippet || 'No content available'}
          </p>
        </div>

        {/* Override Control */}
        <div className="rounded-xl bg-surface border border-surface-border overflow-hidden shadow-glass-sm">
          <div className="px-4 py-3 border-b border-surface-border bg-surface-raised/30">
            <p className="text-xs font-semibold text-gray-500 tracking-wider uppercase">Override Classification</p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">Importance</label>
                <select
                  defaultValue={message.importance ?? 'medium'}
                  id="importance-select"
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all appearance-none"
                >
                  {IMPORTANCE_LEVELS.map((l) => (
                    <option key={l} value={l}>{IMPORTANCE_LABELS[l]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-1.5">Category</label>
                <select
                  defaultValue={message.category ?? 'low_priority'}
                  id="category-select"
                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all appearance-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{categoryLabels[c]}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center justify-between mt-2 pt-4 border-t border-surface-border/50">
              <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" id="action-checkbox" defaultChecked={message.action_required === 1} className="peer sr-only" />
                  <div className="w-5 h-5 border border-surface-border rounded bg-surface peer-checked:bg-accent peer-checked:border-accent transition-all"></div>
                  <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="group-hover:text-white transition-colors font-medium">Action Required</span>
              </label>
              <button
                disabled={saving}
                onClick={() => {
                  const importance = (document.getElementById('importance-select') as HTMLSelectElement).value as Importance
                  const category = (document.getElementById('category-select') as HTMLSelectElement).value as Category
                  const actionRequired = (document.getElementById('action-checkbox') as HTMLInputElement).checked
                  handleSave(importance, category, actionRequired)
                }}
                className="px-5 py-2.5 bg-accent hover:bg-accent-muted rounded-lg text-sm font-medium text-white shadow-glass-sm disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Apply Override'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
