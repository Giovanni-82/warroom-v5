'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Fascicolo {
  symbol: string
  level: string
  claude_verdict: string
  claude_analysis: string
  gemini_verdict: string
  gemini_analysis: string
  final_verdict: string
  probability_pct: number
  risk_reward: string
  bsl: number
  stop: number
  target: number
  catalyst: string
  created_at: string
  gara_claude: string
  gara_giovanni: string
  gara_result: string
}

const LEVELS = ['L1','L2','L3a','L3b','L3c','L3d','L3e','PAPER','AUTO','S']
const LEVEL_DESC: Record<string,string> = {
  'S':'Scalping secondi/minuti','L1':'Intraday €1k','L2':'Intraday bull flag',
  'L3a':'Swing 1W','L3b':'Swing 2W','L3c':'Swing 1M','L3d':'Swing 6M','L3e':'Swing 1Y',
  'PAPER':'Virtuale','AUTO':'Segnalato dal sistema'
}

export default function FascicoloPage() {
  const [symbol, setSymbol] = useState('')
  const [level, setLevel] = useState('L1')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Fascicolo | null>(null)
  const [fascicoli, setFascicoli] = useState<Fascicolo[]>([])
  const [activeLevel, setActiveLevel] = useState('ALL')
  const [giovanniChoice, setGiovanniChoice] = useState<Record<string,string>>({})

  useEffect(() => { loadFascicoli() }, [])

  async function loadFascicoli() {
    const { data } = await supabase.from('fascicoli').select('*').order('created_at', { ascending: false }).limit(50)
    setFascicoli(data || [])
  }

  async function buildFascicolo() {
    if (!symbol.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const r = await fetch(`/api/fascicolo?symbol=${symbol.toUpperCase().trim()}&level=${level}`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setResult(d)
      await loadFascicoli()
    } catch (e: any) { alert(e.message) }
    setLoading(false)
  }

  async function saveGiovanniChoice(id: string, choice: string) {
    setGiovanniChoice(prev => ({ ...prev, [id]: choice }))
    await supabase.from('fascicoli').update({ gara_giovanni: choice }).eq('symbol', id)
    await loadFascicoli()
  }

  const filtered = activeLevel === 'ALL' ? fascicoli : fascicoli.filter(f => f.level === activeLevel)

  const VC: Record<string,string> = { GO: 'text-green-400', WATCH: 'text-yellow-400', NO: 'text-red-400' }
  const VB: Record<string,string> = { GO: 'border-green-700 bg-green-950', WATCH: 'border-yellow-700 bg-yellow-950', NO: 'border-red-700 bg-red-950' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">📋 Fascicolo Tecnico</h1>
          <p className="text-gray-400 text-sm">Claude + Gemini analizzano ogni candidato · Gara: Claude vs Giovanni</p>
        </div>
      </div>

      {/* Input */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex gap-3 flex-wrap">
          <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && buildFascicolo()}
            placeholder="Ticker es. FGNX"
            className="flex-1 min-w-[120px] bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-xl font-mono focus:outline-none focus:border-yellow-500" />
          <select value={level} onChange={e => setLevel(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none">
            {LEVELS.map(l => <option key={l} value={l}>{l} — {LEVEL_DESC[l]}</option>)}
          </select>
          <button onClick={buildFascicolo} disabled={loading || !symbol.trim()}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-8 py-3 rounded-xl transition">
            {loading ? '⏳ Costruisco fascicolo...' : '📋 Genera Fascicolo'}
          </button>
        </div>
        {loading && <div className="mt-3 text-yellow-400 text-sm animate-pulse">🏛️ Claude analizza · 🔵 Gemini analizza · Costruzione fascicolo in corso...</div>}
      </div>

      {/* Fascicolo risultato */}
      {result && (
        <div className={`border-2 rounded-2xl overflow-hidden ${VB[result.final_verdict] || 'border-gray-700'}`}>
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-700">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-4xl font-bold text-white">{result.symbol}</h2>
                  <span className="bg-gray-700 text-gray-200 text-xs px-3 py-1 rounded-full">{result.level}</span>
                </div>
                <p className="text-gray-400 text-sm mt-1">{result.catalyst}</p>
              </div>
              <div className="text-center">
                <div className={`text-5xl font-bold ${VC[result.final_verdict] || 'text-white'}`}>
                  {result.final_verdict === 'GO' ? '🟢' : result.final_verdict === 'WATCH' ? '🟡' : '🔴'} {result.final_verdict}
                </div>
                <div className="text-gray-300 text-sm mt-1">Probabilità: <strong className="text-yellow-400">{result.probability_pct}%</strong></div>
                <div className="text-gray-300 text-sm">Risk/Reward: <strong className="text-green-400">{result.risk_reward}</strong></div>
              </div>
            </div>
            {/* Parametri */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'BSL', value: `$${result.bsl}`, color: 'text-yellow-400' },
                { label: 'Stop −8%', value: `$${result.stop}`, color: 'text-red-400' },
                { label: 'Target', value: `$${result.target}`, color: 'text-green-400' },
              ].map(p => (
                <div key={p.label} className="bg-gray-800 rounded-xl p-3 text-center">
                  <div className={`text-2xl font-mono font-bold ${p.color}`}>{p.value}</div>
                  <div className="text-gray-400 text-xs mt-1">{p.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Claude vs Gemini */}
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-700">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🏛️</span>
                <span className="font-bold text-white">Claude</span>
                <span className={`ml-auto font-bold ${VC[result.claude_verdict] || ''}`}>{result.claude_verdict}</span>
              </div>
              <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{result.claude_analysis}</div>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🔵</span>
                <span className="font-bold text-white">Gemini</span>
                <span className={`ml-auto font-bold ${VC[result.gemini_verdict] || ''}`}>{result.gemini_verdict}</span>
              </div>
              <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{result.gemini_analysis}</div>
            </div>
          </div>

          {/* GARA */}
          <div className="px-6 py-4 border-t border-gray-700 bg-gray-900/50">
            <h3 className="text-white font-bold mb-3">🎮 LA GARA — Claude vs Giovanni</h3>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="bg-gray-800 rounded-xl px-4 py-2">
                <div className="text-gray-400 text-xs">Claude scommette</div>
                <div className={`font-bold text-lg ${VC[result.gara_claude] || 'text-white'}`}>{result.gara_claude || result.final_verdict}</div>
              </div>
              <div className="text-gray-500 text-2xl">⚔️</div>
              <div className="bg-gray-800 rounded-xl px-4 py-2">
                <div className="text-gray-400 text-xs">Giovanni decide</div>
                <div className="flex gap-2 mt-1">
                  {['GO', 'NO'].map(c => (
                    <button key={c} onClick={() => saveGiovanniChoice(result.symbol, c)}
                      className={`px-4 py-1 rounded-lg font-bold text-sm transition ${result.gara_giovanni === c ? (c === 'GO' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              {result.gara_result && (
                <div className={`font-bold text-lg ${result.gara_result === 'CLAUDE' ? 'text-yellow-400' : result.gara_result === 'GIOVANNI' ? 'text-blue-400' : 'text-gray-400'}`}>
                  🏆 Vince: {result.gara_result}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtri per livello */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', ...LEVELS].map(l => (
          <button key={l} onClick={() => setActiveLevel(l)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${activeLevel === l ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Lista fascicoli */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(f => (
            <div key={f.symbol + f.created_at} className={`border rounded-xl p-4 cursor-pointer hover:opacity-90 transition ${VB[f.final_verdict] || 'border-gray-700'}`}
              onClick={() => setResult(f)}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-white text-lg">{f.symbol}</span>
                  <span className="text-gray-500 text-xs bg-gray-800 px-2 py-0.5 rounded">{f.level}</span>
                  <span className={`font-bold text-sm ${VC[f.final_verdict] || ''}`}>{f.final_verdict}</span>
                  <span className="text-gray-400 text-xs">{f.probability_pct}% prob.</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span>🏛️ {f.claude_verdict}</span>
                  <span>🔵 {f.gemini_verdict}</span>
                  {f.gara_giovanni && <span className={f.gara_result === 'CLAUDE' ? 'text-yellow-400' : f.gara_result === 'GIOVANNI' ? 'text-blue-400' : 'text-gray-400'}>
                    Gara: {f.gara_result || 'in corso'}
                  </span>}
                </div>
              </div>
              <p className="text-gray-400 text-xs mt-1 truncate">{f.catalyst}</p>
            </div>
          ))}
        </div>
      )}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">📋</div>
          <p>Nessun fascicolo. Inserisci un ticker e genera il primo.</p>
        </div>
      )}
    </div>
  )
}
