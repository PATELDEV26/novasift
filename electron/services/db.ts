import Database from 'better-sqlite3'
import { app, safeStorage } from 'electron'
import path from 'path'
import type {
  Category,
  ClassificationSource,
  Importance,
  MatchType,
  Message,
  SenderRule,
  SenderSummary,
  Settings
} from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'gmail-organizer.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    migrate(db)
  }
  return db
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gmail_id TEXT UNIQUE NOT NULL,
      thread_id TEXT NOT NULL,
      from_address TEXT NOT NULL,
      from_name TEXT,
      subject TEXT NOT NULL DEFAULT '',
      snippet TEXT NOT NULL DEFAULT '',
      body_text TEXT,
      received_at INTEGER NOT NULL,
      label_ids TEXT NOT NULL DEFAULT '[]',
      importance TEXT,
      category TEXT,
      action_required INTEGER NOT NULL DEFAULT 0,
      confidence REAL,
      ai_reason TEXT,
      classified_at INTEGER,
      classification_source TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      is_sent INTEGER NOT NULL DEFAULT 0
    );


    CREATE INDEX IF NOT EXISTS idx_messages_received ON messages(received_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_importance ON messages(importance);
    CREATE INDEX IF NOT EXISTS idx_messages_category ON messages(category);
    CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_address);
    CREATE INDEX IF NOT EXISTS idx_messages_unclassified ON messages(classified_at);

    CREATE TABLE IF NOT EXISTS sender_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      match_type TEXT NOT NULL DEFAULT 'exact',
      importance TEXT NOT NULL,
      category TEXT NOT NULL,
      skip_ai INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(sender, match_type)
    );

    CREATE TABLE IF NOT EXISTS gmail_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label_name TEXT UNIQUE NOT NULL,
      gmail_label_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      history_id TEXT,
      last_sync_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT OR IGNORE INTO sync_state (id, history_id, last_sync_at) VALUES (1, NULL, NULL);
  `)
  try {
    database.exec('ALTER TABLE messages ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;')
  } catch (err) {
  }
  try {
    database.exec('ALTER TABLE messages ADD COLUMN is_sent INTEGER NOT NULL DEFAULT 0;')
  } catch (err) {
  }
  
  database.exec(`
    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      tokens INTEGER NOT NULL DEFAULT 0
    );
  `)
}

export function getSettings(): Settings {
  const database = getDb()
  const rows = database.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings = { ...DEFAULT_SETTINGS }
  for (const row of rows) {
    const key = row.key as keyof Settings
    if (key in settings) {
      const raw = row.value
      if (typeof settings[key] === 'boolean') {
        ;(settings as Record<string, unknown>)[key] = raw === 'true'
      } else if (typeof settings[key] === 'number') {
        ;(settings as Record<string, unknown>)[key] = Number(raw)
      } else {
        ;(settings as Record<string, unknown>)[key] = raw
      }
    }
  }

  if (settings.app_password && app.isReady() && safeStorage.isEncryptionAvailable()) {
    try {
      settings.app_password = safeStorage.decryptString(Buffer.from(settings.app_password, 'base64'))
    } catch (err) {
      console.error('Failed to decrypt app_password', err)
      settings.app_password = ''
    }
  }

  let keysObj: Record<string, string> = {}
  try {
    keysObj = JSON.parse(settings.ai_api_keys)
  } catch {}

  // Migrate 'google' provider to 'gemini'
  if (settings.ai_provider === 'google' as any) {
    settings.ai_provider = 'gemini'
  }
  if (keysObj['google']) {
    keysObj['gemini'] = keysObj['google']
    delete keysObj['google']
    settings.ai_api_keys = JSON.stringify(keysObj)
  }

  const legacyKey = database.prepare('SELECT value FROM settings WHERE key = ?').get('openai_api_key') as
    | { value: string }
    | undefined
  const legacyModel = database.prepare('SELECT value FROM settings WHERE key = ?').get('openai_model') as
    | { value: string }
    | undefined
  const oldAiKey = database.prepare('SELECT value FROM settings WHERE key = ?').get('ai_api_key') as
    | { value: string }
    | undefined

  if (Object.keys(keysObj).length === 0) {
    if (oldAiKey?.value && settings.ai_provider) {
      keysObj[settings.ai_provider] = oldAiKey.value
    } else if (legacyKey?.value) {
      keysObj['openai'] = legacyKey.value
      if (!settings.ai_provider) settings.ai_provider = 'openai'
    }
    settings.ai_api_keys = JSON.stringify(keysObj)
  }

  if (!settings.ai_model && legacyModel?.value) {
    settings.ai_model = legacyModel.value
  }

  return settings
}

export function saveSettings(partial: Partial<Settings>): Settings {
  const database = getDb()
  
  const rawRows = database.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const rawCurrent: Record<string, string> = {}
  for (const row of rawRows) rawCurrent[row.key] = row.value

  const current = getSettings()
  const merged = { ...current, ...partial }
  
  const stmt = database.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  const tx = database.transaction(() => {
    for (const [key, value] of Object.entries(merged)) {
      let finalValue = String(value)
      if (key === 'app_password') {
        if (partial.app_password !== undefined) {
          if (partial.app_password && app.isReady() && safeStorage.isEncryptionAvailable()) {
            finalValue = safeStorage.encryptString(partial.app_password).toString('base64')
          } else {
            finalValue = partial.app_password
          }
        } else {
          finalValue = rawCurrent['app_password'] || ''
        }
      }
      stmt.run(key, finalValue)
    }
  })
  tx()
  return merged
}

export function upsertMessage(msg: Omit<Message, 'id'>): void {
  const database = getDb()
  database
    .prepare(
      `INSERT INTO messages (
        gmail_id, thread_id, from_address, from_name, subject, snippet, body_text,
        received_at, label_ids, archived, is_sent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(gmail_id) DO UPDATE SET
        subject = excluded.subject,
        snippet = excluded.snippet,
        body_text = COALESCE(excluded.body_text, body_text),
        label_ids = excluded.label_ids,
        is_sent = excluded.is_sent`
    )
    .run(
      msg.gmail_id,
      msg.thread_id,
      msg.from_address,
      msg.from_name,
      msg.subject,
      msg.snippet,
      msg.body_text,
      msg.received_at,
      msg.label_ids,
      msg.archived ? 1 : 0,
      msg.is_sent ? 1 : 0
    )
}

export function updateClassification(
  gmailId: string,
  data: {
    importance: Importance
    category: Category
    action_required: boolean
    confidence: number | null
    ai_reason: string | null
    classification_source: ClassificationSource
  }
): void {
  const database = getDb()
  database
    .prepare(
      `UPDATE messages SET
        importance = ?, category = ?, action_required = ?,
        confidence = ?, ai_reason = ?, classified_at = ?,
        classification_source = ?
      WHERE gmail_id = ?`
    )
    .run(
      data.importance,
      data.category,
      data.action_required ? 1 : 0,
      data.confidence,
      data.ai_reason,
      Date.now(),
      data.classification_source,
      gmailId
    )
}

export function getMessages(filters?: {
  importance?: Importance
  category?: Category
  unclassified_only?: boolean
  classified_only?: boolean
  from_address?: string
  limit?: number
  offset?: number
}): Message[] {
  const database = getDb()
  const conditions: string[] = ['is_sent = 0']
  const params: unknown[] = []

  if (filters?.importance) {
    conditions.push('importance = ?')
    params.push(filters.importance)
  }
  if (filters?.category) {
    conditions.push('category = ?')
    params.push(filters.category)
  }
  if (filters?.unclassified_only) {
    conditions.push('classified_at IS NULL')
  }
  if (filters?.classified_only) {
    conditions.push('classified_at IS NOT NULL')
    conditions.push('importance IS NOT NULL')
    conditions.push('category IS NOT NULL')
  }
  if (filters?.from_address) {
    conditions.push('from_address = ?')
    params.push(filters.from_address)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters?.limit ?? 200
  const offset = filters?.offset ?? 0

  return database
    .prepare(`SELECT * FROM messages ${where} ORDER BY received_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as Message[]
}

