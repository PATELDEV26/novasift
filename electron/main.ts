import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from 'electron'
import fs from 'fs'
import path from 'path'
import * as Sentry from '@sentry/electron/main'
import { autoUpdater } from 'electron-updater'

// Initialize Sentry crash reporter (Placeholder DSN)
Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://placeholder@sentry.io/1234567",
})
import {
  deleteSenderRule,
  getFrequentSenders,
  getMessageByGmailId,
  getMessages,
  getSenderRules,
  getSettings,
  getSubscriptions,
  archiveMessagesBySender,
  archiveMessageLocally,
  saveSettings,
  updateClassification,
  upsertSenderRule
} from './services/db'
import { connectGmail, disconnectGmail, isGmailConnected } from './services/mail-client'
import { applySenderRuleRetroactive } from './services/sync-pipeline'
import { getSyncStatus, startSyncWorker, stopSyncWorker, triggerSyncNow } from './workers/sync-worker'
import { evaluateSubscriptionStatus, verifyLicense } from './services/subscription'
import { performStartupIntegrityCheck, getIntegrityStatus } from './services/integrity'
import { validateLicense, getLicenseState, deactivateLicense } from './services/license'
import type { Category, Importance } from './shared/types'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function broadcastSyncStatus(): void {
  const status = getSyncStatus()
  mainWindow?.webContents.send('sync:status-changed', status)
}

function broadcastConnectionChange(): void {
  mainWindow?.webContents.send('gmail:connection-changed', isGmailConnected())
}

function createTray(): void {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('NovaSift')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
        } else {
          createWindow()
        }
      }
    },
    {
      label: 'Sync Now',
      click: async () => {
        await triggerSyncNow()
        broadcastSyncStatus()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => mainWindow?.show())
}

function registerIpc(): void {
  ipcMain.handle('gmail:connect', async () => {
    const result = await connectGmail()
    if (result.success) {
      if (isGmailConnected()) startSyncWorker()
      broadcastSyncStatus()
      broadcastConnectionChange()
    }
    return result
  })

  ipcMain.handle('gmail:disconnect', async () => {
    stopSyncWorker()
    const { saveSettings } = await import('./services/db')
    saveSettings({ email_address: '', app_password: '' })
    disconnectGmail()
    broadcastSyncStatus()
    broadcastConnectionChange()
  })

  ipcMain.handle('gmail:isConnected', () => isGmailConnected())

  ipcMain.handle('shell:openExternal', (_, url: string) => {
    require('electron').shell.openExternal(url)
  })

  ipcMain.handle('messages:list', (_, filters) => getMessages(filters))
  ipcMain.handle('messages:get', (_, gmailId) => getMessageByGmailId(gmailId) ?? null)

  ipcMain.handle(
    'messages:updateClassification',
    async (_, gmailId: string, data: { importance: Importance; category: Category; action_required: boolean }) => {
      updateClassification(gmailId, {
        ...data,
        confidence: 1,
        ai_reason: 'Manually updated by user',
        classification_source: 'manual'
      })
      const msg = getMessageByGmailId(gmailId)
      if (msg) {
        const { syncMessageLabels } = await import('./services/label-sync')
        await syncMessageLabels({ ...msg, ...data, action_required: data.action_required ? 1 : 0 })
      }
      broadcastSyncStatus()
    }
  )

  ipcMain.handle('messages:archive', async (_, gmailId: string) => {
    const { archiveMessage } = await import('./services/mail-client')
    await archiveMessage(gmailId)
    archiveMessageLocally(gmailId)
    broadcastSyncStatus()
  })

  ipcMain.handle('messages:testClassification', async () => {
    const messages = getMessages({ limit: 1 })
    if (messages.length === 0) throw new Error('No emails found to test.')
    const msg = messages[0]
    
    // Perform classification test
    const { classifyMessage } = await import('./services/classifier')
    const result = await classifyMessage(msg)
    return {
      subject: msg.subject,
      ...result
    }
  })

  ipcMain.handle('messages:getFollowUps', async () => {
    const { getFollowUpReminders } = await import('./services/db')
    return getFollowUpReminders()
  })

  ipcMain.handle('senders:list', () => getFrequentSenders())

  // --- Metrics ---
  ipcMain.handle('metrics:getTokenUsage', async () => {
    const { getCurrentMonthTokenUsage } = await import('./services/db')
    return getCurrentMonthTokenUsage()
  })

  ipcMain.handle('senders:getRules', () => getSenderRules())
  ipcMain.handle('senders:getSubscriptions', () => getSubscriptions())
  ipcMain.handle('senders:archiveAll', async (_, fromAddress: string) => {
    const msgs = getMessages({ from_address: fromAddress, limit: 1000 })
    const { archiveMessage } = await import('./services/mail-client')
    for (const msg of msgs) {
      if (!msg.archived) {
        await archiveMessage(msg.gmail_id)
      }
    }
    archiveMessagesBySender(fromAddress)
    broadcastSyncStatus()
  })

  ipcMain.handle('senders:upsertRule', async (_, rule) => {
    const saved = upsertSenderRule(rule)
    await applySenderRuleRetroactive(rule.match_type, rule.sender, saved.importance, saved.category)
    broadcastSyncStatus()
    return saved
  })

  ipcMain.handle('senders:deleteRule', (_, id: number) => {
    deleteSenderRule(id)
    broadcastSyncStatus()
  })

  ipcMain.handle('ai:listModels', async (_, provider: import('./shared/types').AiProvider, apiKey?: string) => {
    const { listAiModels } = await import('./services/ai-providers')
    const settings = getSettings()
    let key = apiKey?.trim()
    const prov = provider || settings.ai_provider
    if (!key) {
      try {
        const keys = JSON.parse(settings.ai_api_keys)
        key = keys[prov]
      } catch {}
    }
    return listAiModels(prov, key || '')
  })

  ipcMain.handle('messages:generateDraft', async (_, gmailId: string) => {
    const { generateDraftReply } = await import('./services/classifier')
    return await generateDraftReply(gmailId)
  })

  ipcMain.handle('messages:summarize', async (_, gmailId: string) => {
    const { summarizeEmail } = await import('./services/classifier')
    return await summarizeEmail(gmailId)
  })

  ipcMain.handle('messages:createDraft', async (_, threadId: string, replyText: string, toAddress: string, subject: string) => {
    const { createDraft } = await import('./services/mail-client')
    await createDraft(threadId, replyText, toAddress, subject)
  })

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', async (_, partial) => {
    const wasLabelSyncOff = !getSettings().gmail_label_sync_enabled
    const saved = saveSettings(partial)
    const workerSettingsChanged =
      partial.sync_interval_minutes !== undefined ||
      partial.classification_interval_minutes !== undefined ||
      partial.classification_batch_size !== undefined ||
      partial.ai_paused !== undefined ||
      partial.sync_enabled !== undefined
    if (workerSettingsChanged) {
      stopSyncWorker()
      if (isGmailConnected()) startSyncWorker()
    }
    if (partial.gmail_label_sync_enabled && wasLabelSyncOff && isGmailConnected()) {
      const { syncAllLabelsToGmail } = await import('./services/label-sync')
      syncAllLabelsToGmail().catch((err) => console.error('Background label sync failed:', err))
    }
    if ('email_address' in partial) {
      evaluateSubscriptionStatus(partial.email_address)
    }
    broadcastSyncStatus()
    return saved
  })

  ipcMain.handle('settings:verifyLicense', async (_, key: string) => {
    return verifyLicense(key)
  })

  ipcMain.handle('license:validate', async (_, key: string) => {
    return validateLicense(key)
  })

  ipcMain.handle('license:getState', async () => {
    if (!getIntegrityStatus()) {
      return { isValid: false, isOfflineGrace: false, reason: 'integrity_check_failed' };
    }
    return getLicenseState()
  })

  ipcMain.handle('labels:syncToGmail', async () => {
    const { syncAllLabelsToGmail } = await import('./services/label-sync')
    const result = await syncAllLabelsToGmail()
    broadcastSyncStatus()
    return result
  })

  ipcMain.handle('sync:status', () => getSyncStatus())
  ipcMain.handle('sync:now', async () => {
    await triggerSyncNow()
    broadcastSyncStatus()
  })
}

