import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import type { Category, ClassificationResult, Importance, Message, AiProvider } from '../shared/types'
import { IMPORTANCE_LEVELS, getCategories } from '../shared/types'
import { getSettings } from './db'
import { classifyWithGoogle } from './google-ai'
import { findMatchingRule, ruleToClassification } from './sender-rules'

const CLASSIFICATION_SCHEMA = {
  type: 'object' as const,
  properties: {
    importance: { type: 'string', enum: IMPORTANCE_LEVELS },
    category: { type: 'string', enum: [] as string[] },
    action_required: { type: 'boolean' },
    confidence: { type: 'number' },
    reason: { type: 'string' }
  },
  required: ['importance', 'category', 'action_required', 'confidence', 'reason'],
  additionalProperties: false
}

export const buildSystemPrompt = (categories: string[]) => `You are an email classification assistant. Analyze emails and assign importance and category to help users manage cluttered inboxes. Be conservative with "critical" — reserve it for truly urgent items.

Categories: ${categories.join(', ')}
Importance: critical (urgent action), high (important), medium (normal), low (can wait)

Return JSON with importance, category, action_required, confidence (0-1), and a one-line reason.`

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

function buildPrompt(message: Message): string {
  const body = message.body_text ?? message.snippet
  return `Classify this email for inbox organization.

From: ${message.from_name ? `${message.from_name} <${message.from_address}>` : message.from_address}
Subject: ${message.subject}
Snippet: ${message.snippet}
Body: ${truncate(body, 3000)}`
}

async function classifyWithOpenAILike(
  provider: AiProvider,
  apiKey: string,
  model: string,
  systemPrompt: string,
  prompt: string,
  categories: string[],
  baseURL?: string
): Promise<ClassificationResult> {
  const client = new OpenAI({ apiKey, baseURL: baseURL || (provider === 'groq' ? 'https://api.groq.com/openai/v1' : provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' : undefined) })

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    response_format: provider === 'nvidia' ? { type: 'json_object' } : {
      type: 'json_schema',
      json_schema: {
        name: 'email_classification',
        strict: provider === 'openai',
        schema: {
          ...CLASSIFICATION_SCHEMA,
          properties: { ...CLASSIFICATION_SCHEMA.properties, category: { type: 'string', enum: categories } }
        }
      }
    }
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from ' + provider)

  const parsed = JSON.parse(content) as ClassificationResult
  const tokens_used = response.usage?.total_tokens || 0
  return normalizeResult(parsed, tokens_used)
}

async function classifyWithAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  prompt: string,
  categories: string[]
): Promise<ClassificationResult> {
  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    temperature: 0.2,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
    tools: [{
      name: 'classify_email',
      description: 'Classify the email based on the prompt.',
      input_schema: {
        ...CLASSIFICATION_SCHEMA,
        properties: { ...CLASSIFICATION_SCHEMA.properties, category: { type: 'string', enum: categories } }
      } as any
    }],
    tool_choice: { type: 'tool', name: 'classify_email' }
  })

  const toolUse = response.content.find(c => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') throw new Error('No tool use in Claude response')

  const tokens_used = (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0)
  return normalizeResult(toolUse.input as any, tokens_used)
}

function normalizeResult(parsed: ClassificationResult, tokens_used = 0): ClassificationResult {
  return {
    importance: parsed.importance as Importance,
    category: parsed.category as Category,
    action_required: !!parsed.action_required,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 1)),
    reason: parsed.reason || 'No reason provided',
    tokens_used
  }
}

function getProviderApiKey(settings: any, provider: AiProvider): string {
  try {
    const keys = JSON.parse(settings.ai_api_keys)
    return keys[provider] || ''
  } catch {
    return ''
  }
}

