import type { Category, Importance, Message, SenderRule } from '../shared/types'
import { getSenderRules } from './db'

export function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/)
  if (match) return match[1].toLowerCase().trim()
  return from.toLowerCase().trim()
}

export function extractDomain(email: string): string {
  const parts = email.split('@')
  return parts.length > 1 ? parts[1].toLowerCase() : email
}

export function findMatchingRule(message: Message, rules?: SenderRule[]): SenderRule | null {
  const allRules = rules ?? getSenderRules()
  const email = message.from_address.toLowerCase()
  const domain = extractDomain(email)

  for (const rule of allRules) {
    if (rule.match_type === 'exact' && rule.sender.toLowerCase() === email) {
      return rule
    }
    if (rule.match_type === 'domain') {
      const ruleDomain = rule.sender.startsWith('@') ? rule.sender.slice(1) : rule.sender
      if (domain === ruleDomain.toLowerCase()) {
        return rule
      }
    }
  }
  return null
}

export function ruleToClassification(rule: SenderRule): {
  importance: Importance
  category: Category
  action_required: boolean
  confidence: number
  reason: string
} {
  return {
    importance: rule.importance,
    category: rule.category,
    action_required: rule.importance === 'critical' || rule.importance === 'high',
    confidence: 1,
    reason: `Matched sender rule for ${rule.sender}`
  }
}
