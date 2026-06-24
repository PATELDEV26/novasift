import { useCallback, useEffect, useState } from 'react'
import type { Category, Importance, Message } from '../../electron/shared/types'

export function useMessages(filters?: { importance?: Importance; category?: Category }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await window.api.messages.list({ ...filters, limit: 300 })
    setMessages(data)
    setLoading(false)
  }, [filters?.importance, filters?.category])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { messages, loading, refresh }
}
