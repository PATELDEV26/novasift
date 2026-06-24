import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import type { Category, ClassificationResult, Importance } from '../shared/types'
import { IMPORTANCE_LEVELS } from '../shared/types'

export async function listGoogleModels(apiKey: string): Promise<string[]> {
  if (!apiKey.trim()) {
    throw new Error('Enter your Google API key first')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google API error: ${body}`)
  }

  const data = (await res.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[]
  }

  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .sort((a, b) => a.localeCompare(b))
}

export async function classifyWithGoogle(
  apiKey: string,
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
  categories: string[]
): Promise<ClassificationResult> {
  const genAI = new GoogleGenerativeAI(apiKey.trim())
  const model = genAI.getGenerativeModel({
    model: modelName.trim(),
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          importance: { type: SchemaType.STRING, format: 'enum', enum: [...IMPORTANCE_LEVELS] },
          category: { type: SchemaType.STRING, format: 'enum', enum: [...categories] },
          action_required: { type: SchemaType.BOOLEAN },
          confidence: { type: SchemaType.NUMBER },
          reason: { type: SchemaType.STRING }
        },
        required: ['importance', 'category', 'action_required', 'confidence', 'reason']
      }
    }
  })

  const result = await model.generateContent(userPrompt)
  const text = result.response.text()
  if (!text) throw new Error('Empty response from Google AI')

  const parsed = JSON.parse(text) as ClassificationResult
  return {
    importance: parsed.importance as Importance,
    category: parsed.category as Category,
    action_required: parsed.action_required,
    confidence: Math.min(1, Math.max(0, parsed.confidence)),
    reason: parsed.reason,
    tokens_used: result.response.usageMetadata?.totalTokenCount || 0
  }
}
