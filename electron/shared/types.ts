export type Importance = 'critical' | 'high' | 'medium' | 'low'
export type Category = string

export type ClassificationSource = 'ai' | 'sender_rule' | 'manual'
export type MatchType = 'exact' | 'domain'

export interface Message {
  id: number
  gmail_id: string
  thread_id: string
  from_address: string
  from_name: string | null
  subject: string
  snippet: string
  body_text: string | null
  received_at: number
  label_ids: string
  importance: Importance | null
  category: Category | null
  action_required: number
  confidence: number | null
  ai_reason: string | null
  classified_at: number | null
  classification_source: ClassificationSource | null
  archived: number
  is_sent: number
}

export interface SenderRule {
  id: number
  sender: string
  match_type: MatchType
  importance: Importance
  category: Category
  skip_ai: number
  created_at: number
  updated_at: number
}

export interface SenderSummary {
  from_address: string
  from_name: string | null
  message_count: number
  latest_at: number
}

export interface ClassificationResult {
  importance: Importance
  category: Category
  action_required: boolean
  confidence: number
  reason: string
  tokens_used: number
}

export type AiProvider = 'openai' | 'gemini' | 'anthropic' | 'groq' | 'nvidia'

export interface Settings {
  ai_provider: AiProvider
  ai_api_keys: string
  ai_model: string
  sync_interval_minutes: number
  lookback_days: number
  follow_up_days: number
  classification_interval_minutes: number
  classification_batch_size: number
  gmail_label_sync_enabled: boolean
  sync_enabled: boolean
  ai_paused: boolean
  auto_archive_newsletters: boolean
  auto_archive_low_priority: boolean
  email_address: string
  app_password: string
  subscription_tier: 'free' | 'pro'
  license_key: string | null
  custom_categories: string
}

export interface SyncStatus {
  is_syncing: boolean
  is_classifying: boolean
  last_sync_at: number | null
  unclassified_count: number
  total_messages: number
  error: string | null
  backoff_until: number | null
}

export const DEFAULT_SETTINGS: Settings = {
  ai_provider: 'openai',
  ai_api_keys: '{}',
  ai_model: 'gpt-4o-mini',
  sync_interval_minutes: 5,
  lookback_days: 30,
  follow_up_days: 3,
  classification_interval_minutes: 5,
  classification_batch_size: 5,
  gmail_label_sync_enabled: false,
  sync_enabled: true,
  ai_paused: false,
  auto_archive_newsletters: false,
  auto_archive_low_priority: false,
  email_address: '',
  app_password: '',
  subscription_tier: 'free',
  license_key: null,
  custom_categories: '[]'
}

export const DEFAULT_CATEGORIES: Category[] = [
  'work',
  'personal',
  'newsletter',
  'promotional',
  'transactional',
  'finance',
  'social',
  'notifications',
  'spam_like',
  'low_priority'
]

export const IMPORTANCE_LEVELS: Importance[] = ['critical', 'high', 'medium', 'low']

export const DEFAULT_CATEGORY_LABELS: Record<string, string> = {
  work: 'Work',
  personal: 'Personal',
  newsletter: 'Newsletters',
  promotional: 'Promotional',
  transactional: 'Transactional',
  finance: 'Finance',
  social: 'Social',
  notifications: 'Notifications',
  spam_like: 'Spam-like',
  low_priority: 'Low Priority'
}

export const IMPORTANCE_LABELS: Record<Importance, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
}

export function getCategories(settings: Settings): string[] {
  let custom: string[] = []
  try {
    custom = JSON.parse(settings.custom_categories)
  } catch {}
  return [...DEFAULT_CATEGORIES, ...custom]
}

export function getCategoryLabels(settings: Settings): Record<string, string> {
  const labels: Record<string, string> = { ...DEFAULT_CATEGORY_LABELS }
  const custom = getCategories(settings).filter(c => !DEFAULT_CATEGORIES.includes(c))
  for (const c of custom) {
    labels[c] = c // Use the custom category name as its own label
  }
  return labels
}
