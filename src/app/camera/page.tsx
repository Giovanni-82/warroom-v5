'use client'
import { useState } from 'react'

interface BestGainerEntry {
  symbol: string
  gain_pct: number
  catalyst_found: string
  was_in_sweep: boolean
  was_in_pipeline: boolean
  was_catchable: boolean | null
  catchable_signal: string
  missed_reason: string
  potential_gain_eur: number
  new_rule: string
  ai_analysis: string
  chunks: string[]
  currentChunk: number
  loading: boolean
}

export default function CameraPage() {
  const [gainers, setGainers] = useState<BestGainerEntry[]>([])
  const [newSymbol, setNewSymbol] = useState('')
  const [newGain, setNewGain] = useState('')
  const [saving, setSaving] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')
  const [newRule, setNewRule] = useState('')
  const [savingRule, setSavingRule] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  function addGainer() {
    const sym = newSymbol.toUpperCase().trim()
    if (!sym || gainers.find(g => g.symbol === sym)) return
    setGainers(prev => [...prev, {
      symbol: sym,
      gain_pct: parseFloat(newGain) || 0,
      catalyst_found: '', was_in_sweep: false, was_in_pipeline: false,
      was_catchable: null, catchable_signal: '', missed_reason: '',
      potential_gain_eur: 0, new_rule: '', ai_analysis: '',
      chunks: [], currentChunk: 0, loading: false
    }])
    setNewSymbol('')
    setNewGain('')
  }

  async function analyzeGainer(symbol: string) {
    const gainer = gainers.find(g => g.symbol === symbol)!
    setGainers(prev => prev.map(g => g.symbol === symbol ? { ...g, loading: true, chunks: [] } : g))
    try {
      const r = await fetch('/api/analysis/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `CAMERA DI ANALISI POST-SESSIONE — OBBLIGATORIA
Ticker: ${symbol}
Gain oggi: +${gainer.gain_pct}%
Era nel nostro sweep: ${gainer.was_in_sweep ? 'SÌ' : 'NO'}
Era nella pipeline: ${gainer.was_in_pipeline ? 'SÌ' : 'NO'}

Rispondi in modo PRECISO e COMPLETO a questi punti:
1. PERCHÉ è salito? Identifica il catalyst specifico (8-K, FDA, earnings, M&A, contratto...). Fonte?
2. Il catalyst era trovabile con il nostro sweep notturno? Come e dove?
3. QUANDO esattamente è avvenuta l'esplosione (in quale finestra)?
4. Sarebbe stato INTERCETTABILE con Cecchini v2.4? Con quale segnale e in quale momento preciso?
5. C'erano segnali nei giorni precedenti (volume silenzioso, compressione, Formula Magica)?
6. Se intercettabile: potenziale gain su €1.000 investiti?
7. NUOVA REGOLA da codificare nel sistema (se il pattern era riconoscibile)?

Sii chirurgico. Ogni risposta non trovata vale soldi persi.`
        })
      })
      const d = await r.json()
      setGainers(prev => prev.map(g => g.symbol === symbol ? {
        ...g, loading: false,
        ai_analysis: d.text || '',
        chunks: d.chunks || [d.text],
        currentChunk: 0
      } : g))
    } catch {
      setGainers(prev => prev.map(g => g.symbol === symbol ? { ...g, loading: false } : g))
    }
  }

  async function saveGainer(gainer: BestGainerEntry) {
    setSaving(true)
    await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: gainer.symbol, session_date: today,
        category: 'L1', trade_done: false,
        result_pct: gainer.gain_pct,
        potential_gain_eur: gainer.potential_gain_eur,
        catalyst: gainer.catalyst_found,
        lesson: gainer.ai_analysis?.slice(0, 500) || ''
      })
    })
    setSaving(false)
  }

  async function saveRule() {
    if (!newRule.trim()) return
    setSavingRule(true)
    await fetch('/api/sweep', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_text: newRule, rule_date: today, active: true })
    })
    setNewRule('')
    setSavingRule(false)
    alert('Regola salvata! Apparirà nella Dashboard.')
  }

  function updateGainer(symbol: string, updates: Partial<BestGainerEntry>) {
    setGainers(prev => prev.map(g => g.symbol === symbol ? { ...g, ...updates } : g))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">🔬 Camera di Analisi — {today}</h1>
        <p className="text-yellow-400 text-sm font-medium">⭐ La fase più importante. Studio obbligatorio di tutti i +10% della sessione.</p>
      </div>

      {/* Aggiungi best gainer */}
      <div className="bg-gray-900 border border-yellow-900 rounded-xl p-5">
        <h2 className="text-yellow-400 font-bold mb-4 text-sm uppercase">Inserisci best gainers della sessione (+10%)</h2>
        <div className="flex gap-3 flex-wrap">
          <input
            value={newSymbol}
            onChange={e => setNewSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addGainer()}
            placeholder="Ticker (es. CYCN)"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-32 focus:outline-none focus:border-yellow-500"
          />
          <input
            value={newGain}
            onChange={e => setNewGain(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGainer()}
            placeholder="Gain % (es. 47)"
            type="number"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm w-36 focus:outline-none focus:border-yellow-500"
          />
          <button onClick={addGainer} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition">
            + Aggiungi
          </button>
        </div>
        {gainers.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {gainers.map(g => (
              <div key={g.symbol} className="flex items-center gap-1 bg-gray-800 border border-green-800 rounded-lg px-3 py-1">
                <span className="text-white font-bold text-sm">{g.symbol}</span>
                <span className="text-green-400 text-xs">+{g.gain_pct}%</span>
                <button onClick={() => setGainers(prev => prev.filter(x => x.symbol !== g.symbol))} className="text-gray-500 hover:text-red-400 ml-1 text-xs">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schede analisi per ogni gainer */}
      {gainers.map(gainer => (
        <div key={gainer.symbol} className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-white">{gainer.symbol}</span>
              <span className="text-green-400 text-xl font-mono font-bold">+{gainer.gain_pct}%</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => analyzeGainer(gainer.symbol)}
                disabled={gainer.loading}
                className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-4 py-2 rounded-lg text-sm transition"
              >
                {gainer.loading ? '⏳ Analisi...' : '🤖 Analizza con AI'}
              </button>
              <button
                onClick={() => saveGainer(gainer)}
                disabled={saving}
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition"
              >
                💾 Salva
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Flags manuali */}
            <div className="flex gap-3 flex-wrap">
              {[
                { key: 'was_in_sweep', label: 'Era nel sweep?', trueLabel: 'SÌ ✅', falseLabel: 'NO ❌' },
                { key: 'was_in_pipeline', label: 'Era in pipeline?', trueLabel: 'SÌ ✅', falseLabel: 'NO ❌' },
              ].map(f => (
                <div key={f.key} className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">{f.label}</span>
                  <button
                    onClick={() => updateGainer(gainer.symbol, { [f.key]: !(gainer as any)[f.key] })}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${(gainer as any)[f.key] ? 'bg-green-800 text-green-200' : 'bg-red-900 text-red-300'}`}
                  >
                    {(gainer as any)[f.key] ? f.trueLabel : f.falseLabel}
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Intercettabile?</span>
                {[null, true, false].map(v => (
                  <button
                    key={String(v)}
                    onClick={() => updateGainer(gainer.symbol, { was_catchable: v })}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${gainer.was_catchable === v ? (v === true ? 'bg-green-700 text-green-100' : v === false ? 'bg-red-900 text-red-300' : 'bg-gray-600 text-gray-200') : 'bg-gray-800 text-gray-500'}`}
                  >
                    {v === null ? '?' : v ? 'SÌ' : 'NO'}
                  </button>
                ))}
              </div>
            </div>

            {/* Campi testo */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Catalyst trovato</label>
                <input
                  value={gainer.catalyst_found}
                  onChange={e => updateGainer(gainer.symbol, { catalyst_found: e.target.value })}
                  placeholder="Es: M&A 8-K EDGAR ore 22:02"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Potenziale guadagno su €1.000</label>
                <input
                  type="number"
                  value={gainer.potential_gain_eur}
                  onChange={e => updateGainer(gainer.symbol, { potential_gain_eur: parseFloat(e.target.value) })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                />
              </div>
              {gainer.was_catchable && (
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Come/quando era intercettabile</label>
                  <input
                    value={gainer.catchable_signal}
                    onChange={e => updateGainer(gainer.symbol, { catchable_signal: e.target.value })}
                    placeholder="Es: Sweep notturno ore 22:02 su SEC EDGAR Form 8-K..."
                    className="w-full bg-gray-800 border border-green-900 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
              )}
              {gainer.was_catchable === false && (
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Motivo non intercettabile</label>
                  <input
                    value={gainer.missed_reason}
                    onChange={e => updateGainer(gainer.symbol, { missed_reason: e.target.value })}
                    placeholder="Es: catalyst puramente speculativo, nessun segnale tecnico..."
                    className="w-full bg-gray-800 border border-red-900 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Analisi AI con chunking */}
            {gainer.loading && (
              <div className="bg-gray-800 rounded-xl p-4 text-center text-yellow-400 animate-pulse">
                ⏳ Claude sta analizzando {gainer.symbol}...
              </div>
            )}
            {gainer.chunks.length > 0 && (
              <div className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-yellow-400 font-bold text-sm">🏛️ CLAUDE — Analisi {gainer.symbol}</span>
                  {gainer.chunks.length > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateGainer(gainer.symbol, { currentChunk: Math.max(0, gainer.currentChunk - 1) })}
                        disabled={gainer.currentChunk === 0}
                        className="bg-gray-700 text-white px-2 py-1 rounded text-xs disabled:opacity-30"
                      >←</button>
                      <span className="text-gray-400 text-xs">{gainer.currentChunk + 1}/{gainer.chunks.length}</span>
                      <button
                        onClick={() => updateGainer(gainer.symbol, { currentChunk: Math.min(gainer.chunks.length - 1, gainer.currentChunk + 1) })}
                        disabled={gainer.currentChunk === gainer.chunks.length - 1}
                        className="bg-gray-700 text-white px-2 py-1 rounded text-xs disabled:opacity-30"
                      >→</button>
                    </div>
                  )}
                </div>
                <div className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                  {gainer.chunks[gainer.currentChunk]}
                </div>
                {gainer.chunks.length > 1 && (
                  <div className="flex gap-1 mt-2 justify-center">
                    {gainer.chunks.map((_, i) => (
                      <button key={i} onClick={() => updateGainer(gainer.symbol, { currentChunk: i })}
                        className={`w-2 h-2 rounded-full transition ${i === gainer.currentChunk ? 'bg-yellow-400' : 'bg-gray-600'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Note sessione */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-3 text-sm">📝 Note sessione S{today.slice(-2)}</h2>
        <textarea
          value={sessionNotes}
          onChange={e => setSessionNotes(e.target.value)}
          placeholder="Resoconto generale della sessione, decisioni prese, stato emotivo, rispetto del protocollo..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 h-32 resize-none"
        />
      </div>

      {/* Codifica nuova regola */}
      <div className="bg-gray-900 border border-yellow-900 rounded-2xl p-5">
        <h2 className="text-yellow-400 font-bold mb-3 text-sm uppercase">🧠 Codifica nuova regola nel sistema</h2>
        <p className="text-gray-400 text-xs mb-3">Se hai individuato un pattern riconoscibile, scrivilo qui. Apparirà permanentemente nella Dashboard.</p>
        <textarea
          value={newRule}
          onChange={e => setNewRule(e.target.value)}
          placeholder="Es: Ticker con 8-K item 1.01 (M&A) pubblicato dopo le 22:00 IT → inserire in sweep notturno come priorità 1, verifica float &lt;10M e prezzo $1-$10, candidato INTRADAY il giorno successivo..."
          className="w-full bg-gray-800 border border-yellow-900 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500 h-28 resize-none"
        />
        <button
          onClick={saveRule}
          disabled={!newRule.trim() || savingRule}
          className="mt-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-6 py-2 rounded-lg text-sm transition"
        >
          {savingRule ? '⏳ Salvo...' : '💾 Salva regola nel sistema'}
        </button>
      </div>
    </div>
  )
}
