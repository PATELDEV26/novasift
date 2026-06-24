import { useState } from 'react'

interface OnboardingProps {
  onConnect: () => Promise<void>
  connecting: boolean
  error: string | null
}

export function Onboarding({ onConnect, connecting, error }: OnboardingProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    await window.api.settings.save({ email_address: email, app_password: password })
    onConnect()
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-accent/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">Welcome to NovaSift</h2>
        <p className="text-gray-400 mb-8 text-sm leading-relaxed">
          Connect your Gmail account via IMAP to securely sync and classify your emails entirely locally.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <div>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface-raised border border-surface-border rounded-lg px-4 py-3 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="App Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-raised border border-surface-border rounded-lg px-4 py-3 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-left">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={connecting || !email || !password}
            className="w-full py-3 px-6 bg-accent hover:bg-accent-muted rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect Mailbox'}
          </button>
        </form>

        <div className="text-left bg-surface-raised/50 border border-surface-border backdrop-blur-md shadow-glass-sm rounded-xl p-5 text-sm flex flex-col gap-4">
          <div>
            <p className="font-semibold text-gray-200 mb-1">What is an App Password?</p>
            <p className="text-gray-400 leading-relaxed">
              An App Password is a 16-digit passcode that gives a non-Google app permission to access your Google Account.
            </p>
          </div>
          
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-amber-200/90 font-medium leading-relaxed">⚠️ Important: Google requires 2-Step Verification to be turned ON before you can generate an App Password.</p>
          </div>

          <div className="flex flex-col gap-2 mt-1">
            <button
              type="button"
              onClick={() => window.api.openExternal('https://myaccount.google.com/signinoptions/two-step-verification')}
              className="flex items-center justify-between w-full px-4 py-2.5 bg-surface border border-surface-border hover:bg-surface-hover rounded-lg text-gray-300 transition-colors font-medium group"
            >
              <span>Step 1: Turn on 2-Step Verification</span>
              <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </button>
            <button
              type="button"
              onClick={() => window.api.openExternal('https://myaccount.google.com/apppasswords')}
              className="flex items-center justify-between w-full px-4 py-2.5 bg-surface border border-surface-border hover:bg-surface-hover rounded-lg text-gray-300 transition-colors font-medium group"
            >
              <span>Step 2: Generate App Password</span>
              <svg className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
