'use client'
import { useEffect, useState } from 'react'
import type { Trade } from '@/types'

const CATEGORIES = ['L1', 'L2', 'SWING1W', 'SWING2W', 'SWING1M', 'SWING6M', 'SWINGY']
const WINDOWS = ['POSTMKT', 'PREMKT', 'APERTURA', 'POST_SFURIATA', 'INTRADAY']

const EMPTY_TRADE: Partial<Trade> = {
  trade_done: true, category: 'L1', stop_pct: -8,
  target_pct: 10, catalyst_valid: 'CONFERMATO', protocol_ok: true
}

export default function RegistroPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<Trade>>(EMPTY_TRADE)
  const [saving, setSaving] = useState(false)
  const [filterDate, setFilterDate] = useState('')

  useEffect(() => { load() }, [filterDate])

  async function load() {
    setLoading(true)
    const params = filterDate ? `?date=${filterDate}` : '?all=1'
    const [tradesRes, summaryRes] = await Promise.all([
      fetch(`/api/trades${params}`).then(r => r.json()),
      fetch('/api/trades', { method: 'PUT' }).then(r => r.json())
    ])
    setTrades(Array.isArray(tradesRes) ? tradesRes : [])
    setSummary(summaryRes)
    setLoading(false)
  }

  async function saveTrade() {
    if (!form.symbol) return
    setSaving(true)
    const result_pct = form.pmc && form.exit_price
      ? ((form.exit_price - form.pmc) / form.pmc) * 100
      : form.result_pct
    const result_eur = form.invested_eur && result_pct !== undefined
      ? form.invested_eur * (result_pct / 100)
      : form.result_eur
    const method = form.id ? 'PATCH' : 'POST'
    await fetch('/api/trades', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, result_pct, result_eur })
    })
    setShowForm(false)
    setForm(EMPTY_TRADE)
    await load()
    setSaving(false)
  }

  const F = (key: keyof Trade, val: any) => setForm(prev => ({ ...prev, [key]: val }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-xl font-bold text-white">📋 Registro Trade</h1>
        <div className="flex gap-3">
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
          />
          <button
            onClick={() => { setForm(EMPTY_TRADE); setShowForm(true) }}
            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition"
          >
            + Nuovo Trade
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'P&L Totale', value: `€${(summary.total_pnl_eur || -172).toFixed(0)}`, color: (summary.total_pnl_eur || -172) >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Win Rate', value: `${summary.win_rate || 0}%`, color: 'text-yellow-400' },
          { label: 'Trade Fatti', value: summary.total_done || 0, color: 'text-white' },
          { label: 'Media Win', value: `+${summary.avg_win || 0}%`, color: 'text-green-400' },
          { label: 'Media Loss', value: `${summary.avg_loss || 0}%`, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-gray-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabella trade */}
      {loading ? (
        <div className="text-center text-gray-400 py-20">Caricamento...</div>
      ) : trades.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">📋</div>
          <p>Nessun trade registrato. Aggiungi il primo.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
              <tr>
                {['Data', 'Ticker', 'Cat.', 'Fatto', 'PMC', 'Uscita', 'Risultato', 'Invest.', 'P&L €', 'Cumulativo', 'Catalyst', 'Lezione'].map(h => (
                  <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.map((t, i) => {
                const pnlColor = (t.result_eur || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                const cumColor = (t.cumulative_pnl || 0) >= 0 ? 'text-green-300' : 'text-red-300'
                return (
                  <tr key={t.id} className={`border-t border-gray-800 hover:bg-gray-900 transition ${!t.trade_done ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{t.session_date}</td>
                    <td className="px-3 py-3 font-bold text-white">{t.symbol}</td>
                    <td className="px-3 py-3">
                      <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-xs">{t.category}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {t.trade_done ? '✅' : '👁️'}
                    </td>
                    <td className="px-3 py-3 font-mono text-gray-200">{t.pmc ? `$${t.pmc}` : '—'}</td>
                    <td className="px-3 py-3 font-mono text-gray-200">{t.exit_price ? `$${t.exit_price}` : '—'}</td>
                    <td className={`px-3 py-3 font-mono font-bold ${pnlColor}`}>
                      {t.result_pct != null ? `${t.result_pct > 0 ? '+' : ''}${t.result_pct.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-3 py-3 font-mono text-gray-300">{t.invested_eur ? `€${t.invested_eur}` : '—'}</td>
                    <td className={`px-3 py-3 font-mono font-bold ${pnlColor}`}>
                      {t.result_eur != null ? `${t.result_eur > 0 ? '+' : ''}€${t.result_eur.toFixed(0)}` : '—'}
                    </td>
                    <td className={`px-3 py-3 font-mono font-bold ${cumColor}`}>
                      {t.cumulative_pnl != null ? `€${t.cumulative_pnl.toFixed(0)}` : '—'}
                    </td>
                    <td className="px-3 py-3 text-xs text-yellow-400 max-w-[120px] truncate">{t.catalyst || '—'}</td>
                    <td className="px-3 py-3 text-xs text-gray-400 max-w-[200px] truncate">{t.lesson || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form nuovo trade */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-white font-bold text-lg mb-5">+ Nuovo Trade</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Ticker *', key: 'symbol', type: 'text', placeholder: 'FGNX' },
                { label: 'Nome azienda', key: 'name', type: 'text', placeholder: 'Forge Group Inc' },
                { label: 'Data', key: 'session_date', type: 'date' },
                { label: 'Ora entrata', key: 'entry_time', type: 'datetime-local' },
                { label: 'PMC ($)', key: 'pmc', type: 'number', placeholder: '4.94' },
                { label: 'Quantità', key: 'qty', type: 'number', placeholder: '200' },
                { label: 'Investito (€)', key: 'invested_eur', type: 'number', placeholder: '1000' },
                { label: 'Stop ($)', key: 'stop_price', type: 'number', placeholder: '4.55' },
                { label: 'Target (%)', key: 'target_pct', type: 'number', placeholder: '10' },
                { label: 'Prezzo uscita ($)', key: 'exit_price', type: 'number', placeholder: '5.48' },
                { label: 'Ora uscita', key: 'exit_time', type: 'datetime-local' },
                { label: 'Catalyst', key: 'catalyst', type: 'text', placeholder: 'M&A 8-K EDGAR' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-gray-400 text-xs block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(form as any)[f.key] || ''}
                    onChange={e => F(f.key as any, f.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  />
                </div>
              ))}
              {/* Select categoria */}
              <div>
                <label className="text-gray-400 text-xs block mb-1">Categoria</label>
                <select
                  value={form.category}
                  onChange={e => F('category', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {/* Select finestra */}
              <div>
                <label className="text-gray-400 text-xs block mb-1">Finestra ingresso</label>
                <select
                  value={form.entry_window}
                  onChange={e => F('entry_window', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                >
                  <option value="">—</option>
                  {WINDOWS.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              {/* Trade fatto */}
              <div className="col-span-2 flex items-center gap-3">
                <label className="text-gray-400 text-sm">Trade effettuato:</label>
                <button
                  onClick={() => F('trade_done', !form.trade_done)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${form.trade_done ? 'bg-green-700 text-green-100' : 'bg-gray-700 text-gray-300'}`}
                >
                  {form.trade_done ? '✅ FATTO' : '👁️ NON FATTO'}
                </button>
                <button
                  onClick={() => F('protocol_ok', !form.protocol_ok)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${form.protocol_ok ? 'bg-blue-800 text-blue-200' : 'bg-red-900 text-red-300'}`}
                >
                  {form.protocol_ok ? '✅ Protocollo OK' : '⚠️ Violazione'}
                </button>
              </div>
              {/* Lezione */}
              <div className="col-span-2">
                <label className="text-gray-400 text-xs block mb-1">Lezione (obbligatoria)</label>
                <textarea
                  value={form.lesson || ''}
                  onChange={e => F('lesson', e.target.value)}
                  placeholder="Cosa ho imparato da questo trade..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500 h-20 resize-none"
                />
              </div>
              {/* Violazioni se presenti */}
              {!form.protocol_ok && (
                <div className="col-span-2">
                  <label className="text-gray-400 text-xs block mb-1">Violazioni</label>
                  <input
                    value={form.violations || ''}
                    onChange={e => F('violations', e.target.value)}
                    placeholder="Es: size 2x limite, stop non inserito..."
                    className="w-full bg-gray-800 border border-red-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={saveTrade}
                disabled={saving || !form.symbol}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition"
              >
                {saving ? '⏳ Salvo...' : '💾 Salva Trade'}
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
