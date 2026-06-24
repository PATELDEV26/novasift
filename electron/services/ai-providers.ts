import type { AiProvider } from '../shared/types'
import { listGoogleModels } from './google-ai'
import { listOpenAiModels } from './openai'

export async function listAiModels(provider: AiProvider, apiKey: string): Promise<string[]> {
  if (provider === 'gemini') return listGoogleModels(apiKey)
  if (provider === 'openai') return listOpenAiModels(apiKey)
  if (provider === 'anthropic') return ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-5-haiku-20241022']
  if (provider === 'groq') return ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']
  if (provider === 'nvidia') return ['meta/llama-3.1-8b-instruct', 'mistralai/mistral-large-2-instruct']
  return []
}

export function defaultModelForProvider(provider: AiProvider, models: string[]): string {
  if (models.length === 0) return ''
  if (provider === 'gemini') {
    return (
      models.find((m) => m.includes('gemini-2.0-flash')) ??
      models.find((m) => m.includes('gemini-1.5-flash')) ??
      models[0]
    )
  }
  if (provider === 'anthropic') return 'claude-3-5-sonnet-20241022'
  if (provider === 'groq') return 'llama-3.1-8b-instant'
  if (provider === 'nvidia') return 'meta/llama-3.1-8b-instruct'
  return models.find((m) => m === 'gpt-4o-mini') ?? models.find((m) => m.includes('gpt-4o')) ?? models[0]
}
