'use client'
import { useState } from 'react'

interface DeepAnalysis {
  symbol: string
  price: number
  gap: string
  rvol: string
  verdict: 'GO' | 'WATCH' | 'NO'
  analysis: string
  data: { snapshot: boolean; profile: boolean; news: number; catalyst: boolean; ohlcv: number }
}

export default function FormulaMagicaPage() {
  const [symbol, setSymbol] = useState('')
  const [result, setResult] = useState<DeepAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [batchSymbols, setBatchSymbols] = useState('')
  const [batchResults, setBatchResults] = useState<DeepAnalysis[]>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })

  async function analyze(sym?: string) {
    const target = (sym || symbol).trim().toUpperCase()
    if (!target) return
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await fetch(`/api/analyze-deep?symbol=${target}`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setResult(d)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  async function batchAnalyze() {
    const symbols = batchSymbols.split(/[\s,\n]+/).map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{1,6}$/.test(s)).slice(0, 10)
    if (symbols.length === 0) return
    setBatchLoading(true); setBatchResults([]); setBatchProgress({ current: 0, total: symbols.length })
    for (let i = 0; i < symbols.length; i++) {
      try {
        const r = await fetch(`/api/analyze-deep?symbol=${symbols[i]}`)
        const d = await r.json()
        if (!d.error) setBatchResults(prev => [...prev, d].sort((a, b) => {
          const order = { GO: 3, WATCH: 2, NO: 1 }
          return order[b.verdict] - order[a.verdict]
        }))
      } catch {}
      setBatchProgress({ current: i + 1, total: symbols.length })
      if (i < symbols.length - 1) await new Promise(r => setTimeout(r, 1500))
    }
    setBatchLoading(false)
  }

  const VBG = { GO: 'bg-green-950 border-green-700', WATCH: 'bg-yellow-950 border-yellow-700', NO: 'bg-red-950 border-red-700' }
  const VC = { GO: 'text-green-400', WATCH: 'text-yellow-400', NO: 'text-red-400' }
  const VI = { GO: '🟢', WATCH: '🟡', NO: '🔴' }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">🧲 Formula Magica — Analisi AI Profonda</h1>
        <p className="text-gray-400 text-sm">Claude legge tutto: azienda · catalyst · volumi · grafico · news → verdetto ragionato</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex gap-3">
          <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && analyze()}
            placeholder="Es. FGNX, RYDE, ZNTL..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-2xl font-mono focus:outline-none focus:border-yellow-500" />
          <button onClick={() => analyze()} disabled={loading || !symbol.trim()}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-8 py-3 rounded-xl text-lg transition">
            {loading ? '⏳' : '🧲 Analizza'}
          </button>
        </div>
        {loading && <div className="mt-3 text-yellow-400 text-sm animate-pulse">🏛️ Claude sta leggendo: prezzi · azienda · catalyst · news · volumi storici · struttura tecnica...</div>}
        {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}
      </div>

      {result && (
        <div className={`border-2 rounded-2xl overflow-hidden ${VBG[result.verdict]}`}>
          <div className="px-6 py-4 flex items-center justify-between border-b border-gray-700">
            <div>
              <span className="text-3xl font-bold text-white">{result.symbol}</span>
              <div className="flex gap-4 mt-1 text-sm">
                {result.price > 0 && <span className="text-gray-300 font-mono">${result.price}</span>}
                {result.gap !== 'n/d' && <span className={parseFloat(result.gap) >= 0 ? 'text-green-400' : 'text-red-400'}>Gap {parseFloat(result.gap) >= 0 ? '+' : ''}{result.gap}%</span>}
                <span className="text-blue-400">RVOL {result.rvol}x</span>
              </div>
            </div>
            <div className={`text-4xl font-bold ${VC[result.verdict]}`}>{VI[result.verdict]} {result.verdict}</div>
          </div>
          <div className="px-6 py-2 border-b border-gray-800 flex gap-4 text-xs text-gray-400">
            <span>{result.data.snapshot ? '✅' : '⚠️'} Prezzi live</span>
            <span>{result.data.profile ? '✅' : '⚠️'} Profilo azienda</span>
            <span>{result.data.news > 0 ? `✅ ${result.data.news} news` : '⚠️ No news'}</span>
            <span>{result.data.catalyst ? '✅ Catalyst' : '⚠️ No catalyst'}</span>
            <span>{result.data.ohlcv > 0 ? `✅ ${result.data.ohlcv}gg storico` : '⚠️ No storico'}</span>
          </div>
          <div className="px-6 py-5">
            <div className="text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">{result.analysis}</div>
          </div>
          <div className="px-6 py-4 border-t border-gray-800 flex gap-3">
            <a href={`https://finviz.com/quote.ashx?t=${result.symbol}`} target="_blank" className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition">Finviz →</a>
            <a href={`https://www.tradingview.com/chart/?symbol=${result.symbol}`} target="_blank" className="bg-blue-900 hover:bg-blue-800 text-blue-200 px-4 py-2 rounded-lg text-sm transition">TradingView →</a>
            <a href={`https://efts.sec.gov/LATEST/search-index?q=%22${result.symbol}%22&forms=8-K&dateRange=custom&startdt=${new Date(Date.now()-7*86400000).toISOString().split('T')[0]}`} target="_blank" className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition">EDGAR →</a>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-2 text-sm">Analisi batch — fino a 10 ticker</h2>
        <p className="text-gray-500 text-xs mb-3">Claude analizza ognuno in profondità. ~15 secondi per ticker.</p>
        <textarea value={batchSymbols} onChange={e => setBatchSymbols(e.target.value.toUpperCase())}
          placeholder="FGNX, RLYB, CCBC, ZNTL, RYDE..."
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 h-20 resize-none font-mono" />
        <div className="flex items-center gap-3 mt-3">
          <button onClick={batchAnalyze} disabled={batchLoading || !batchSymbols.trim()}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-6 py-2 rounded-xl text-sm transition">
            {batchLoading ? `⏳ Analizzando ${batchProgress.current}/${batchProgress.total}...` : '🧲 Analizza tutti'}
          </button>
          {batchLoading && (
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${(batchProgress.current / Math.max(batchProgress.total, 1)) * 100}%` }} />
            </div>
          )}
        </div>
      </div>

      {batchResults.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-white font-bold text-sm">🏛️ Classifica AI — {batchResults.length} ticker analizzati da Claude</h2>
          {batchResults.map(r => (
            <div key={r.symbol} className={`border rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition ${VBG[r.verdict]}`} onClick={() => setResult(r)}>
              <div className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className={`text-2xl font-bold ${VC[r.verdict]}`}>{VI[r.verdict]}</span>
                  <div>
                    <span className="font-bold text-white text-lg">{r.symbol}</span>
                    {r.price > 0 && <span className="text-gray-400 text-sm ml-2">${r.price}</span>}
                  </div>
                  <span className={`font-bold text-sm ${VC[r.verdict]}`}>{r.verdict}</span>
                </div>
                <span className="text-gray-500 text-xs">clicca per dettaglio →</span>
              </div>
              <div className="px-5 pb-3 text-gray-300 text-xs leading-relaxed">
                {r.analysis.split('\n').find(l => l.includes('CATALYST:') || l.includes('VERDICT:')) || r.analysis.slice(0, 150)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
