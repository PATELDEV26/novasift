import { useState } from 'react'
import { Sparkles, ShieldCheck, Key, ExternalLink, X, ArrowRight, CheckCircle2 } from 'lucide-react'

interface OnboardingWizardProps {
  missingProvider: string
  onSave: (apiKey: string) => Promise<void>
  onSkip: () => void
}

export function OnboardingWizard({ missingProvider, onSave, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState(1)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  const providerName = missingProvider.charAt(0).toUpperCase() + missingProvider.slice(1)
  
  const getProviderLink = () => {
    switch (missingProvider) {
      case 'openai': return 'https://platform.openai.com/api-keys'
      case 'gemini': return 'https://aistudio.google.com/app/apikey'
      case 'anthropic': return 'https://console.anthropic.com/settings/keys'
      case 'groq': return 'https://console.groq.com/keys'
      case 'nvidia': return 'https://build.nvidia.com/explore/discover'
      default: return '#'
    }
  }

  const handleSave = async () => {
    const key = apiKey.trim()
    if (!key) {
      setError('Please enter a valid API key.')
      return
    }

    if (missingProvider === 'gemini' && key.startsWith('sk-')) {
      setError('This looks like an OpenAI key format but you have Gemini selected. Please switch your provider in Settings.')
      return
    }
    if (missingProvider === 'openai' && key.startsWith('AIza')) {
      setError('This looks like a Google Gemini key format but you have OpenAI selected. Please switch your provider in Settings.')
      return
    }
    if (missingProvider === 'anthropic' && !key.startsWith('sk-ant-')) {
      setError('This does not look like an Anthropic key (should start with sk-ant-).')
      return
    }
    if (missingProvider === 'groq' && !key.startsWith('gsk_')) {
      setError('This does not look like a Groq key (should start with gsk_).')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(apiKey.trim())
      setStep(3) // Success step
    } catch (e: any) {
      setError(e.message || 'Failed to save API key.')
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    setTesting(true)
    try {
      const result = await window.api.messages.testClassification()
      setTestResult(result)
    } catch (e) {
      console.error(e)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg shadow-glass-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border bg-surface-raised/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-indigo-400" size={20} />
            <h2 className="text-lg font-bold text-white tracking-wide">Welcome to NovaSift</h2>
          </div>
          <button onClick={onSkip} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8">
          {step === 1 && (
            <div className="animate-in slide-in-from-right-4 fade-in">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20">
                <ShieldCheck size={32} className="text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Absolute Privacy. Zero Lock-in.</h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                NovaSift runs <strong>entirely locally</strong> on your machine. To magically sort your emails and generate smart drafts, we use your own personal AI API key (Bring Your Own Key). 
              </p>
              <div className="bg-surface-raised border border-surface-border rounded-lg p-4 mb-8">
                <p className="text-sm text-gray-300 font-medium">Why is this better?</p>
                <ul className="mt-2 space-y-2 text-sm text-gray-400">
                  <li className="flex items-center gap-2">✓ We never see, store, or sell your emails.</li>
                  <li className="flex items-center gap-2">✓ You only pay fractions of a cent directly to the AI provider.</li>
                </ul>
              </div>
              <button 
                onClick={() => setStep(2)}
                className="w-full py-3 bg-white text-black hover:bg-gray-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                Connect AI Engine <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in slide-in-from-right-4 fade-in">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
                <Key size={32} className="text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Add your {providerName} Key</h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                You currently have <strong>{providerName}</strong> selected as your AI engine. Get your secure API key directly from their official platform.
              </p>
              
              <a 
                href={getProviderLink()} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-between p-4 bg-surface-raised border border-surface-border rounded-xl hover:border-indigo-500/50 transition-colors group mb-6"
              >
                <div>
                  <p className="text-white font-medium group-hover:text-indigo-400 transition-colors">Get your {providerName} API Key</p>
                  <p className="text-xs text-gray-500 mt-1">Opens securely in your browser</p>
                </div>
                <ExternalLink size={18} className="text-gray-400 group-hover:text-indigo-400 transition-colors" />
              </a>

              <div className="space-y-2 mb-8">
                <label className="text-sm font-medium text-gray-300">Paste your API Key here:</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-surface border border-surface-border rounded-xl px-4 py-3 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all font-mono"
                />
                {error && <p className="text-xs text-critical font-medium mt-2">{error}</p>}
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-surface-raised hover:bg-surface-hover text-white rounded-xl font-semibold transition-colors border border-surface-border"
                >
                  Back
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving || !apiKey.trim()}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  {saving ? 'Verifying...' : 'Save & Continue'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in zoom-in-95 fade-in text-center py-8">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                <CheckCircle2 size={40} className="text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">You're All Set!</h3>
              <p className="text-gray-400 leading-relaxed mb-8">
                NovaSift is now analyzing and organizing your inbox securely in the background. Prepare to experience Inbox Zero.
              </p>

              {testResult ? (
                <div className="bg-surface-raised border border-surface-border rounded-xl p-4 mb-6 text-left animate-in slide-in-from-bottom-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Test Classification</p>
                  <p className="text-sm text-gray-200 mb-2 truncate"><strong>Subject:</strong> {testResult.subject || '(no subject)'}</p>
                  <div className="flex gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded border border-surface-border bg-surface text-gray-300 capitalize">{testResult.importance}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded border border-surface-border bg-surface text-gray-300 capitalize">{testResult.category}</span>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleTestEmail}
                  disabled={testing}
                  className="w-full py-3 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl font-bold transition-all mb-4 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {testing ? <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-400"></div> : <Sparkles size={18} />}
                  {testing ? 'Testing AI...' : 'Test AI with 1 Email'}
                </button>
              )}

              <button 
                onClick={onSkip}
                className="w-full py-3 bg-white text-black hover:bg-gray-200 rounded-xl font-bold transition-all"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
