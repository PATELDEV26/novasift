import type { ClassificationSource, Message } from '../shared/types'
import {
  getSettings,
  getSyncState,
  getUnclassifiedMessages,
  updateClassification,
  updateSyncState,
  upsertMessage,
  recordTokenUsage
} from './db'
import {
  fetchHistoryChanges,
  fetchRecentMessages,
  fetchSentMessages,
  getProfileHistoryId,
  isGmailConnected,
  type ParsedMessage
} from './mail-client'
import { classifyMessage } from './classifier'
import { findMatchingRule, ruleToClassification } from './sender-rules'
import { syncMessageLabels } from './label-sync'

let isSyncing = false
let isClassifying = false
let lastError: string | null = null
let syncBackoffUntil: number | null = null
let consecutiveErrors = 0

export function getPipelineStatus() {
  return { isSyncing, isClassifying, lastError, backoff_until: syncBackoffUntil }
}

function parsedToDbMessage(parsed: ParsedMessage) {
  return {
    gmail_id: parsed.gmail_id,
    thread_id: parsed.thread_id,
    from_address: parsed.from_address,
    from_name: parsed.from_name,
    subject: parsed.subject,
    snippet: parsed.snippet,
    body_text: parsed.body_text,
    received_at: parsed.received_at,
    label_ids: JSON.stringify(parsed.label_ids),
    importance: null,
    category: null,
    action_required: 0,
    confidence: null,
    ai_reason: null,
    classified_at: null,
    classification_source: null,
    archived: 0,
    is_sent: 0
  }
}

export async function classifyAndPersist(message: Message): Promise<void> {
  const settings = getSettings()
  if (settings.ai_paused) return

  const rule = findMatchingRule(message)
  if (!rule && (!settings.ai_api_keys || settings.ai_api_keys === '{}' || !settings.ai_model.trim())) return

  let result
  let source: ClassificationSource = 'ai'

  if (rule) {
    result = ruleToClassification(rule)
    source = 'sender_rule'
  } else {
    result = await classifyMessage(message)
    source = 'ai'
    if (result.tokens_used > 0) {
      recordTokenUsage(settings.ai_provider, settings.ai_model.trim() || 'unknown', result.tokens_used)
    }
  }

  updateClassification(message.gmail_id, {
    importance: result.importance,
    category: result.category,
    action_required: result.action_required,
    confidence: result.confidence,
    ai_reason: result.reason,
    classification_source: source
  })

  let archived = 0
  if (
    (settings.auto_archive_newsletters && result.category === 'newsletter') ||
    (settings.auto_archive_low_priority && result.importance === 'low')
  ) {
    try {
      const { archiveMessage } = await import('./mail-client')
      await archiveMessage(message.gmail_id)
      archived = 1
      
      const { getDb } = await import('./db')
      getDb().prepare('UPDATE messages SET archived = 1 WHERE gmail_id = ?').run(message.gmail_id)
    } catch (e) {
      console.error('Failed to auto-archive', message.gmail_id, e)
    }
  }

  const updated = { ...message, ...result, action_required: result.action_required ? 1 : 0, archived }
  await syncMessageLabels(updated as Message)

  if (result.importance === 'critical' && result.action_required) {
    const { Notification, BrowserWindow } = await import('electron')
    if (Notification.isSupported()) {
      const n = new Notification({
        title: 'Important email',
        body: `${message.from_name ?? message.from_address}: ${message.subject}`
      })
      n.on('click', () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          if (win.isMinimized()) win.restore()
          win.show()
          win.webContents.send('messages:open', message.gmail_id)
        }
      })
      n.show()
    }
  }
}

export async function runSync(): Promise<void> {
  if (!isGmailConnected()) {
    lastError = 'Gmail not connected'
    return
  }
  if (isSyncing) return
  if (syncBackoffUntil && Date.now() < syncBackoffUntil) return

  isSyncing = true
  lastError = null

  try {
    const settings = getSettings()
    const syncState = getSyncState()

    let messages: ParsedMessage[] = []
    let newHistoryId: string

    if (syncState.history_id) {
      const result = await fetchHistoryChanges(syncState.history_id)
      messages = result.messages
      newHistoryId = result.newHistoryId
    } else {
      messages = await fetchRecentMessages(settings.lookback_days)
      newHistoryId = await getProfileHistoryId()
    }

    // Fetch sent messages for follow-up tracking
    const sentMessages = await fetchSentMessages(30) // last 30 days for sent
    
    for (const parsed of messages) {
      upsertMessage(parsedToDbMessage(parsed))
    }
    
    for (const parsed of sentMessages) {
      upsertMessage({ ...parsedToDbMessage(parsed), is_sent: 1 })
    }

    updateSyncState(newHistoryId)
    consecutiveErrors = 0
    syncBackoffUntil = null
  } catch (err) {
    lastError = String(err)
    console.error('Sync failed:', err)
    
    // Exponential backoff on failure (5m, 10m, 20m, max 60m)
    consecutiveErrors++
    const backoffMinutes = Math.min(60, 5 * Math.pow(2, consecutiveErrors - 1))
    syncBackoffUntil = Date.now() + backoffMinutes * 60 * 1000
  } finally {
    isSyncing = false
  }
}

export async function runClassification(): Promise<number> {
  if (isClassifying) return 0
  const settings = getSettings()
  if (settings.ai_paused) return 0

  const batchSize = Math.max(1, settings.classification_batch_size)
  const unclassified = getUnclassifiedMessages(batchSize)
  if (unclassified.length === 0) return 0

  isClassifying = true
  let classified = 0
  try {
    for (const msg of unclassified) {
      try {
        await classifyAndPersist(msg)
        classified++
      } catch (err) {
        console.error(`Classification failed for ${msg.gmail_id}:`, err)
      }
    }
  } finally {
    isClassifying = false
  }
  return classified
}

export async function applySenderRuleRetroactive(
  matchType: import('../shared/types').MatchType,
  sender: string,
  importance: Message['importance'],
  category: Message['category']
): Promise<number> {
  const { applyRuleToSenderMessages, getMessages } = await import('./db')
  const changes = applyRuleToSenderMessages(matchType, sender, {
    importance: importance!,
    category: category!,
    action_required: importance === 'critical' || importance === 'high',
    confidence: 1,
    ai_reason: `Matched sender rule for ${sender}`
  })

  if (getSettings().gmail_label_sync_enabled) {
    const domain = sender.startsWith('@') ? sender.slice(1) : sender.split('@')[1] ?? sender
    const affected = getMessages({ limit: 1000 })
    for (const msg of affected) {
      const matches =
        matchType === 'exact'
          ? msg.from_address === sender.toLowerCase()
          : msg.from_address.endsWith(`@${domain.toLowerCase()}`)
      if (matches) {
        await syncMessageLabels(msg)
      }
    }
  }

  return changes
}
