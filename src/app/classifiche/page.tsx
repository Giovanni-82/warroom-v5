'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const LEVELS = [
  { key: 'L0', label: 'L0 — Watchlist', desc: 'Osservazione pura, nessun trade', color: 'text-gray-400', border: 'border-gray-700' },
  { key: 'L1', label: 'L1 — Salto in Alto', desc: 'Pre-market €1.000', color: 'text-blue-400', border: 'border-blue-800' },
  { key: 'L2', label: 'L2 — Salto con l\'Asta', desc: 'Intraday €1.000', color: 'text-cyan-400', border: 'border-cyan-800' },
  { key: 'L3a', label: 'L3a — Swing 1W', desc: 'Swing 1 settimana', color: 'text-yellow-400', border: 'border-yellow-800' },
  { key: 'L3b', label: 'L3b — Swing 2W', desc: 'Swing 2 settimane', color: 'text-orange-400', border: 'border-orange-800' },
  { key: 'L3c', label: 'L3c — Swing 1M', desc: 'Swing 1 mese', color: 'text-red-400', border: 'border-red-800' },
  { key: 'L3d', label: 'L3d — Swing 6M', desc: 'Swing 6 mesi', color: 'text-purple-400', border: 'border-purple-800' },
  { key: 'L3e', label: 'L3e — Swing 1Y', desc: 'Swing 1+ anno', color: 'text-pink-400', border: 'border-pink-800' },
  { key: 'PAPER', label: 'Paper Trading', desc: 'Virtuale — studio pattern', color: 'text-green-400', border: 'border-green-800' },
  { key: 'AUTO', label: 'Auto — Segnalati', desc: 'Ticker segnalati dal sistema', color: 'text-emerald-400', border: 'border-emerald-800' },
]

interface TickerEntry {
  id: number
  symbol: string
  name: string
  level: string
  entry_date: string
  entry_price: number
  current_price: number
  target_pct: number
  stop_pct: number
  result_pct: number
  result_eur: number
  status: string // OPEN | CLOSED | WATCHING | MISSED
  catalyst: string
  trade_done: boolean
  virtual_result_pct: number
  session_date: string
}

