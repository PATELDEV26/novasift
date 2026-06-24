import type { Category, Importance, Message } from '../shared/types'
import { IMPORTANCE_LABELS, getCategoryLabels, getCategories } from '../shared/types'
import { getGmailLabelId, getSettings, saveGmailLabel } from './db'
import { applyLabelToMessage, createOrGetLabel } from './mail-client'

const LABEL_PREFIX = 'AI'

export function getLabelNameForCategory(category: Category): string {
  const labels = getCategoryLabels(getSettings())
  return `${LABEL_PREFIX}/${labels[category] || category}`
}

export function getLabelNameForImportance(importance: Importance): string {
  return `${LABEL_PREFIX}/Importance/${IMPORTANCE_LABELS[importance]}`
}

export async function ensureLabelsExist(): Promise<void> {
  const categories = getCategories(getSettings())
  for (const cat of categories) {
    const name = getLabelNameForCategory(cat)
    const id = await createOrGetLabel(name)
    saveGmailLabel(name, id)
  }

  const levels: Importance[] = ['critical', 'high', 'medium', 'low']
  for (const level of levels) {
    const name = getLabelNameForImportance(level)
    const id = await createOrGetLabel(name)
    saveGmailLabel(name, id)
  }
}

export async function syncMessageLabels(message: Message): Promise<void> {
  const settings = getSettings()
  if (!settings.gmail_label_sync_enabled) return
  if (!message.importance || !message.category) return

  await ensureLabelsExist()

  const categoryLabelName = getLabelNameForCategory(message.category)
  const importanceLabelName = getLabelNameForImportance(message.importance)

  const categoryLabelId = getGmailLabelId(categoryLabelName)
  const importanceLabelId = getGmailLabelId(importanceLabelName)

  if (categoryLabelId) {
    await applyLabelToMessage(message.gmail_id, categoryLabelId)
  }
  if (importanceLabelId) {
    await applyLabelToMessage(message.gmail_id, importanceLabelId)
  }

  if (message.action_required) {
    const actionName = `${LABEL_PREFIX}/Action Required`
    let actionId = getGmailLabelId(actionName)
    if (!actionId) {
      actionId = await createOrGetLabel(actionName)
      saveGmailLabel(actionName, actionId)
    }
    await applyLabelToMessage(message.gmail_id, actionId)
  }
}

export async function syncAllLabelsToGmail(
  onProgress?: (done: number, total: number) => void
): Promise<{ synced: number; failed: number }> {
  const { getClassifiedMessages, getClassifiedCount } = await import('./db')
  const total = getClassifiedCount()
  if (total === 0) return { synced: 0, failed: 0 }

  await ensureLabelsExist()

  let synced = 0
  let failed = 0
  const batchSize = 100
  let offset = 0

  while (offset < total) {
    const batch = getClassifiedMessages(batchSize, offset)
    if (batch.length === 0) break

    for (const message of batch) {
      try {
        await syncMessageLabels(message)
        synced++
      } catch (err) {
        failed++
        console.error(`Label sync failed for ${message.gmail_id}:`, err)
      }
      onProgress?.(synced + failed, total)
    }
    offset += batchSize
  }

  return { synced, failed }
}
