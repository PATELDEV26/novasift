import { useEffect, useState } from 'react'
import type { AiProvider, Settings as AppSettings } from '../../electron/shared/types'
import { Save, AlertTriangle, Key, RotateCw, Database, PowerOff } from 'lucide-react'

export function Settings({ onSaveSuccess, showToast, isPro, email, onNavigate }: { onSaveSuccess?: () => void, showToast?: (msg: string, type?: 'success'|'error') => void, isPro?: boolean, email?: string, onNavigate?: (page: string) => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [originalKeys, setOriginalKeys] = useState('')
  const [saving, setSaving] = useState(false)
  const [labelSyncing, setLabelSyncing] = useState(false)
  const [labelSyncResult, setLabelSyncResult] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)
  const [tokenUsage, setTokenUsage] = useState<{ provider: string, model: string, tokens: number }[]>([])

  const loadModels = async (provider: AiProvider, apiKey: string, resetModel = false) => {
    if (!apiKey.trim()) {
      setModels([])
      setModelError(null)
      return
    }
    setLoadingModels(true)
    setModelError(null)
    try {
      const list = await window.api.ai.listModels(provider, apiKey)
      setModels(list)
      if (list.length > 0) {
        setSettings((prev) => {
          if (!prev) return prev
          if (!resetModel && prev.ai_model && list.includes(prev.ai_model)) return prev
          const pick =
            provider === 'gemini'
              ? (list.find((m) => m.includes('gemini-2.0-flash')) ?? list.find((m) => m.includes('gemini-1.5-flash')) ?? list[0])
              : (list.find((m) => m === 'gpt-4o-mini') ?? list[0])
          return { ...prev, ai_model: pick }
        })
      }
    } catch (err) {
      setModels([])
      setModelError(String(err))
    } finally {
      setLoadingModels(false)
    }
  }

  useEffect(() => {
    window.api.settings.get().then((s) => {
      setSettings(s)
      setOriginalKeys(s.ai_api_keys)
      let keysObj: any = {}
      try { keysObj = JSON.parse(s.ai_api_keys) } catch {}
      const currentKey = keysObj[s.ai_provider]
      if (currentKey) loadModels(s.ai_provider, currentKey)
    })
    window.api.metrics.getTokenUsage().then(setTokenUsage).catch(console.error)
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    await window.api.settings.save(settings)
    
    let newKeysObj: any = {}
    let oldKeysObj: any = {}
    try { newKeysObj = JSON.parse(settings.ai_api_keys) } catch {}
    try { oldKeysObj = JSON.parse(originalKeys) } catch {}
    
    const provider = settings.ai_provider
    const isNewKey = newKeysObj[provider] && newKeysObj[provider] !== oldKeysObj[provider]

    setSaving(false)
    if (isNewKey) {
      setOriginalKeys(settings.ai_api_keys)
      if (showToast) showToast('✨ API Key Verified. Launching automated triage sync now...', 'success')
      await window.api.sync.now()
    } else {
      if (onSaveSuccess) onSaveSuccess()
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Gmail? Your local cached mail will stay on this device.')) return
    setDisconnecting(true)
    try {
      await window.api.gmail.disconnect()
    } finally {
      setDisconnecting(false)
    }
  }

  if (!settings) return <div className="p-8 text-gray-500">Loading settings...</div>

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-surface">
      <div className="max-w-4xl mx-auto pb-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">Settings</h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-muted rounded-lg text-sm font-medium text-white shadow-glass-sm disabled:opacity-50 transition-colors"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="space-y-8">
          {/* Billing & Plan */}
          <section className="bg-surface-raised border border-surface-border rounded-xl overflow-hidden shadow-glass-sm relative group">
            {!isPro && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}
            <div className="px-6 py-4 border-b border-surface-border bg-surface flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl filter drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">👑</span>
                <h3 className="text-base font-semibold text-white tracking-wide">NovaSift Pro</h3>
              </div>
              {isPro && (
                <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)] flex items-center gap-1">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-200">Current Plan</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {email === 'removed_admin@gmail.com' ? 'Lifetime Admin Access' : isPro ? 'Pro Plan' : 'Free Plan'}
                  </p>
                </div>
                {!isPro && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter Pro License Key"
                      value={settings.license_key || ''}
                      onChange={(e) => setSettings({ ...settings, license_key: e.target.value })}
                      className="bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none w-64 transition-all"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!settings.license_key) return
                        try {
                          const result = await window.api.license.validate(settings.license_key)
                          if (result.isValid) {
                            if (showToast) {
                              if (result.isOfflineGrace) {
                                showToast('Running in offline mode. Connect to the internet within 7 days to keep Pro access.', 'success')
                              } else {
                                showToast('Pro License Activated!', 'success')
                              }
                            }
                            if (onSaveSuccess) onSaveSuccess()
                          } else {
                            let msg = 'Invalid License Key';
                            if (result.reason === 'invalid_key') msg = "This license key doesn't exist. Check for typos or contact support.";
                            else if (result.reason === 'revoked') msg = "This license has been deactivated. Please contact support@thesidejob.tech";
                            else if (result.reason === 'expired') msg = "Your Pro subscription has expired. Renew at thesidejob.tech/products/novasift";
                            else if (result.reason === 'max_devices_reached') msg = "This key is already active on 2 devices. Deactivate a device at thesidejob.tech/account";
                            else if (result.reason === 'integrity_check_failed') msg = "App integrity check failed. Pro features disabled.";
                            
                            if (showToast) showToast(msg, 'error')
                          }
                        } catch (err) {
                          if (showToast) showToast('Network error validating license', 'error')
                        }
                      }}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 rounded-lg text-sm font-medium text-white shadow-[0_0_15px_rgba(245,158,11,0.2)] transition-all"
                    >
                      Activate
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* AI Configuration */}
          <section className="bg-surface-raised border border-surface-border rounded-xl overflow-hidden shadow-glass-sm">
            <div className="px-6 py-4 border-b border-surface-border bg-surface flex items-center gap-3">
              <Key className="text-gray-400" size={20} />
              <h3 className="text-base font-semibold text-white">AI Configuration</h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Provider</label>
                  <select
                    value={settings.ai_provider}
                    onChange={(e) => {
                      const provider = e.target.value as AiProvider
                      setModels([])
                      setModelError(null)
                      setSettings({ ...settings, ai_provider: provider, ai_model: '' })
                      let currentKey = ''
                      try { currentKey = JSON.parse(settings.ai_api_keys)[provider] || '' } catch {}
                      if (currentKey) loadModels(provider, currentKey, true)
                    }}
                    className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all appearance-none"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="groq">Groq</option>
                    <option value="nvidia">NVIDIA NIM</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={(() => {
                        try { return JSON.parse(settings.ai_api_keys)[settings.ai_provider] || '' } catch { return '' }
                      })()}
                      onChange={(e) => {
                        let keysObj: any = {}
                        try { keysObj = JSON.parse(settings.ai_api_keys) } catch {}
                        keysObj[settings.ai_provider] = e.target.value
                        setSettings({ ...settings, ai_api_keys: JSON.stringify(keysObj) })
                      }}
                      placeholder="API Key..."
                      className="flex-1 bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        let keysObj: any = {}
                        try { keysObj = JSON.parse(settings.ai_api_keys) } catch {}
                        loadModels(settings.ai_provider, keysObj[settings.ai_provider] || '', true)
                      }}
                      disabled={loadingModels}
                      className="px-4 py-2 bg-surface border border-surface-border hover:bg-surface-hover rounded-lg text-sm font-medium text-gray-300 disabled:opacity-40 transition-colors"
                    >
                      {loadingModels ? 'Loading...' : 'Verify'}
                    </button>
                  </div>
                  {modelError && <p className="text-xs text-critical mt-2">{modelError}</p>}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-2">Language Model</label>
                {models.length > 0 ? (
                  <select
                    value={settings.ai_model}
                    onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
                    className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all appearance-none"
                  >
                    {!models.includes(settings.ai_model) && settings.ai_model && <option value={settings.ai_model}>{settings.ai_model} (saved)</option>}
                    {!settings.ai_model && <option value="">Select a model</option>}
                    {models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={settings.ai_model}
                    onChange={(e) => setSettings({ ...settings, ai_model: e.target.value })}
                    placeholder={settings.ai_provider === 'gemini' ? 'e.g. gemini-2.0-flash' : 'e.g. gpt-4o-mini'}
                    className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  />
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {models.length > 0 ? `${models.length} models available` : 'Click Verify after entering your key to load models.'}
                </p>
              </div>

              <div className="pt-4 border-t border-surface-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-200">Pause AI Classification</p>
                  <p className="text-xs text-gray-500 mt-0.5">Stop sending emails to the AI for analysis temporarily.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.ai_paused} onChange={(e) => setSettings({ ...settings, ai_paused: e.target.checked })} />
                  <div className="w-11 h-6 bg-surface border border-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:border-accent"></div>
                </label>
              </div>
            </div>
          </section>

          {/* Inbox Categories */}
          <section className="bg-surface-raised border border-surface-border rounded-xl overflow-hidden shadow-glass-sm">
            <div className="px-6 py-4 border-b border-surface-border bg-surface flex items-center gap-3">
              <Database className="text-gray-400" size={20} />
              <h3 className="text-base font-semibold text-white">Inbox Categories</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-200 mb-2">Custom Categories</p>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={isPro ? "Type and press Enter to add..." : "Add Custom Category..."}
                    className={`w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm text-white outline-none transition-all ${
                      !isPro ? 'opacity-50 cursor-not-allowed bg-surface-hover' : 'focus:border-accent focus:ring-1 focus:ring-accent'
                    }`}
                    onClick={(e) => {
                      if (!isPro) {
                        e.preventDefault()
                        if (onNavigate) onNavigate('upgrade')
                      }
                    }}
                    readOnly={!isPro}
                    onKeyDown={(e) => {
                      if (!isPro) return
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const val = e.currentTarget.value.trim().toLowerCase().replace(/\s+/g, '_')
                        if (val) {
                          let custom: string[] = []
                          try { custom = JSON.parse(settings.custom_categories) } catch {}
                          if (!custom.includes(val) && !['work', 'personal', 'newsletter', 'promotional', 'transactional', 'finance', 'social', 'notifications', 'spam_like', 'low_priority'].includes(val)) {
                            custom.push(val)
                            setSettings({ ...settings, custom_categories: JSON.stringify(custom) })
                          }
                          e.currentTarget.value = ''
                        }
                      }
                    }}
                  />
                  {!isPro && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] cursor-not-allowed pointer-events-none" title="Pro Feature">
                      👑
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-surface-border">
                {['work', 'personal', 'newsletter', 'promotional', 'transactional', 'finance', 'social', 'notifications', 'spam_like', 'low_priority'].map((c) => (
                  <span key={c} className="px-3 py-1.5 bg-surface border border-surface-border rounded-full text-xs text-gray-400 font-medium">
                    {c}
                  </span>
                ))}
                {(() => {
                  let custom: string[] = []
                  try { custom = JSON.parse(settings.custom_categories) } catch {}
                  return custom.map(c => (
                    <span key={c} className="px-3 py-1.5 bg-accent/10 border border-accent/20 text-accent rounded-full text-xs font-medium flex items-center gap-1 group">
                      {c}
                      <button 
                        type="button"
                        onClick={() => {
                          const newCustom = custom.filter(cat => cat !== c)
                          setSettings({ ...settings, custom_categories: JSON.stringify(newCustom) })
                        }}
                        className="hover:text-red-400 hover:bg-red-400/10 rounded-full w-4 h-4 flex items-center justify-center transition-colors ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))
                })()}
              </div>
            </div>
          </section>

          {/* Sync Behavior */}
          <section className="bg-surface-raised border border-surface-border rounded-xl overflow-hidden shadow-glass-sm">
            <div className="px-6 py-4 border-b border-surface-border bg-surface flex items-center gap-3">
              <RotateCw className="text-gray-400" size={20} />
              <h3 className="text-base font-semibold text-white">Sync Behavior</h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-200">Enable Background Sync</p>
                  <p className="text-xs text-gray-500 mt-0.5">Automatically poll Gmail for new messages.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={settings.sync_enabled} onChange={(e) => setSettings({ ...settings, sync_enabled: e.target.checked })} />
                  <div className="w-11 h-6 bg-surface border border-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:border-accent"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-surface-border">
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Sync Interval (minutes)</label>
                  <input
                    type="number" min={1} max={60}
                    value={settings.sync_interval_minutes}
                    onChange={(e) => setSettings({ ...settings, sync_interval_minutes: Number(e.target.value) })}
                    className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 block mb-2">Initial Lookback (days)</label>
                  <input
                    type="number" min={1} max={365}
                    value={settings.lookback_days}
                    onChange={(e) => setSettings({ ...settings, lookback_days: Number(e.target.value) })}
                    className="w-full bg-surface border border-surface-border rounded-lg px-4 py-2.5 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-surface-border">
                <h4 className="text-sm font-semibold text-white mb-4">Automation Rules</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-200">Auto-Archive Newsletters</p>
                      <p className="text-xs text-gray-500 mt-0.5">Skip the inbox for AI-classified newsletters.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={settings.auto_archive_newsletters} onChange={(e) => setSettings({ ...settings, auto_archive_newsletters: e.target.checked })} />
                      <div className="w-11 h-6 bg-surface border border-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:border-accent"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-200">Auto-Archive Low Priority</p>
                      <p className="text-xs text-gray-500 mt-0.5">Skip the inbox for low importance items.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={settings.auto_archive_low_priority} onChange={(e) => setSettings({ ...settings, auto_archive_low_priority: e.target.checked })} />
                      <div className="w-11 h-6 bg-surface border border-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:border-accent"></div>
                    </label>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-surface-border mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-200">Follow-up Threshold (Days)</label>
                      <p className="text-xs text-gray-500 mt-0.5">How many days until an unreplied sent email needs a follow-up.</p>
                    </div>
                    <input
                      type="number" min={1} max={30}
                      value={settings.follow_up_days ?? 3}
                      onChange={(e) => setSettings({ ...settings, follow_up_days: Number(e.target.value) })}
                      className="w-24 bg-surface border border-surface-border rounded-lg px-4 py-2 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all text-center"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Gmail Label Sync */}
          <section className="bg-surface-raised border border-surface-border rounded-xl overflow-hidden shadow-glass-sm">
            <div className="px-6 py-4 border-b border-surface-border bg-surface flex items-center gap-3">
              <Database className="text-gray-400" size={20} />
              <h3 className="text-base font-semibold text-white">Gmail Integration</h3>
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="pr-8">
                  <p className="text-sm font-medium text-gray-200">Mirror to Gmail Labels</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    When enabled, creates nested labels in Gmail (e.g., AI/Work, AI/Importance/High, AI/Action Required) and applies them to classified messages. Your emails will not be removed from your main Inbox.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer mt-1">
                  <input type="checkbox" className="sr-only peer" checked={settings.gmail_label_sync_enabled} onChange={(e) => setSettings({ ...settings, gmail_label_sync_enabled: e.target.checked })} />
                  <div className="w-11 h-6 bg-surface border border-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:border-accent"></div>
                </label>
              </div>

              <button
                type="button"
                disabled={labelSyncing || !settings.gmail_label_sync_enabled}
                onClick={async () => {
                  setLabelSyncing(true)
                  setLabelSyncResult(null)
                  try {
                    const result = await window.api.labels.syncToGmail()
                    setLabelSyncResult(`Applied labels to ${result.synced} messages` + (result.failed > 0 ? ` (${result.failed} failed)` : ''))
                  } catch (err) {
                    setLabelSyncResult(`Failed: ${String(err)}`)
                  }
                  setLabelSyncing(false)
                }}
                className="px-4 py-2 bg-surface border border-surface-border hover:bg-surface-hover rounded-lg text-sm font-medium text-gray-300 disabled:opacity-40 transition-colors"
              >
                {labelSyncing ? 'Applying labels...' : 'Force Sync Labels Now'}
              </button>
              {labelSyncResult && <p className="text-xs text-emerald-400 mt-3">{labelSyncResult}</p>}
            </div>
          </section>

          {/* Danger Zone */}
          <section className="bg-surface-raised border border-critical/20 rounded-xl overflow-hidden shadow-glass-sm relative">
            <div className="absolute top-0 left-0 w-1 h-full bg-critical"></div>
            <div className="px-6 py-4 border-b border-surface-border bg-surface flex items-center gap-3">
              <AlertTriangle className="text-critical" size={20} />
              <h3 className="text-base font-semibold text-critical">Danger Zone</h3>
            </div>
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Disconnect Mailbox</p>
                <p className="text-xs text-gray-500 mt-0.5">Forget the IMAP App Password and email address. Local database is retained.</p>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2 bg-critical/10 text-critical hover:bg-critical/20 border border-critical/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <PowerOff size={16} />
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