export async function classifyMessage(message: Message): Promise<ClassificationResult> {
  const rule = findMatchingRule(message)
  if (rule) {
    return { ...ruleToClassification(rule), tokens_used: 0 }
  }

  const settings = getSettings()
  const provider = settings.ai_provider
  const apiKey = getProviderApiKey(settings, provider).trim()
  
  if (!apiKey) {
    throw new Error(`API key for ${provider} not configured. Add it in Settings.`)
  }
  if (!settings.ai_model.trim()) {
    throw new Error(`Model for ${provider} not selected. Load models in Settings.`)
  }

  const categories = getCategories(settings)
  const prompt = buildPrompt(message)
  const model = settings.ai_model.trim()
  const systemPrompt = buildSystemPrompt(categories)

  if (provider === 'gemini') {
    return classifyWithGoogle(apiKey, model, systemPrompt, prompt, categories)
  } else if (provider === 'anthropic') {
    return classifyWithAnthropic(apiKey, model, systemPrompt, prompt, categories)
  } else {
    return classifyWithOpenAILike(provider, apiKey, model, systemPrompt, prompt, categories)
  }
}

export async function generateDraftReply(gmailId: string): Promise<string> {
  const { getMessageByGmailId } = await import('./db')
  const message = getMessageByGmailId(gmailId)
  if (!message) throw new Error('Message not found')

  const settings = getSettings()
  const provider = settings.ai_provider
  const apiKey = getProviderApiKey(settings, provider).trim()
  
  if (!apiKey) throw new Error(`API key for ${provider} not configured.`)

  const body = message.body_text ?? message.snippet
  const prompt = `Write a professional, concise 3-sentence reply to this email. Do not include subject lines or placeholders, just the raw email body.

From: ${message.from_name ?? message.from_address}
Subject: ${message.subject}
Body: ${truncate(body, 3000)}`

  const model = settings.ai_model.trim()

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model, max_tokens: 500, temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    })
    const block = response.content.find(c => c.type === 'text')
    return block && block.type === 'text' ? block.text.trim() : ''
  } else if (provider === 'gemini') {
    // Basic Google fetch for draft
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    })
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  } else {
    const baseURL = provider === 'groq' ? 'https://api.groq.com/openai/v1' : provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' : undefined
    const client = new OpenAI({ apiKey, baseURL })
    const response = await client.chat.completions.create({
      model, temperature: 0.7, messages: [{ role: 'user', content: prompt }]
    })
    return response.choices[0]?.message?.content?.trim() || ''
  }
}

export async function summarizeEmail(gmailId: string): Promise<string> {
  const { getMessageByGmailId } = await import('./db')
  const message = getMessageByGmailId(gmailId)
  if (!message) throw new Error('Message not found')

  const settings = getSettings()
  const provider = settings.ai_provider
  const apiKey = getProviderApiKey(settings, provider).trim()
  
  if (!apiKey) throw new Error(`API key for ${provider} not configured.`)

  const body = message.body_text ?? message.snippet
  const prompt = `Provide a concise, 3-bullet-point summary of the following email. Focus on the core message and any required actions. Do not use pleasantries, just output the bullets.

From: ${message.from_name ?? message.from_address}
Subject: ${message.subject}
Body: ${truncate(body, 3000)}`

  const model = settings.ai_model.trim()

  if (provider === 'anthropic') {
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model, max_tokens: 300, temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    })
    const block = response.content.find(c => c.type === 'text')
    return block && block.type === 'text' ? block.text.trim() : ''
  } else if (provider === 'gemini') {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    })
    const data = await res.json()
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  } else {
    const baseURL = provider === 'groq' ? 'https://api.groq.com/openai/v1' : provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' : undefined
    const client = new OpenAI({ apiKey, baseURL })
    const response = await client.chat.completions.create({
      model, temperature: 0.3, messages: [{ role: 'user', content: prompt }]
    })
    return response.choices[0]?.message?.content?.trim() || ''
  }
}

export async function classifyBatch(
  messages: Message[],
  concurrency = 5,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  let done = 0
  const queue = [...messages]

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const msg = queue.shift()
      if (!msg) break
      try {
        const { classifyAndPersist } = await import('./sync-pipeline')
        await classifyAndPersist(msg)
      } catch (err) {
        console.error(`Failed to classify ${msg.gmail_id}:`, err)
      }
      done++
      onProgress?.(done, messages.length)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, messages.length) }, () => worker())
  await Promise.all(workers)
}
