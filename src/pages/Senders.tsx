import { useEffect, useState } from 'react'
import type { Category, Importance, MatchType, SenderRule, SenderSummary } from '../../electron/shared/types'
import { IMPORTANCE_LABELS, IMPORTANCE_LEVELS, getCategories, getCategoryLabels, DEFAULT_CATEGORIES, DEFAULT_CATEGORY_LABELS } from '../../electron/shared/types'
import { Mail, Search, PlusCircle, Trash2, ShieldCheck } from 'lucide-react'

export function Senders() {
  const [senders, setSenders] = useState<SenderSummary[]>([])
  const [rules, setRules] = useState<SenderRule[]>([])
  const [selectedSender, setSelectedSender] = useState<SenderSummary | null>(null)
  const [matchType, setMatchType] = useState<MatchType>('exact')
  const [importance, setImportance] = useState<Importance>('medium')
  const [category, setCategory] = useState<Category>('low_priority')
  const [skipAi, setSkipAi] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES)
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(DEFAULT_CATEGORY_LABELS)

  const refresh = async () => {
    const [s, r, settings] = await Promise.all([window.api.senders.list(), window.api.senders.getRules(), window.api.settings.get()])
    setSenders(s)
    setRules(r)
    setCategories(getCategories(settings))
    setCategoryLabels(getCategoryLabels(settings))
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleSaveRule = async () => {
    if (!selectedSender) return
    setSaving(true)
    const sender =
      matchType === 'domain'
        ? `@${selectedSender.from_address.split('@')[1]}`
        : selectedSender.from_address

    await window.api.senders.upsertRule({
      sender,
      match_type: matchType,
      importance,
      category,
      skip_ai: skipAi
    })
    setSaving(false)
    refresh()
  }

  const handleDeleteRule = async (id: number) => {
    await window.api.senders.deleteRule(id)
    refresh()
  }

  return (
    <div className="flex-1 flex min-h-0 bg-surface">
      {/* Senders List Pane */}
      <div className="w-[320px] flex-shrink-0 border-r border-surface-border overflow-y-auto bg-surface-raised/30 backdrop-blur-sm">
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between sticky top-0 bg-surface/80 backdrop-blur-md z-10">
          <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
            <Mail size={16} className="text-gray-400" /> Frequent Senders
          </h2>
        </div>
        <div className="p-3">
          {senders.map((s) => (
            <button
              key={s.from_address}
              onClick={() => setSelectedSender(s)}
              className={`w-full text-left px-4 py-3 rounded-xl mb-1 transition-all ${
                selectedSender?.from_address === s.from_address 
                  ? 'bg-accent/10 border border-accent/20 shadow-sm' 
                  : 'hover:bg-surface-hover border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-border flex items-center justify-center text-gray-300 font-medium text-xs flex-shrink-0">
                  {(s.from_name ?? s.from_address).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${selectedSender?.from_address === s.from_address ? 'text-white' : 'text-gray-200'}`}>
                    {s.from_name ?? s.from_address.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">{s.from_address}</p>
                </div>
                <div className="flex-shrink-0 bg-surface rounded-full px-2 py-0.5 text-[10px] font-medium text-gray-400 border border-surface-border">
                  {s.message_count}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Rules Configuration Pane */}
      <div className="flex-1 overflow-y-auto p-8 relative">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <ShieldCheck className="text-accent" />
              Sender Rules
            </h2>
            <p className="text-sm text-gray-400 mt-2">Create deterministic overrides to bypass AI categorization for specific domains or email addresses.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create Rule Form */}
            <div>
              <h3 className="text-base font-semibold text-white mb-4">Configure Rule</h3>
              {selectedSender ? (
                <div className="bg-surface-raised border border-surface-border rounded-xl shadow-glass-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-surface-border bg-surface flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-semibold flex-shrink-0">
                      {(selectedSender.from_name ?? selectedSender.from_address).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">{selectedSender.from_name ?? selectedSender.from_address}</h4>
                      <p className="text-xs text-gray-500 truncate">{selectedSender.from_address}</p>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <div>
                      <label className="text-xs font-medium text-gray-400 block mb-1.5">Match Criteria</label>
                      <select
                        value={matchType}
                        onChange={(e) => setMatchType(e.target.value as MatchType)}
                        className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none appearance-none"
                      >
                        <option value="exact">Exact Email Address</option>
                        <option value="domain">Entire Domain (@{selectedSender.from_address.split('@')[1]})</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium text-gray-400 block mb-1.5">Force Importance</label>
                        <select
                          value={importance}
                          onChange={(e) => setImportance(e.target.value as Importance)}
                          className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none appearance-none"
                        >
                          {IMPORTANCE_LEVELS.map((l) => (
                            <option key={l} value={l}>{IMPORTANCE_LABELS[l]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-400 block mb-1.5">Force Category</label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value as Category)}
                          className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white focus:border-accent focus:ring-1 focus:ring-accent outline-none appearance-none"
                        >
                          {categories.map((c) => (
                            <option key={c} value={c}>{categoryLabels[c]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
                        <div className="relative flex items-center justify-center">
                          <input type="checkbox" checked={skipAi} onChange={(e) => setSkipAi(e.target.checked)} className="peer sr-only" />
                          <div className="w-5 h-5 border border-surface-border rounded bg-surface peer-checked:bg-accent peer-checked:border-accent transition-all"></div>
                          <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium group-hover:text-white transition-colors">Bypass AI Classification</span>
                          <span className="text-[10px] text-gray-500">Apply rule instantly without sending to AI.</span>
                        </div>
                      </label>
                    </div>

                    <div className="pt-4 mt-2 border-t border-surface-border">
                      <button
                        onClick={handleSaveRule}
                        disabled={saving}
                        className="w-full flex justify-center items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-200 text-black rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50 transition-colors"
                      >
                        <PlusCircle size={16} />
                        {saving ? 'Saving...' : 'Create Rule & Apply Retroactively'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 rounded-xl border border-dashed border-surface-border flex flex-col items-center justify-center text-gray-500">
                  <Search className="mb-3 opacity-30" size={32} />
                  <p className="text-sm">Select a sender from the left to create a rule.</p>
                </div>
              )}
            </div>

            {/* Active Rules List */}
            <div>
              <h3 className="text-base font-semibold text-white mb-4">Active Rules ({rules.length})</h3>
              
              <div className="space-y-3">
                {rules.length === 0 && (
                  <div className="p-8 text-center text-gray-500 bg-surface-raised rounded-xl border border-surface-border">
                    <p className="text-sm">No rules defined yet.</p>
                  </div>
                )}
                
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="group bg-surface-raised border border-surface-border rounded-xl p-4 flex items-center justify-between hover:border-accent/30 transition-colors shadow-glass-sm"
                  >
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white truncate">{rule.sender}</span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-surface-border bg-surface text-gray-400 capitalize">
                          {rule.match_type}
                        </span>
                        {rule.skip_ai && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                            Bypass AI
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{IMPORTANCE_LABELS[rule.importance]}</span>
                        <span>•</span>
                        <span>{categoryLabels[rule.category]}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-critical hover:bg-critical/10 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      title="Delete Rule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
