import { getSettings, getSyncState, getTotalMessageCount, getUnclassifiedCount } from '../services/db'
import { getPipelineStatus, runClassification, runSync } from '../services/sync-pipeline'
import type { SyncStatus } from '../shared/types'

let syncIntervalId: ReturnType<typeof setInterval> | null = null
let classifyIntervalId: ReturnType<typeof setInterval> | null = null

export function getSyncStatus(): SyncStatus {
  const pipeline = getPipelineStatus()
  const syncState = getSyncState()
  return {
    is_syncing: pipeline.isSyncing,
    is_classifying: pipeline.isClassifying,
    last_sync_at: syncState.last_sync_at,
    unclassified_count: getUnclassifiedCount(),
    total_messages: getTotalMessageCount(),
    error: pipeline.lastError,
    backoff_until: pipeline.backoff_until
  }
}

function startClassificationWorker(): void {
  if (classifyIntervalId) {
    clearInterval(classifyIntervalId)
    classifyIntervalId = null
  }

  const classifyTick = async () => {
    const settings = getSettings()
    if (settings.ai_paused) return
    await runClassification()
  }

  classifyTick()
  const settings = getSettings()
  const intervalMs = settings.classification_interval_minutes * 60 * 1000
  classifyIntervalId = setInterval(classifyTick, intervalMs)
}

export function startSyncWorker(): void {
  stopSyncWorker()

  const syncTick = async () => {
    const settings = getSettings()
    if (!settings.sync_enabled) return
    await runSync()
  }

  syncTick()
  const settings = getSettings()
  const intervalMs = settings.sync_interval_minutes * 60 * 1000
  syncIntervalId = setInterval(syncTick, intervalMs)

  startClassificationWorker()
}

export function stopSyncWorker(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
  }
  if (classifyIntervalId) {
    clearInterval(classifyIntervalId)
    classifyIntervalId = null
  }
}

export async function triggerSyncNow(): Promise<void> {
  await runSync()
  await runClassification()
}

export async function triggerClassificationNow(): Promise<number> {
  return runClassification()
}