export default function ClassifichePage() {
  const [entries, setEntries] = useState<TickerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLevel, setActiveLevel] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<TickerEntry>>({ level: 'L1', status: 'WATCHING', trade_done: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('classifiche_rendimento')
      .select('*')
      .order('entry_date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  async function save() {
    setSaving(true)
    const method = form.id ? 'update' : 'insert'
    if (method === 'insert') {
      await supabase.from('classifiche_rendimento').insert(form)
    } else {
      await supabase.from('classifiche_rendimento').update(form).eq('id', form.id)
    }
    setShowForm(false)
    setForm({ level: 'L1', status: 'WATCHING', trade_done: false })
    await load()
    setSaving(false)
  }

  async function deleteEntry(id: number) {
    await supabase.from('classifiche_rendimento').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const F = (k: keyof TickerEntry, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const filtered = activeLevel === 'ALL' ? entries : entries.filter(e => e.level === activeLevel)

  // Stats per livello
  const statsPerLevel = LEVELS.map(l => {
    const items = entries.filter(e => e.level === l.key)
    const closed = items.filter(e => e.status === 'CLOSED')
    const wins = closed.filter(e => (e.result_pct || 0) > 0)
    const totalPnl = closed.reduce((s, e) => s + (e.result_eur || 0), 0)
    const virtualPnl = items.reduce((s, e) => s + (e.virtual_result_pct || 0), 0)
    return {
      ...l,
      total: items.length,
      closed: closed.length,
      wins: wins.length,
      winRate: closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(0) : '—',
      totalPnl,
      virtualPnl: virtualPnl.toFixed(1)
    }
  })

  const totalRealPnl = entries.filter(e => e.trade_done && e.status === 'CLOSED').reduce((s, e) => s + (e.result_eur || 0), 0)
  const totalVirtualPnl = entries.reduce((s, e) => s + (e.virtual_result_pct || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">🏆 Classifiche — 10 Livelli di Trading</h1>
          <p className="text-gray-400 text-sm">Rendimento reale vs virtuale · Tutti i ticker segnalati</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition">↻</button>
          <button onClick={() => setShowForm(true)} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition">
            + Aggiungi Ticker
          </button>
        </div>
      </div>

      {/* Riepilogo globale */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Ticker totali', value: entries.length, color: 'text-white' },
          { label: 'P&L Reale', value: `€${totalRealPnl.toFixed(0)}`, color: totalRealPnl >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'P&L Virtuale', value: `+${totalVirtualPnl.toFixed(1)}%`, color: 'text-blue-400' },
          { label: 'Trade fatti', value: entries.filter(e => e.trade_done).length, color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-gray-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Schede livelli */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statsPerLevel.map(l => (
          <button
            key={l.key}
            onClick={() => setActiveLevel(activeLevel === l.key ? 'ALL' : l.key)}
            className={`border rounded-xl p-3 text-left transition ${activeLevel === l.key ? l.border + ' bg-gray-800' : 'border-gray-800 bg-gray-900 hover:bg-gray-800'}`}
          >
            <div className={`font-bold text-xs ${l.color}`}>{l.label}</div>
            <div className="text-gray-500 text-xs mt-0.5">{l.desc}</div>
            <div className="flex gap-2 mt-2 text-xs">
              <span className="text-white font-mono">{l.total}</span>
              <span className="text-gray-500">ticker</span>
              {l.closed > 0 && (
                <span className={parseInt(l.winRate) >= 50 ? 'text-green-400' : 'text-red-400'}>
                  {l.winRate}% win
                </span>
              )}
            </div>
            {l.totalPnl !== 0 && (
              <div className={`text-xs font-mono mt-1 ${l.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                €{l.totalPnl.toFixed(0)}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Filtro livello attivo */}
      {activeLevel !== 'ALL' && (
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Filtro:</span>
          <span className="bg-yellow-600 text-black text-xs px-3 py-1 rounded-full font-bold">{activeLevel}</span>
          <button onClick={() => setActiveLevel('ALL')} className="text-gray-500 hover:text-white text-xs transition">× Rimuovi</button>
        </div>
      )}

      {/* Tabella ticker */}
      {loading ? (
        <div className="text-center text-gray-400 py-20">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-gray-400">Nessun ticker in questa classifica.</p>
          <p className="text-gray-500 text-sm mt-1">I ticker segnalati dal sistema appariranno automaticamente qui.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {['Livello', 'Ticker', 'Data', 'Entrata', 'Attuale', 'Target', 'Stop', 'Risultato %', 'P&L €', 'Virtuale', 'Catalyst', 'Status', 'Trade', ''].map(h => (
                  <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const level = LEVELS.find(l => l.key === e.level)
                const pnlColor = (e.result_eur || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                const pctColor = (e.result_pct || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                const statusColor: Record<string, string> = {
                  OPEN: 'text-green-400', WATCHING: 'text-yellow-400',
                  CLOSED: 'text-gray-400', MISSED: 'text-red-400'
                }
                return (
                  <tr key={e.id} className="border-t border-gray-800 hover:bg-gray-900 transition">
                    <td className="px-3 py-3">
                      <span className={`text-xs font-bold ${level?.color || 'text-gray-400'}`}>{e.level}</span>
                    </td>
                    <td className="px-3 py-3 font-bold text-white">
                      <a href={`https://finviz.com/quote.ashx?t=${e.symbol}`} target="_blank" className="hover:text-yellow-400 transition">
                        {e.symbol}
                      </a>
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">{e.entry_date || '—'}</td>
                    <td className="px-3 py-3 font-mono text-gray-200">{e.entry_price ? `$${e.entry_price}` : '—'}</td>
                    <td className="px-3 py-3 font-mono text-gray-200">{e.current_price ? `$${e.current_price}` : '—'}</td>
                    <td className="px-3 py-3 font-mono text-green-400">{e.target_pct ? `+${e.target_pct}%` : '—'}</td>
                    <td className="px-3 py-3 font-mono text-red-400">{e.stop_pct ? `${e.stop_pct}%` : '—'}</td>
                    <td className={`px-3 py-3 font-mono font-bold ${pctColor}`}>
                      {e.result_pct != null ? `${e.result_pct > 0 ? '+' : ''}${e.result_pct.toFixed(2)}%` : '—'}
                    </td>
                    <td className={`px-3 py-3 font-mono font-bold ${pnlColor}`}>
                      {e.result_eur != null ? `${e.result_eur > 0 ? '+' : ''}€${e.result_eur.toFixed(0)}` : '—'}
                    </td>
                    <td className="px-3 py-3 font-mono text-blue-400">
                      {e.virtual_result_pct != null ? `${e.virtual_result_pct > 0 ? '+' : ''}${e.virtual_result_pct.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-3 text-yellow-400 text-xs max-w-[120px] truncate">{e.catalyst || '—'}</td>
                    <td className={`px-3 py-3 text-xs font-bold ${statusColor[e.status] || 'text-gray-400'}`}>{e.status}</td>
                    <td className="px-3 py-3 text-center">{e.trade_done ? '✅' : '👁️'}</td>
                    <td className="px-3 py-3">
                      <button onClick={() => deleteEntry(e.id)} className="text-gray-600 hover:text-red-400 transition text-xs">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form aggiungi */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-white font-bold text-lg mb-5">+ Aggiungi Ticker in Classifica</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs block mb-1">Livello *</label>
                <select value={form.level} onChange={e => F('level', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                  {LEVELS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Status</label>
                <select value={form.status} onChange={e => F('status', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                  <option value="WATCHING">👁️ Watching</option>
                  <option value="OPEN">🟢 Open</option>
                  <option value="CLOSED">✅ Closed</option>
                  <option value="MISSED">❌ Missed</option>
                </select>
              </div>
              {[
                { label: 'Ticker *', key: 'symbol', type: 'text', placeholder: 'ELAB' },
                { label: 'Nome', key: 'name', type: 'text', placeholder: 'PMGC Holdings' },
                { label: 'Data', key: 'entry_date', type: 'date' },
                { label: 'Prezzo entrata ($)', key: 'entry_price', type: 'number', placeholder: '4.40' },
                { label: 'Prezzo attuale ($)', key: 'current_price', type: 'number' },
                { label: 'Target (%)', key: 'target_pct', type: 'number', placeholder: '10' },
                { label: 'Stop (%)', key: 'stop_pct', type: 'number', placeholder: '-8' },
                { label: 'Risultato reale (%)', key: 'result_pct', type: 'number' },
                { label: 'P&L reale (€)', key: 'result_eur', type: 'number' },
                { label: 'Risultato virtuale (%)', key: 'virtual_result_pct', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-gray-400 text-xs block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={(f as any).placeholder || ''}
                    value={(form as any)[f.key] || ''}
                    onChange={e => F(f.key as any, f.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-gray-400 text-xs block mb-1">Catalyst</label>
                <input value={form.catalyst || ''} onChange={e => F('catalyst', e.target.value)}
                  placeholder="Es: 8-K M&A Streeterville Capital $20M facility"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500" />
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <label className="text-gray-400 text-sm">Trade effettuato:</label>
                <button onClick={() => F('trade_done', !form.trade_done)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${form.trade_done ? 'bg-green-700 text-green-100' : 'bg-gray-700 text-gray-300'}`}>
                  {form.trade_done ? '✅ FATTO' : '👁️ VIRTUALE'}
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={save} disabled={saving || !form.symbol}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition">
                {saving ? '⏳' : '💾 Salva'}
              </button>
              <button onClick={() => setShowForm(false)} className="bg-gray-700 text-white px-6 py-3 rounded-xl hover:bg-gray-600 transition">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
