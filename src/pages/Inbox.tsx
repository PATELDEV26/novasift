import { useState, useEffect } from 'react'
import type { Category, Importance, Message } from '../../electron/shared/types'
import { getCategoryLabels, DEFAULT_CATEGORY_LABELS } from '../../electron/shared/types'
import { MessageDetail } from '../components/MessageDetail'
import { MessageRow } from '../components/MessageRow'
import type { FilterValue, ViewMode } from '../components/Sidebar'
import { useMessages } from '../hooks/useMessages'

interface InboxProps {
  viewMode: ViewMode
  activeFilter: FilterValue
  onNavigate?: (page: string) => void
  selectedMessageId?: string | null
  onSelectMessage?: (id: string | null) => void
  isPro?: boolean
  focusMode?: boolean
  onStatsUpdate?: (hidden: number, actionReq: number) => void
}

export function Inbox({ viewMode, activeFilter, onNavigate, selectedMessageId, onSelectMessage, isPro, focusMode, onStatsUpdate }: InboxProps) {
  const filters =
    viewMode === 'importance' && activeFilter !== 'all'
      ? { importance: activeFilter as Importance }
      : viewMode === 'category' && activeFilter !== 'all'
        ? { category: activeFilter as Category }
        : undefined

  const { messages, loading, refresh } = useMessages(filters)
  const [selected, setSelected] = useState<Message | null>(null)
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(DEFAULT_CATEGORY_LABELS)

  useEffect(() => {
    window.api.settings.get().then(s => setCategoryLabels(getCategoryLabels(s)))
  }, [])

  useEffect(() => {
    if (selectedMessageId) {
      const msg = messages.find((m) => m.gmail_id === selectedMessageId)
      if (msg) setSelected(msg)
      else {
        window.api.messages.get(selectedMessageId).then((m) => {
          if (m) setSelected(m)
        })
      }
    }
  }, [selectedMessageId, messages])

  useEffect(() => {
    if (onStatsUpdate) {
      const hidden = messages.filter(m => m.archived !== 1 && m.importance !== 'critical' && m.importance !== 'high').length
      const actionReq = messages.filter(m => m.archived !== 1 && m.action_required).length
      onStatsUpdate(hidden, actionReq)
    }
  }, [messages, onStatsUpdate])

  const handleSelect = (msg: Message) => {
    setSelected(msg)
    if (onSelectMessage) onSelectMessage(msg.gmail_id)
  }

  const handleArchive = async (e: React.MouseEvent, msg: Message) => {
    e.stopPropagation()
    await window.api.messages.archive(msg.gmail_id)
    if (selected?.gmail_id === msg.gmail_id) {
      setSelected(null)
      if (onSelectMessage) onSelectMessage(null)
    }
    refresh()
  }

  const handleMarkDone = async (e: React.MouseEvent, msg: Message) => {
    e.stopPropagation()
    await window.api.messages.updateClassification(msg.gmail_id, {
      importance: msg.importance || 'medium',
      category: msg.category || 'low_priority',
      action_required: false
    })
    refresh()
    if (selected?.gmail_id === msg.gmail_id) {
      window.api.messages.get(msg.gmail_id).then((m) => m && setSelected(m))
    }
  }

  return (
    <div className="flex-1 flex min-h-0 bg-surface">
      <div className="w-[400px] flex-shrink-0 border-r border-surface-border flex flex-col min-h-0 bg-surface-raised/30 backdrop-blur-sm z-10">
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white tracking-wide">
            {loading ? 'Loading...' : 'Triage'}
          </h2>
          <span className="text-xs font-medium text-gray-500 bg-surface border border-surface-border px-2 py-0.5 rounded-full shadow-glass-sm">
            {messages.length} messages
          </span>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && messages.length === 0 && (
            <div className="p-8 text-center text-gray-500">Loading messages...</div>
          )}
          {messages
            .filter(m => m.archived !== 1)
            .filter(m => !focusMode || m.importance === 'critical' || m.importance === 'high')
            .length === 0 && !loading && (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
              <p className="text-sm font-medium">Inbox Zero</p>
              <p className="text-xs mt-1">No messages found for this filter.</p>
            </div>
          )}
          {messages
            .filter(m => m.archived !== 1)
            .filter(m => !focusMode || m.importance === 'critical' || m.importance === 'high')
            .map((msg) => (
            <MessageRow
              key={msg.gmail_id}
              message={msg}
              selected={selected?.gmail_id === msg.gmail_id}
              onClick={() => handleSelect(msg)}
              onArchive={(e) => handleArchive(e, msg)}
              onMarkDone={(e) => handleMarkDone(e, msg)}
              categoryLabels={categoryLabels}
            />
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-surface z-0 relative">
        <MessageDetail
          message={selected}
          isPro={isPro}
          onUpdate={() => {
            refresh()
            if (selected) {
              window.api.messages.get(selected.gmail_id).then((m) => m && setSelected(m))
            }
          }}
        />
      </div>
    </div>
  )
}
