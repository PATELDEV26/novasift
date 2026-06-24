import { useState } from 'react'
import { CheckCircle2, X, Sparkles, Zap, FolderOpen, MailOpen, ArrowRight, ShieldCheck } from 'lucide-react'

interface UpgradeProps {
  isPro: boolean
  email: string
  onSaveSuccess: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
  onNavigate: (page: string) => void
}

export function Upgrade({ isPro, email, onSaveSuccess, showToast, onNavigate }: UpgradeProps) {
  const [licenseKey, setLicenseKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [subscribeEmail, setSubscribeEmail] = useState(email || '')
  const [subscribeLoading, setSubscribeLoading] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const isAdmin = email === 'removed_admin@gmail.com'

  const handleSubscribe = async () => {
    if (!subscribeEmail.trim()) {
      showToast('Please enter an email address', 'error')
      return
    }
    setSubscribeLoading(true)
    try {
      const response = await fetch('http://localhost:3000/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subscribeEmail.trim() })
      })
      
      if (!response.ok) throw new Error('Failed to create subscription')
      
      const { subscription_id, key_id } = await response.json()
      
      const options = {
        key: key_id,
        subscription_id: subscription_id,
        name: 'NovaSift',
        description: 'Pro Monthly Subscription',
        image: 'https://thesidejob.tech/novasift-logo.png',
        prefill: { email: subscribeEmail.trim() },
        theme: { color: '#6366f1' },
        handler: function (response: any) {
          setPaymentSuccess(true)
        },
        modal: {
          ondismiss: function() {
            setSubscribeLoading(false)
          }
        }
      }
      
      const rzp = new (window as any).Razorpay(options)
      rzp.on('payment.failed', function (response: any) {
         showToast('Payment failed', 'error')
         setSubscribeLoading(false)
      })
      rzp.open()
    } catch (err) {
      console.error(err)
      showToast('Error: ' + (err instanceof Error ? err.message : String(err)), 'error')
      setSubscribeLoading(false)
    }
  }

  const handleResend = async () => {
    setResendLoading(true)
    try {
      await fetch('http://localhost:3000/api/resend-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subscribeEmail.trim() })
      })
      setResendSuccess(true)
      showToast('Email sent again!', 'success')
    } catch (e) {
      showToast('Failed to resend email', 'error')
    }
    setResendLoading(false)
  }

  const handleActivate = async () => {
    if (!licenseKey.trim()) return
    setLoading(true)
    const valid = await window.api.settings.verifyLicense(licenseKey.trim())
    setLoading(false)
    if (valid) {
      showToast('Welcome to NovaSift Pro! 👑', 'success')
      onSaveSuccess() // Triggers global state refresh
    } else {
      showToast('Invalid License Key', 'error')
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-surface relative">
      {/* Premium Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-white/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-8 py-16 relative z-10">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
            Take Total Control of Your Inbox.
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Upgrade to NovaSift Pro to unlock custom categories, zero-touch archiving, and unlimited AI smart drafts. Built for power users who value their time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Tier Card */}
          <div className="bg-surface-raised/50 backdrop-blur-md border border-surface-border rounded-2xl p-8 flex flex-col transition-all">
            <h3 className="text-xl font-semibold text-white mb-2">Free</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-white">₹0</span>
              <span className="text-gray-400">/forever</span>
            </div>
            
            <p className="text-sm text-gray-400 mb-8 h-10">
              Essential AI triage to help you manage your daily emails.
            </p>

            <button 
              disabled
              className="w-full py-3 px-4 bg-surface border border-surface-border rounded-lg text-sm font-semibold text-gray-500 cursor-not-allowed mb-8"
            >
              {isPro ? 'Included' : 'Your Current Plan'}
            </button>

            <div className="space-y-4 flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Included Features</p>
              <FeatureItem text="Standard AI Triage" included={true} />
              <FeatureItem text="Quick Inbox Actions" included={true} />
              <FeatureItem text="Bring-Your-Own-Key" included={true} />
              
              <div className="pt-4 space-y-4">
                <FeatureItem text="AI Thread Summarizer" included={false} />
                <FeatureItem text="Smart Newsletter Manager" included={false} />
                <FeatureItem text="Zero-Touch Auto-Archive" included={false} />
                <FeatureItem text="AI Smart Draft Generation" included={false} />
              </div>
            </div>
          </div>

          {/* Pro Tier Card */}
          <div className="bg-surface-raised border border-white/20 shadow-glass-sm rounded-2xl p-8 flex flex-col relative overflow-hidden group transition-all hover:border-white/40">
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="absolute top-0 right-0 bg-white text-black text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider shadow-sm">
              Most Popular
            </div>

            <div className="relative z-10">
              <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                NovaSift Pro <Sparkles size={18} className="text-white" />
              </h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-white">₹249</span>
                <span className="text-gray-400">/mo</span>
                <span className="text-xs text-gray-500 ml-2">(or Lifetime)</span>
              </div>

              <p className="text-sm text-gray-400 mb-8 h-10">
                The ultimate AI-powered workflow for professionals.
              </p>

              {isAdmin ? (
                <button disabled className="w-full py-3 px-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm font-bold text-emerald-400 mb-8 cursor-default flex items-center justify-center gap-2">
                  <ShieldCheck size={18} /> Lifetime Admin Access Active
                </button>
              ) : isPro ? (
                <button disabled className="w-full py-3 px-4 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-lg text-sm font-bold text-amber-400 mb-8 cursor-default flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> Pro License Active
                </button>
              ) : paymentSuccess ? (
                <div className="mb-8 p-6 bg-surface border border-surface-border rounded-xl text-center">
                  <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={24} />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">🎉 Payment Successful!</h4>
                  <p className="text-sm text-gray-400 mb-4">
                    We've sent your Pro license key to <strong className="text-white">{subscribeEmail}</strong>.<br/>
                    Check your inbox (and spam folder). Key arriving via email within 1-2 minutes.
                  </p>
                  
                  <div className="space-y-3">
                    <button
                      onClick={() => setPaymentSuccess(false)}
                      className="w-full py-2.5 px-4 bg-accent hover:bg-accent-muted text-white rounded-lg text-sm font-bold shadow-sm transition-all"
                    >
                      Enter License Key
                    </button>
                    <button
                      onClick={handleResend}
                      disabled={resendLoading || resendSuccess}
                      className="w-full py-2 px-4 bg-transparent border border-surface-border hover:bg-surface-hover text-gray-300 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {resendLoading ? 'Sending...' : resendSuccess ? 'Sent!' : "Didn't receive it? Resend Email"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-8 space-y-6">
                  {/* Subscribe Section */}
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="Your Email Address"
                        value={subscribeEmail}
                        onChange={(e) => setSubscribeEmail(e.target.value)}
                        className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-sm text-white focus:border-white focus:ring-1 focus:ring-white outline-none transition-all placeholder:text-gray-600"
                      />
                    </div>
                    <button
                      onClick={handleSubscribe}
                      disabled={subscribeLoading || !subscribeEmail.trim()}
                      className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 text-white"
                    >
                      {subscribeLoading ? 'Opening Checkout...' : 'Subscribe Now'} <ArrowRight size={16} />
                    </button>
                  </div>

                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-surface-border"></div>
                    <span className="flex-shrink-0 mx-4 text-xs text-gray-500">or</span>
                    <div className="flex-grow border-t border-surface-border"></div>
                  </div>

                  {/* Activate Section */}
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter Pro License Key"
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value)}
                        className="w-full bg-surface border border-surface-border rounded-lg px-4 py-3 text-sm text-white focus:border-white focus:ring-1 focus:ring-white outline-none transition-all placeholder:text-gray-600"
                      />
                    </div>
                    <button
                      onClick={handleActivate}
                      disabled={loading || !licenseKey.trim()}
                      className="w-full py-3 px-4 bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? 'Activating...' : 'Activate License'} <CheckCircle2 size={16} />
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4 flex-1">
                <p className="text-xs font-semibold text-white uppercase tracking-wider mb-4">Pro Features</p>
                <FeatureItem text="AI Thread Summarizer & TL;DR" included={true} icon={<Sparkles size={16} className="text-white" />} />
                <FeatureItem text="Smart Newsletter Manager" included={true} icon={<FolderOpen size={16} className="text-white" />} />
                <FeatureItem text="Zero-Touch Auto-Archive" included={true} icon={<Zap size={16} className="text-white" />} />
                <FeatureItem text="AI Smart Draft Generation" included={true} icon={<MailOpen size={16} className="text-white" />} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500 mb-4">Already have a license?</p>
          <button 
            onClick={() => onNavigate('settings')}
            className="text-sm text-gray-400 hover:text-white transition-colors underline underline-offset-4"
          >
            Manage Billing in Settings
          </button>
        </div>
      </div>
    </div>
  )
}

function FeatureItem({ text, included, icon }: { text: string; included: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3 ${included ? 'text-gray-200' : 'text-gray-600'}`}>
      {included ? (
        icon || <CheckCircle2 size={16} className="text-white" />
      ) : (
        <X size={16} className="text-gray-600" />
      )}
      <span className="text-sm font-medium">{text}</span>
    </div>
  )
}
