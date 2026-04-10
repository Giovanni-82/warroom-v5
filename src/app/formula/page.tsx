'use client'
import { useState } from 'react'

interface CTIResult {
  symbol: string
  score: number
  verdict: 'GO' | 'WATCH' | 'NO'
  phase: string
  components: { catalyst: number; volume: number; tecnico: number; storico: number; struttura: number }
  signals: string[]
  bsl?: number
  stop?: number
  target?: number
  entry_window?: string
  formula_magica_active: boolean
}

export default function FormulaMagicaPage() {
  const [symbol, setSymbol] = useState('')
  const [result, setResult] = useState<CTIResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [batchSymbols, setBatchSymbols] = useState('')
  const [batchResults, setBatchResults] = useState<CTIResult[]>([])

  async function analyze() {
    if (!symbol.trim()) return
    setLoading(true)
    const r = await fetch(`/api/cti?symbol=${symbol.toUpperCase().trim()}`)
    const d = await r.json()
    setResult(d)
    setLoading(false)
  }

  async function batchAnalyze() {
    const symbols = batchSymbols.split(/[\s,\n]+/).map(s => s.trim().toUpperCase()).filter(s => s.length >= 1 && s.length <= 6)
    if (symbols.length === 0) return
    setLoading(true)
    const r = await fetch('/api/cti', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbols }) })
    const d = await r.json()
    setBatchResults(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  const VERDICT_COLOR = { GO: 'text-green-400', WATCH: 'text-yellow-400', NO: 'text-red-400' }
  const VERDICT_BG = { GO: 'bg-green-900 border-green-700', WATCH: 'bg-yellow-900 border-yellow-700', NO: 'bg-red-900 border-red-700' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">🧲 Formula Magica — CTI Live</h1>
        <p className="text-gray-400 text-sm">Composite Trading Index · Scala 0-100 · &gt;85 = GO automatico</p>
      </div>

      {/* CTI Gauge visuale */}
      {result && (
        <div className={`border rounded-2xl p-6 ${VERDICT_BG[result.verdict]}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-white">{result.symbol}</h2>
              {result.formula_magica_active && (
                <div className="text-yellow-400 font-bold text-sm mt-1 animate-pulse">🧲 FORMULA MAGICA ATTIVA</div>
              )}
            </div>
            <div className="text-center">
              <div className={`text-6xl font-mono font-bold ${VERDICT_COLOR[result.verdict]}`}>{result.score}</div>
              <div className="text-gray-300 text-sm">/100 CTI</div>
              <div className={`text-xl font-bold mt-1 ${VERDICT_COLOR[result.verdict]}`}>{result.verdict}</div>
            </div>
          </div>

          {/* Barra CTI */}
          <div className="h-4 bg-gray-800 rounded-full overflow-hidden mb-4">
            <div className={`h-full rounded-full transition-all ${result.score >= 85 ? 'bg-green-500' : result.score >= 65 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${result.score}%` }} />
          </div>

          {/* Componenti */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Catalyst', value: result.components.catalyst, max: 35 },
              { label: 'Volume', value: result.components.volume, max: 25 },
              { label: 'Tecnico', value: result.components.tecnico, max: 20 },
              { label: 'Storico', value: result.components.storico, max: 10 },
              { label: 'Struttura', value: result.components.struttura, max: 10 },
            ].map(c => (
              <div key={c.label} className="text-center bg-gray-800 rounded-xl p-3">
                <div className="text-white font-bold font-mono text-lg">{c.value}</div>
                <div className="text-gray-400 text-xs">{c.label}</div>
                <div className="text-gray-500 text-xs">/{c.max}</div>
                <div className="mt-1 h-1 bg-gray-700 rounded-full">
                  <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${(c.value / c.max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Parametri operativi */}
          {result.verdict !== 'NO' && result.bsl && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'BSL', value: `$${result.bsl}`, color: 'text-yellow-400' },
                { label: 'Stop (−8%)', value: `$${result.stop}`, color: 'text-red-400' },
                { label: 'Target (+10%)', value: `$${result.target}`, color: 'text-green-400' },
              ].map(p => (
                <div key={p.label} className="bg-gray-800 rounded-xl p-3 text-center">
                  <div className={`text-xl font-mono font-bold ${p.color}`}>{p.value}</div>
                  <div className="text-gray-400 text-xs mt-1">{p.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Segnali */}
          <div className="space-y-1">
            {result.signals.map((s, i) => (
              <div key={i} className="text-sm text-gray-200 bg-gray-800 rounded-lg px-3 py-1.5">{s}</div>
            ))}
          </div>
        </div>
      )}

      {/* Input singolo ticker */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-4 text-sm">Analisi singolo ticker</h2>
        <div className="flex gap-3">
          <input
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && analyze()}
            placeholder="Es. ELAB"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-lg font-mono focus:outline-none focus:border-yellow-500"
          />
          <button onClick={analyze} disabled={loading || !symbol.trim()} className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-6 py-3 rounded-xl transition">
            {loading ? '⏳' : '🧮 Calcola CTI'}
          </button>
        </div>
      </div>

      {/* Batch analysis */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-4 text-sm">Analisi batch (fino a 20 ticker)</h2>
        <textarea
          value={batchSymbols}
          onChange={e => setBatchSymbols(e.target.value.toUpperCase())}
          placeholder="ELAB, FGNX, RYDE, ZNTL..."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 h-24 resize-none font-mono"
        />
        <button onClick={batchAnalyze} disabled={loading || !batchSymbols.trim()} className="mt-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-6 py-2 rounded-xl text-sm transition">
          {loading ? '⏳ Calcolo...' : '🧮 Analizza tutti'}
        </button>
      </div>

      {/* Risultati batch */}
      {batchResults.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-white font-bold text-sm">Classifica CTI — {batchResults.length} ticker</h2>
          {batchResults.map(r => (
            <div key={r.symbol} className={`border rounded-xl p-4 flex items-center gap-4 ${VERDICT_BG[r.verdict]}`}>
              <div className={`text-3xl font-mono font-bold min-w-[60px] text-center ${VERDICT_COLOR[r.verdict]}`}>{r.score}</div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-lg">{r.symbol}</span>
                  <span className={`text-sm font-bold ${VERDICT_COLOR[r.verdict]}`}>{r.verdict}</span>
                  {r.formula_magica_active && <span className="text-yellow-400 text-xs animate-pulse">🧲 FM</span>}
                </div>
                <div className="text-gray-300 text-xs mt-1">{r.signals[0]}</div>
              </div>
              {r.bsl && <div className="text-right text-xs">
                <div className="text-yellow-400 font-mono">BSL ${r.bsl}</div>
                <div className="text-red-400 font-mono">Stop ${r.stop}</div>
                <div className="text-green-400 font-mono">T ${r.target}</div>
              </div>}
            </div>
          ))}
        </div>
      )}

      {/* Legenda */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-4 text-sm">📊 Come funziona il CTI</h2>
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          {[
            ['🎯 Catalyst (35%)', 'M&A 8-K=35, FDA=33, Earnings=28, Vol silenzioso=20'],
            ['📊 Volume (25%)', 'RVOL >200x=20, >50x=16, >10x=12, >5x=8, >2x=4'],
            ['📈 Tecnico (20%)', 'Gap%, sopra VWAP, SMA50/200, 52W high, compressione'],
            ['🏛️ Storico (10%)', 'Float <5M=6, short float >20%=4'],
            ['🏗️ Struttura (10%)', 'Cap $2M-$50M=7, prezzo $1-$5=3'],
            ['🧲 Formula Magica', 'Volume silenzioso + Compressione + Catalyst IN ARRIVO'],
            ['🟢 GO ≥85', 'Auto-aggiunto in Pipeline come AGGANCIATO'],
            ['🟡 WATCH ≥65', 'Auto-aggiunto in Pipeline come SCOVATO'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-yellow-400 font-bold min-w-[140px]">{k}</span>
              <span className="text-gray-300">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