function loadEnvAiKey(): void {
  const settings = getSettings()
  let keysObj: any = {}
  try {
    keysObj = JSON.parse(settings.ai_api_keys)
  } catch {}
  if (Object.keys(keysObj).length > 0) return

  const envPath = path.join(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, 'utf-8')
  const googleMatch = content.match(/^GOOGLE_API_KEY=(.+)$/m)
  const openaiMatch = content.match(/^OPENAI_API_KEY=(.+)$/m)
  const anthropicMatch = content.match(/^ANTHROPIC_API_KEY=(.+)$/m)

  if (googleMatch?.[1]) {
    keysObj['gemini'] = googleMatch[1].trim()
    saveSettings({ ai_api_keys: JSON.stringify(keysObj), ai_provider: 'gemini' })
  } else if (openaiMatch?.[1]) {
    keysObj['openai'] = openaiMatch[1].trim()
    saveSettings({ ai_api_keys: JSON.stringify(keysObj), ai_provider: 'openai' })
  } else if (anthropicMatch?.[1]) {
    keysObj['anthropic'] = anthropicMatch[1].trim()
    saveSettings({ ai_api_keys: JSON.stringify(keysObj), ai_provider: 'anthropic' })
  }
}

app.whenReady().then(() => {
  // Check for updates
  autoUpdater.checkForUpdatesAndNotify().catch(console.error)

  performStartupIntegrityCheck()

  loadEnvAiKey()
  evaluateSubscriptionStatus()
  registerIpc()
  createWindow()
  createTray()

  if (isGmailConnected()) {
    startSyncWorker()
  }

  setInterval(broadcastSyncStatus, 3000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopSyncWorker()
})

// --- Network Security ---
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  // Example of Certificate Pinning for the validation API
  const VALIDATION_API_DOMAIN = 'your-backend-domain.com';
  // Replace with actual SHA-256 fingerprint of your backend's SSL certificate
  const EXPECTED_FINGERPRINT = 'sha256/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX=';
  
  if (url.includes(VALIDATION_API_DOMAIN)) {
    if (certificate.fingerprint256 === EXPECTED_FINGERPRINT) {
      event.preventDefault();
      callback(true);
      return;
    } else {
      console.error('Certificate pinning failed for', url);
      event.preventDefault();
      callback(false);
      return;
    }
  }
  callback(false);
});

app.whenReady().then(() => {
  const session = require('electron').session;
  // Enforce HTTPS
  session.defaultSession.webRequest.onBeforeRequest((details: any, callback: any) => {
    const isAppRequest = details.url.startsWith('http://localhost') || details.url.startsWith('devtools://');
    if (!isAppRequest && details.url.startsWith('http://')) {
      callback({ cancel: true });
      console.warn('Blocked insecure HTTP request:', details.url);
    } else {
      callback({ cancel: false });
    }
  });

  // Inject Content-Security-Policy for Razorpay
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    if (details.url.startsWith('http://localhost') || details.url.startsWith('file://')) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https:; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; " +
            "connect-src 'self' https://api.razorpay.com https://thesidejob.tech http://localhost:* ws://localhost:*; " +
            "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com;"
          ]
        }
      });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });
});
