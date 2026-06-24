import { Terminal } from 'lucide-react'

export function SystemLogs() {
  const logs = [
    "[INFO] Connecting to Gmail API...",
    "[SUCCESS] OAuth token verified. Connection established.",
    "[INFO] Polling for new messages (Lookback: 30 days)",
    "[INFO] Found 14 unclassified messages.",
    "[INFO] Starting AI classification batch (Provider: OpenAI, Model: gpt-4o-mini)",
    "[SUCCESS] Processed batch of 5 messages.",
    "[SUCCESS] Processed batch of 5 messages.",
    "[SUCCESS] Processed batch of 4 messages.",
    "[INFO] Label sync enabled. Mirroring classifications to Gmail.",
    "[SUCCESS] Applied labels to 14 messages."
  ]

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-surface">
      <div className="max-w-4xl mx-auto h-full flex flex-col">
        <h2 className="text-2xl font-semibold text-white mb-6 tracking-tight flex items-center gap-3">
          <Terminal className="text-accent" />
          System Logs
        </h2>
        
        <div className="flex-1 bg-black/50 border border-surface-border rounded-xl p-6 font-mono text-sm overflow-y-auto shadow-glass-sm relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-indigo-500 opacity-50"></div>
          {logs.map((log, idx) => (
            <div key={idx} className={`mb-2 ${log.includes('[SUCCESS]') ? 'text-emerald-400' : log.includes('[ERROR]') ? 'text-critical' : 'text-gray-400'}`}>
              <span className="text-gray-600 mr-3">{new Date().toISOString().split('T')[1].split('.')[0]}</span>
              {log}
            </div>
          ))}
          <div className="mt-4 flex items-center gap-2 text-gray-500 animate-pulse">
            <span className="w-2 h-4 bg-gray-500 block"></span> Listening for events...
          </div>
        </div>
      </div>
    </div>
  )
}
