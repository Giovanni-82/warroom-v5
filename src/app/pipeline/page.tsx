'use client'
import { useEffect, useState } from 'react'
import type { PipelineItem, Verdict } from '@/types'

const COLUMNS: { key: PipelineItem['status']; label: string; color: string }[] = [
  { key: 'SCOVATO', label: '🔭 Scovati', color: 'border-blue-700' },
  { key: 'AGGANCIATO', label: '🎣 Agganciati', color: 'border-yellow-700' },
  { key: 'CECCHINATO_FATTO', label: '✅ Cecchinati Fatti', color: 'border-green-700' },
  { key: 'CECCHINATO_NON_FATTO', label: '👁️ Non Fatti', color: 'border-gray-700' },
]

const VERDICT_STYLE: Record<Verdict, string> = {
  GO: 'bg-green-900 text-green-300 border border-green-700',
  WATCH: 'bg-yellow-900 text-yellow-300 border border-yellow-700',
  NO: 'bg-red-900 text-red-300 border border-red-700',
}
const VERDICT_ICON: Record<Verdict, string> = { GO: '🟢', WATCH: '🟡', NO: '🔴' }

export default function PipelinePage() {
  const [items, setItems] = useState<PipelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PipelineItem | null>(null)
  const [addingSymbol, setAddingSymbol] = useState('')
  const [analyzing, setAnalyzing] = useState<number | null>(null)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/ticker?date=${today}`)
    const d = await r.json()
    setItems(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  async function moveStatus(id: number, status: PipelineItem['status']) {
    await fetch('/api/ticker', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
  }

  async function addTicker() {
    if (!addingSymbol.trim()) return
    const r = await fetch('/api/ticker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: addingSymbol.toUpperCase().trim(), status: 'SCOVATO', session_date: today })
    })
    const d = await r.json()
    setItems(prev => [d, ...prev])
    setAddingSymbol('')
  }

  async function getAIVerdict(item: PipelineItem) {
    setAnalyzing(item.id)
    const r = await fetch('/api/analysis/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `Verdetto Cecchini v2.4 per ${item.symbol}:
Prezzo: $${item.price_at_scan || 'n/d'}
Gap: ${item.catalyst_desc || 'n/d'}
RVOL: ${item.rvol || 'n/d'}x
Float: ${item.float_shares ? (item.float_shares / 1e6).toFixed(1) + 'M' : 'n/d'}
Cap: ${item.market_cap ? '$' + (item.market_cap / 1e6).toFixed(0) + 'M' : 'n/d'}
Catalyst: ${item.catalyst_desc || 'nessuno'}
Finestra ingresso: ${item.entry_window || 'n/d'}
Dai verdetto operativo con BSL, stop, target.`
      })
    })
    const d = await r.json()
    const text = d.text || ''
    const verdict: Verdict = text.includes('🟢') ? 'GO' : text.includes('🟡') ? 'WATCH' : 'NO'
    await fetch('/api/ticker', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, ai_verdict: verdict, ai_rationale: text })
    })
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ai_verdict: verdict, ai_rationale: text } : i))
    setAnalyzing(null)
  }

  async function removeItem(id: number) {
    await fetch('/api/ticker', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">🎯 Pipeline Candidati — {today}</h1>
        <div className="flex gap-2">
          <input
            value={addingSymbol}
            onChange={e => setAddingSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addTicker()}
            placeholder="Aggiungi ticker..."
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm w-32 focus:outline-none focus:border-yellow-500"
          />
          <button onClick={addTicker} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition">
            + Aggiungi
          </button>
          <button onClick={load} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition">
            ↻ Aggiorna
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">Caricamento...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colItems = items.filter(i => i.status === col.key)
            return (
              <div key={col.key} className={`bg-gray-900 border ${col.color} rounded-2xl p-4 min-h-[400px]`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-white text-sm">{col.label}</h2>
                  <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-full">{colItems.length}</span>
                </div>
                <div className="space-y-3">
                  {colItems.map(item => (
                    <div key={item.id}
                      className="bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-xl p-3 cursor-pointer transition-all"
                      onClick={() => setSelected(item)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white">{item.symbol}</span>
                        {item.ai_verdict && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${VERDICT_STYLE[item.ai_verdict as Verdict]}`}>
                            {VERDICT_ICON[item.ai_verdict as Verdict]} {item.ai_verdict}
                          </span>
                        )}
                      </div>
                      {item.price_at_scan && (
                        <div className="text-gray-400 text-xs">${item.price_at_scan}</div>
                      )}
                      {item.rvol && (
                        <div className="text-blue-400 text-xs">RVOL {item.rvol}x</div>
                      )}
                      {item.catalyst_desc && (
                        <div className="text-yellow-400 text-xs truncate mt-1">{item.catalyst_desc}</div>
                      )}
                      {item.formula_score != null && (
                        <div className="mt-2 h-1 bg-gray-700 rounded-full">
                          <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${item.formula_score}%` }} />
                        </div>
                      )}
                      {/* Azioni rapide */}
                      <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
                        {col.key === 'SCOVATO' && (
                          <button onClick={() => moveStatus(item.id, 'AGGANCIATO')} className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded hover:bg-yellow-800 transition">
                            → Aggancia
                          </button>
                        )}
                        {col.key === 'AGGANCIATO' && (
                          <>
                            <button onClick={() => moveStatus(item.id, 'CECCHINATO_FATTO')} className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded hover:bg-green-800 transition">
                              ✅ Fatto
                            </button>
                            <button onClick={() => moveStatus(item.id, 'CECCHINATO_NON_FATTO')} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded hover:bg-gray-600 transition">
                              👁️ Pass
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => getAIVerdict(item)}
                          disabled={analyzing === item.id}
                          className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded hover:bg-blue-800 transition disabled:opacity-50"
                        >
                          {analyzing === item.id ? '...' : '🤖 AI'}
                        </button>
                        <button onClick={() => removeItem(item.id)} className="text-xs bg-red-950 text-red-400 px-2 py-0.5 rounded hover:bg-red-900 transition ml-auto">
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                  {colItems.length === 0 && (
                    <div className="text-center text-gray-600 text-sm py-8 italic">
                      {col.key === 'SCOVATO' ? 'Nessun candidato ancora' : 'Vuoto'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal dettaglio */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">{selected.symbol}</h2>
                <p className="text-gray-400 text-sm">{selected.name}</p>
              </div>
              {selected.ai_verdict && (
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${VERDICT_STYLE[selected.ai_verdict as Verdict]}`}>
                  {VERDICT_ICON[selected.ai_verdict as Verdict]} {selected.ai_verdict}
                </span>
              )}
            </div>
            <div className="space-y-3 text-sm">
              {[
                ['Prezzo', selected.price_at_scan ? `$${selected.price_at_scan}` : '—'],
                ['RVOL', selected.rvol ? `${selected.rvol}x` : '—'],
                ['Float', selected.float_shares ? `${(selected.float_shares / 1e6).toFixed(1)}M` : '—'],
                ['Cap', selected.market_cap ? `$${(selected.market_cap / 1e6).toFixed(0)}M` : '—'],
                ['Catalyst', selected.catalyst_desc || '—'],
                ['Finestra', selected.entry_window || '—'],
                ['BSL', selected.bsl_price ? `$${selected.bsl_price}` : '—'],
                ['Stop', selected.stop_price ? `$${selected.stop_price}` : '—'],
                ['Target', selected.target_price ? `$${selected.target_price} (+${selected.target_pct}%)` : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-3">
                  <span className="text-gray-400 min-w-[70px]">{k}</span>
                  <span className="text-white">{v}</span>
                </div>
              ))}
              {selected.ai_rationale && (
                <div>
                  <div className="text-gray-400 mb-1">Analisi AI</div>
                  <div className="bg-gray-800 rounded-lg p-3 text-gray-200 text-xs leading-relaxed whitespace-pre-wrap">
                    {selected.ai_rationale}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <a href={`https://www.tradingview.com/chart/?symbol=${selected.symbol}`} target="_blank" className="flex-1 text-center bg-blue-900 text-blue-300 py-2 rounded-lg text-sm hover:bg-blue-800 transition">
                📈 TradingView
              </a>
              <button onClick={() => setSelected(null)} className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition">
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
