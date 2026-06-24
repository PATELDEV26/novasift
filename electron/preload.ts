import { contextBridge, ipcRenderer } from 'electron'
import type {
  AiProvider,
  Category,
  Importance,
  MatchType,
  Message,
  SenderRule,
  SenderSummary,
  Settings,
  SyncStatus
} from './shared/types'

const api = {
  gmail: {
    connect: (): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('gmail:connect'),
    disconnect: (): Promise<void> => ipcRenderer.invoke('gmail:disconnect'),
    isConnected: (): Promise<boolean> => ipcRenderer.invoke('gmail:isConnected')
  },
  messages: {
    list: (filters?: {
      importance?: Importance
      category?: Category
      limit?: number
      offset?: number
    }): Promise<Message[]> => ipcRenderer.invoke('messages:list', filters),
    get: (gmailId: string): Promise<Message | null> => ipcRenderer.invoke('messages:get', gmailId),
    updateClassification: (
      gmailId: string,
      data: { importance: Importance; category: Category; action_required: boolean }
    ): Promise<void> => ipcRenderer.invoke('messages:updateClassification', gmailId, data),
    generateDraft: (gmailId: string): Promise<string> => ipcRenderer.invoke('messages:generateDraft', gmailId),
    summarize: (gmailId: string): Promise<string> => ipcRenderer.invoke('messages:summarize', gmailId),
    archive: (gmailId: string): Promise<void> => ipcRenderer.invoke('messages:archive', gmailId),
    createDraft: (threadId: string, replyText: string, toAddress: string, subject: string): Promise<void> => 
      ipcRenderer.invoke('messages:createDraft', threadId, replyText, toAddress, subject),
    testClassification: (): Promise<any> => ipcRenderer.invoke('messages:testClassification'),
    getFollowUps: (): Promise<Message[]> => ipcRenderer.invoke('messages:getFollowUps')
  },
  senders: {
    list: (): Promise<SenderSummary[]> => ipcRenderer.invoke('senders:list'),
    getRules: (): Promise<SenderRule[]> => ipcRenderer.invoke('senders:getRules'),
    upsertRule: (rule: {
      sender: string
      match_type: MatchType
      importance: Importance
      category: Category
      skip_ai: boolean
    }): Promise<SenderRule> => ipcRenderer.invoke('senders:upsertRule', rule),
    deleteRule: (id: number): Promise<void> => ipcRenderer.invoke('senders:deleteRule', id),
    getSubscriptions: (): Promise<SenderSummary[]> => ipcRenderer.invoke('senders:getSubscriptions'),
    archiveAll: (fromAddress: string): Promise<void> => ipcRenderer.invoke('senders:archiveAll', fromAddress)
  },
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
    save: (partial: Partial<Settings>): Promise<Settings> => ipcRenderer.invoke('settings:save', partial),
    verifyLicense: (key: string): Promise<boolean> => ipcRenderer.invoke('settings:verifyLicense', key)
  },
  license: {
    validate: (key: string): Promise<{ isValid: boolean; isOfflineGrace: boolean; reason?: string; plan?: string; expiresAt?: string }> => 
      ipcRenderer.invoke('license:validate', key),
    getState: (): Promise<{ isValid: boolean; isOfflineGrace: boolean; reason?: string; plan?: string; expiresAt?: string }> => 
      ipcRenderer.invoke('license:getState')
  },
  metrics: {
    getTokenUsage: (): Promise<{ provider: string, model: string, tokens: number }[]> => ipcRenderer.invoke('metrics:getTokenUsage')
  },
  ai: {
    listModels: (provider: AiProvider, apiKey?: string): Promise<string[]> =>
      ipcRenderer.invoke('ai:listModels', provider, apiKey)
  },
  sync: {
    status: (): Promise<SyncStatus> => ipcRenderer.invoke('sync:status'),
    now: (): Promise<void> => ipcRenderer.invoke('sync:now')
  },
  labels: {
    syncToGmail: (): Promise<{ synced: number; failed: number }> =>
      ipcRenderer.invoke('labels:syncToGmail')
  },
  onSyncStatusChanged: (callback: (status: SyncStatus) => void): (() => void) => {
    const handler = (_: unknown, status: SyncStatus): void => callback(status)
    ipcRenderer.on('sync:status-changed', handler)
    return () => ipcRenderer.removeListener('sync:status-changed', handler)
  },
  onConnectionChanged: (callback: (connected: boolean) => void): (() => void) => {
    const handler = (_: unknown, connected: boolean): void => callback(connected)
    ipcRenderer.on('gmail:connection-changed', handler)
    return () => ipcRenderer.removeListener('gmail:connection-changed', handler)
  },
  onMessageOpen: (callback: (gmailId: string) => void): (() => void) => {
    const handler = (_: unknown, gmailId: string): void => callback(gmailId)
    ipcRenderer.on('messages:open', handler)
    return () => ipcRenderer.removeListener('messages:open', handler)
  },
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:openExternal', url)
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