export function getFollowUpReminders(days?: number): Message[] {
  const database = getDb()
  const cutoffDays = days ?? getSettings().follow_up_days ?? 3
  const cutoff = Date.now() - cutoffDays * 24 * 60 * 60 * 1000
  
  // Find threads where the *latest* message was sent by the user, and it's older than cutoff
  // We exclude archived sent messages.
  const sql = `
    SELECT m.* 
    FROM messages m
    INNER JOIN (
      SELECT thread_id, MAX(received_at) as max_time
      FROM messages
      GROUP BY thread_id
    ) latest ON m.thread_id = latest.thread_id AND m.received_at = latest.max_time
    WHERE m.is_sent = 1 AND m.received_at < ? AND m.archived = 0
    ORDER BY m.received_at DESC
  `
  return database.prepare(sql).all(cutoff) as Message[]
}

export function getMessageByGmailId(gmailId: string): Message | undefined {
  const database = getDb()
  return database.prepare('SELECT * FROM messages WHERE gmail_id = ?').get(gmailId) as Message | undefined
}

export function getUnclassifiedMessages(limit = 50): Message[] {
  return getMessages({ unclassified_only: true, limit })
}

export function getClassifiedMessages(limit = 5000, offset = 0): Message[] {
  return getMessages({ classified_only: true, limit, offset })
}

