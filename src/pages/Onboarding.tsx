import { useState } from 'react'
import logoUrl from '../assets/logo.png'

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
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#09090b]">
      {/* Animated Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[10%] w-[70%] h-[70%] rounded-full bg-indigo-500/20 blur-[120px] mix-blend-screen animate-pulse-slow"></div>
        <div className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-fuchsia-500/20 blur-[120px] mix-blend-screen animate-float"></div>
        <div className="absolute -bottom-[40%] left-[20%] w-[80%] h-[80%] rounded-full bg-blue-500/10 blur-[120px] mix-blend-screen animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-lg w-full px-6 animate-fade-in">
        <div className="text-center mb-10 animate-slide-up">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl shadow-[0_0_40px_rgba(99,102,241,0.2)]">
            <img src={logoUrl} alt="NovaSift Logo" className="w-full h-full object-cover rounded-3xl" />
          </div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-4 tracking-tight">
            NovaSift
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
            Experience the future of email triage. Securely connect your Gmail account and let AI organize your inbox locally.
          </p>
        </div>

        <div className="bg-surface-raised/40 backdrop-blur-2xl border border-surface-border/50 shadow-glass rounded-3xl p-8 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">Google Account</label>
              <input
                type="email"
                placeholder="name@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-surface-border/50 rounded-xl px-4 py-3.5 text-sm text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 focus:bg-indigo-500/5 outline-none transition-all placeholder:text-gray-600 shadow-inner"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider pl-1">App Password</label>
              <input
                type="password"
                placeholder="16-digit app password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-surface-border/50 rounded-xl px-4 py-3.5 text-sm text-white focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 focus:bg-indigo-500/5 outline-none transition-all placeholder:text-gray-600 shadow-inner"
                required
              />
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-start gap-3 shadow-lg">
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={connecting || !email || !password}
              className="w-full py-4 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 rounded-xl text-white font-bold shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] disabled:opacity-50 disabled:hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 active:translate-y-0 mt-2"
            >
              {connecting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Connecting...
                </span>
              ) : 'Connect Inbox'}
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <button
            type="button"
            onClick={() => window.api.openExternal('https://myaccount.google.com/signinoptions/two-step-verification')}
            className="flex items-center justify-between w-full px-5 py-3.5 bg-surface-raised/30 backdrop-blur-md border border-surface-border/50 hover:bg-surface-raised/60 hover:border-surface-border rounded-xl text-gray-300 transition-all font-medium group shadow-glass-sm"
          >
            <span className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold group-hover:bg-indigo-500 group-hover:text-white transition-colors">1</span>
              Turn on 2-Step Verification
            </span>
            <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
          <button
            type="button"
            onClick={() => window.api.openExternal('https://myaccount.google.com/apppasswords')}
            className="flex items-center justify-between w-full px-5 py-3.5 bg-surface-raised/30 backdrop-blur-md border border-surface-border/50 hover:bg-surface-raised/60 hover:border-surface-border rounded-xl text-gray-300 transition-all font-medium group shadow-glass-sm"
          >
            <span className="flex items-center gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold group-hover:bg-indigo-500 group-hover:text-white transition-colors">2</span>
              Generate App Password
            </span>
            <svg className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
