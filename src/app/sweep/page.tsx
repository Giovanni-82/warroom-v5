'use client'
import { useEffect, useState } from 'react'
import type { SweepResult } from '@/types'

const HORIZON_COLOR: Record<string, string> = {
  INTRADAY: 'text-green-400',
  SWING1W: 'text-yellow-400',
  SWING2W: 'text-orange-400',
  SWING1M: 'text-red-400',
  SWING6M: 'text-purple-400',
  SWINGY: 'text-pink-400',
}
const CATALYST_ICON: Record<string, string> = {
  '8K': '📄', FDA: '💊', EARNINGS: '📊', MERGER: '🤝',
  VOLUME_SILENT: '🔇', CONF_CALL: '📞', OTHER: '📰'
}

export default function SweepPage() {
  const [results, setResults] = useState<SweepResult[]>([])
  const [loading, setLoading] = useState(false)
  const [sweeping, setSweeping] = useState(false)
  const [sweepStats, setSweepStats] = useState<any>(null)
  const [filter, setFilter] = useState<string>('ALL')
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => { loadResults() }, [])

  async function loadResults() {
    setLoading(true)
    const r = await fetch(`/api/sweep?date=${today}`)
    const d = await r.json()
    setResults(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  async function runSweep() {
    setSweeping(true)
    setSweepStats(null)
    const r = await fetch('/api/sweep', { method: 'POST' })
    const d = await r.json()
    setSweepStats(d)
    await loadResults()
    setSweeping(false)
  }

  async function addToPipeline(item: SweepResult) {
    await fetch('/api/ticker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: item.symbol,
        name: item.name,
        status: 'SCOVATO',
        catalyst_type: item.catalyst_type,
        catalyst_desc: item.catalyst_desc,
        formula_score: item.formula_score,
        recommended_horizon: item.recommended_horizon,
        signal_silent_vol: item.signal_silent_vol,
        session_date: today
      })
    })
    alert(`${item.symbol} aggiunto alla Pipeline!`)
  }

  const FILTERS = ['ALL', 'INTRADAY', 'SWING1W', 'SWING2W', 'FDA', '8K', 'MERGER', 'VOLUME_SILENT']
  const filtered = results.filter(r => {
    if (filter === 'ALL') return true
    if (['FDA', '8K', 'MERGER', 'VOLUME_SILENT', 'EARNINGS'].includes(filter)) return r.catalyst_type === filter
    return r.recommended_horizon === filter
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">🔍 Sweep Notturno — {today}</h1>
          <p className="text-gray-400 text-sm">6 canali obbligatori + volume silenzioso + biotech watchlist</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadResults} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition">
            ↻ Ricarica
          </button>
          <button
            onClick={runSweep}
            disabled={sweeping}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-6 py-2 rounded-lg text-sm transition"
          >
            {sweeping ? '⏳ Sweep in corso...' : '🚀 Avvia Sweep'}
          </button>
        </div>
      </div>

      {/* Stats sweep */}
      {sweepStats && (
        <div className="bg-gray-900 border border-green-800 rounded-xl p-4">
          <h3 className="text-green-400 font-bold mb-3 text-sm">✅ Sweep completato</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center text-xs">
            {[
              ['EDGAR 8-K', sweepStats.by_channel?.edgar_8k],
              ['Form RW', sweepStats.by_channel?.edgar_rw],
              ['FDA', sweepStats.by_channel?.fda],
              ['Earnings', sweepStats.by_channel?.earnings],
              ['News', sweepStats.by_channel?.news],
              ['Vol Silenzioso', sweepStats.by_channel?.silent_vol],
            ].map(([label, val]) => (
              <div key={label as string} className="bg-gray-800 rounded-lg p-2">
                <div className="text-white font-bold text-lg">{val ?? 0}</div>
                <div className="text-gray-400">{label}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-center text-gray-300 text-sm">
            Totale unique ticker: <strong className="text-yellow-400">{sweepStats.total}</strong>
          </div>
        </div>
      )}

      {/* Filtri */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === f ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            {f === 'ALL' ? `Tutti (${results.length})` : f}
          </button>
        ))}
      </div>

      {/* Risultati */}
      {loading ? (
        <div className="text-center text-gray-400 py-20">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🔭</div>
          <p className="text-gray-400">Nessun risultato. Avvia lo sweep per popolare la lista.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(item => (
            <div key={item.id} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-4 flex items-center gap-4 transition">
              <div className="text-2xl">{CATALYST_ICON[item.catalyst_type] || '📰'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-bold text-white text-lg">{item.symbol}</span>
                  {item.name && <span className="text-gray-400 text-sm truncate">{item.name}</span>}
                  {item.signal_silent_vol && (
                    <span className="bg-purple-900 text-purple-300 text-xs px-2 py-0.5 rounded-full border border-purple-700">🔇 VOL SILENZIOSO</span>
                  )}
                </div>
                <div className="text-yellow-300 text-sm">{item.catalyst_desc}</div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                  <span>📅 {item.catalyst_date}</span>
                  <span>🔗 {item.catalyst_source}</span>
                  <span className={`font-bold ${HORIZON_COLOR[item.recommended_horizon] || 'text-gray-300'}`}>
                    {item.recommended_horizon}
                  </span>
                </div>
              </div>
              {/* Formula score */}
              <div className="text-center min-w-[60px]">
                <div className={`text-xl font-bold font-mono ${item.formula_score >= 70 ? 'text-green-400' : item.formula_score >= 50 ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {item.formula_score}
                </div>
                <div className="text-gray-500 text-xs">score</div>
              </div>
              {/* Azioni */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => addToPipeline(item)}
                  className="bg-yellow-700 hover:bg-yellow-600 text-yellow-100 text-xs px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap"
                >
                  + Pipeline
                </button>
                <a
                  href={`https://finviz.com/quote.ashx?t=${item.symbol}`}
                  target="_blank"
                  className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded-lg transition text-center"
                >
                  Finviz →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