export function recordTokenUsage(provider: string, model: string, tokens: number): void {
  if (tokens <= 0) return
  const database = getDb()
  const month = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  const existing = database.prepare('SELECT id, tokens FROM token_usage WHERE month = ? AND provider = ? AND model = ?').get(month, provider, model) as { id: number, tokens: number } | undefined
  if (existing) {
    database.prepare('UPDATE token_usage SET tokens = ? WHERE id = ?').run(existing.tokens + tokens, existing.id)
  } else {
    database.prepare('INSERT INTO token_usage (month, provider, model, tokens) VALUES (?, ?, ?, ?)').run(month, provider, model, tokens)
  }
}

export function getCurrentMonthTokenUsage(): { provider: string, model: string, tokens: number }[] {
  const database = getDb()
  const month = new Date().toISOString().slice(0, 7)
  return database.prepare('SELECT provider, model, tokens FROM token_usage WHERE month = ?').all(month) as { provider: string, model: string, tokens: number }[]
}

export function getClassifiedCount(): number {
  const database = getDb()
  const row = database
    .prepare(
      'SELECT COUNT(*) as count FROM messages WHERE classified_at IS NOT NULL AND importance IS NOT NULL AND category IS NOT NULL'
    )
    .get() as { count: number }
  return row.count
}

export function getUnclassifiedCount(): number {
  const database = getDb()
  const row = database.prepare('SELECT COUNT(*) as count FROM messages WHERE classified_at IS NULL').get() as {
    count: number
  }
  return row.count
}

export function getTotalMessageCount(): number {
  const database = getDb()
  const row = database.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number }
  return row.count
}

export function getSyncState(): { history_id: string | null; last_sync_at: number | null } {
  const database = getDb()
  const row = database.prepare('SELECT history_id, last_sync_at FROM sync_state WHERE id = 1').get() as {
    history_id: string | null
    last_sync_at: number | null
  }
  return row ?? { history_id: null, last_sync_at: null }
}

export function updateSyncState(historyId: string): void {
  const database = getDb()
  database
    .prepare('UPDATE sync_state SET history_id = ?, last_sync_at = ? WHERE id = 1')
    .run(historyId, Date.now())
}

export function getSenderRules(): SenderRule[] {
  const database = getDb()
  return database.prepare('SELECT * FROM sender_rules ORDER BY updated_at DESC').all() as SenderRule[]
}

