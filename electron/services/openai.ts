import OpenAI from 'openai'

function isChatModel(id: string): boolean {
  return /^(gpt-|o\d|chatgpt-)/i.test(id)
}

export async function listOpenAiModels(apiKey: string): Promise<string[]> {
  if (!apiKey.trim()) {
    throw new Error('Enter your OpenAI API key first')
  }

  const client = new OpenAI({ apiKey: apiKey.trim() })
  const response = await client.models.list()

  return response.data
    .map((m) => m.id)
    .filter(isChatModel)
    .sort((a, b) => a.localeCompare(b))
}