export function upsertSenderRule(rule: {
  sender: string
  match_type: MatchType
  importance: Importance
  category: Category
  skip_ai: boolean
}): SenderRule {
  const database = getDb()
  const now = Date.now()
  database
    .prepare(
      `INSERT INTO sender_rules (sender, match_type, importance, category, skip_ai, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(sender, match_type) DO UPDATE SET
         importance = excluded.importance,
         category = excluded.category,
         skip_ai = excluded.skip_ai,
         updated_at = excluded.updated_at`
    )
    .run(rule.sender, rule.match_type, rule.importance, rule.category, rule.skip_ai ? 1 : 0, now, now)

  return database
    .prepare('SELECT * FROM sender_rules WHERE sender = ? AND match_type = ?')
    .get(rule.sender, rule.match_type) as SenderRule
}

export function deleteSenderRule(id: number): void {
  const database = getDb()
  database.prepare('DELETE FROM sender_rules WHERE id = ?').run(id)
}

export function getFrequentSenders(limit = 50): SenderSummary[] {
  const database = getDb()
  return database
    .prepare(
      `SELECT from_address, from_name, COUNT(*) as message_count, MAX(received_at) as latest_at
       FROM messages GROUP BY from_address ORDER BY message_count DESC LIMIT ?`
    )
    .all(limit) as SenderSummary[]
}

export function getSubscriptions(limit = 100): SenderSummary[] {
  const database = getDb()
  return database
    .prepare(
      `SELECT from_address, from_name, COUNT(*) as message_count, MAX(received_at) as latest_at
       FROM messages 
       WHERE category IN ('newsletter', 'promotional')
       GROUP BY from_address 
       ORDER BY message_count DESC 
       LIMIT ?`
    )
    .all(limit) as SenderSummary[]
}

export function archiveMessagesBySender(fromAddress: string): number {
  const database = getDb()
  const result = database
    .prepare('UPDATE messages SET archived = 1 WHERE from_address = ?')
    .run(fromAddress)
  return result.changes
}

export function archiveMessageLocally(gmailId: string): void {
  const database = getDb()
  database
    .prepare('UPDATE messages SET archived = 1 WHERE gmail_id = ?')
    .run(gmailId)
}

export function applyRuleToSenderMessages(
  matchType: MatchType,
  sender: string,
  data: {
    importance: Importance
    category: Category
    action_required: boolean
    confidence: number | null
    ai_reason: string | null
  }
): number {
  const database = getDb()
  const stmt = `UPDATE messages SET
    importance = ?, category = ?, action_required = ?,
    confidence = ?, ai_reason = ?, classified_at = ?,
    classification_source = 'sender_rule'
  WHERE `

  const params = [
    data.importance,
    data.category,
    data.action_required ? 1 : 0,
    data.confidence,
    data.ai_reason,
    Date.now()
  ]

  let result
  if (matchType === 'exact') {
    result = database.prepare(stmt + 'from_address = ?').run(...params, sender.toLowerCase())
  } else {
    const domain = sender.startsWith('@') ? sender.slice(1) : sender
    result = database.prepare(stmt + 'from_address LIKE ?').run(...params, `%@${domain.toLowerCase()}`)
  }
  return result.changes
}

export function saveGmailLabel(labelName: string, gmailLabelId: string): void {
  const database = getDb()
  database
    .prepare(
      `INSERT INTO gmail_labels (label_name, gmail_label_id, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(label_name) DO UPDATE SET gmail_label_id = excluded.gmail_label_id, updated_at = excluded.updated_at`
    )
    .run(labelName, gmailLabelId, Date.now())
}

export function getGmailLabelId(labelName: string): string | null {
  const database = getDb()
  const row = database.prepare('SELECT gmail_label_id FROM gmail_labels WHERE label_name = ?').get(labelName) as
    | { gmail_label_id: string }
    | undefined
  return row?.gmail_label_id ?? null
}

export function getAllGmailLabels(): { label_name: string; gmail_label_id: string }[] {
  const database = getDb()
  return database.prepare('SELECT label_name, gmail_label_id FROM gmail_labels').all() as {
    label_name: string
    gmail_label_id: string
  }[]
}
