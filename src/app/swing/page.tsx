'use client'
import { useEffect, useState } from 'react'
import type { SwingPosition } from '@/types'

const CATEGORIES = ['SWING1W', 'SWING2W', 'SWING1M', 'SWING6M', 'SWINGY']
const CAT_LABEL: Record<string, string> = {
  SWING1W: '⚡ 1 Settimana', SWING2W: '📅 2 Settimane',
  SWING1M: '📆 1 Mese', SWING6M: '📈 6 Mesi', SWINGY: '🏦 1+ Anno'
}
const CAT_COLOR: Record<string, string> = {
  SWING1W: 'border-green-700', SWING2W: 'border-yellow-700',
  SWING1M: 'border-orange-700', SWING6M: 'border-purple-700', SWINGY: 'border-pink-700'
}

export default function SwingPage() {
  const [positions, setPositions] = useState<SwingPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<SwingPosition>>({ category: 'SWING1W', status: 'OPEN' })
  const [filterCat, setFilterCat] = useState<string>('ALL')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const r = await fetch('/api/swing')
    const d = await r.json()
    setPositions(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  async function save() {
    const method = form.id ? 'PATCH' : 'POST'
    await fetch('/api/swing', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    setShowForm(false)
    setForm({ category: 'SWING1W', status: 'OPEN' })
    await load()
  }

  async function closePosition(id: number, exit_price: number) {
    const pos = positions.find(p => p.id === id)!
    const result_pct = pos.entry_price ? ((exit_price - pos.entry_price) / pos.entry_price) * 100 : 0
    const result_eur = pos.invested_eur ? pos.invested_eur * (result_pct / 100) : 0
    await fetch('/api/swing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'CLOSED', exit_price, exit_date: new Date().toISOString().split('T')[0], result_pct, result_eur })
    })
    await load()
  }

  const F = (key: keyof SwingPosition, val: any) => setForm(prev => ({ ...prev, [key]: val }))

  const filtered = positions.filter(p => filterCat === 'ALL' || p.category === filterCat)
  const open = filtered.filter(p => p.status === 'OPEN')
  const watching = filtered.filter(p => p.status === 'WATCHING')
  const closed = filtered.filter(p => p.status === 'CLOSED').slice(0, 10)

  const totalPnl = positions.filter(p => p.status === 'CLOSED').reduce((s, p) => s + (p.result_eur || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">📊 Swing Monitor</h1>
          <p className="text-gray-400 text-sm">Struttura aziendale · Catalyst programmato · Posizionamento anticipato</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition">↻</button>
          <button onClick={() => setShowForm(true)} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition">
            + Nuova Posizione
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Posizioni aperte', value: positions.filter(p => p.status === 'OPEN').length, color: 'text-green-400' },
          { label: 'In osservazione', value: positions.filter(p => p.status === 'WATCHING').length, color: 'text-yellow-400' },
          { label: 'P&L Swing chiusi', value: `€${totalPnl.toFixed(0)}`, color: totalPnl >= 0 ? 'text-green-400' : 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-gray-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtri categoria */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilterCat('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterCat === 'ALL' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
          Tutti
        </button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilterCat(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterCat === c ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">Caricamento...</div>
      ) : (
        <>
          {/* Posizioni aperte */}
          {open.length > 0 && (
            <div>
              <h2 className="text-green-400 font-bold mb-3 text-sm uppercase">🟢 Posizioni Aperte ({open.length})</h2>
              <div className="grid gap-3">
                {open.map(pos => <PositionCard key={pos.id} pos={pos} onClose={closePosition} />)}
              </div>
            </div>
          )}

          {/* In osservazione */}
          {watching.length > 0 && (
            <div>
              <h2 className="text-yellow-400 font-bold mb-3 text-sm uppercase">👁️ In Osservazione ({watching.length})</h2>
              <div className="grid gap-3">
                {watching.map(pos => <PositionCard key={pos.id} pos={pos} onClose={closePosition} />)}
              </div>
            </div>
          )}

          {/* Nessuna posizione */}
          {open.length === 0 && watching.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-4">🎣</div>
              <p className="font-medium">Nessuna posizione swing attiva.</p>
              <p className="text-sm mt-1">Il swing è la pesca a strascico — pazienta e posizionati PRIMA del movimento.</p>
            </div>
          )}

          {/* Storico chiuse */}
          {closed.length > 0 && (
            <div>
              <h2 className="text-gray-400 font-bold mb-3 text-sm uppercase">📁 Ultime chiuse</h2>
              <div className="grid gap-2">
                {closed.map(pos => (
                  <div key={pos.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between opacity-70">
                    <div>
                      <span className="font-bold text-white">{pos.symbol}</span>
                      <span className="text-gray-400 text-sm ml-2">{pos.category}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className={`font-mono font-bold ${(pos.result_pct || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(pos.result_pct || 0) >= 0 ? '+' : ''}{(pos.result_pct || 0).toFixed(2)}%
                      </span>
                      <span className={`font-mono ${(pos.result_eur || 0) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                        {(pos.result_eur || 0) >= 0 ? '+' : ''}€{(pos.result_eur || 0).toFixed(0)}
                      </span>
                      <span className="text-gray-500 text-xs">{pos.exit_date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Form nuova posizione */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-white font-bold text-lg mb-5">+ Nuova Posizione Swing</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Ticker *', key: 'symbol', type: 'text' },
                { label: 'Nome', key: 'name', type: 'text' },
                { label: 'Data entrata', key: 'entry_date', type: 'date' },
                { label: 'Prezzo entrata ($)', key: 'entry_price', type: 'number' },
                { label: 'Quantità', key: 'qty', type: 'number' },
                { label: 'Investito (€)', key: 'invested_eur', type: 'number' },
                { label: 'Stop ($)', key: 'stop_price', type: 'number' },
                { label: 'Target (%)', key: 'target_pct', type: 'number' },
                { label: 'Catalyst', key: 'catalyst', type: 'text' },
                { label: 'Data catalyst', key: 'catalyst_date', type: 'date' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-gray-400 text-xs block mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key] || ''}
                    onChange={e => F(f.key as any, f.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  />
                </div>
              ))}
              <div>
                <label className="text-gray-400 text-xs block mb-1">Categoria</label>
                <select value={form.category} onChange={e => F('category', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs block mb-1">Status</label>
                <select value={form.status} onChange={e => F('status', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none">
                  <option value="WATCHING">👁️ In osservazione</option>
                  <option value="OPEN">🟢 Aperta</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-gray-400 text-xs block mb-1">Note</label>
                <textarea value={form.notes || ''} onChange={e => F('notes', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none h-20 resize-none"
                  placeholder="Setup tecnico, tesi di investimento, segnali Formula Magica..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={save} disabled={!form.symbol}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition">
                💾 Salva
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

function PositionCard({ pos, onClose }: { pos: SwingPosition; onClose: (id: number, price: number) => void }) {
  const [exitPrice, setExitPrice] = useState('')
  const daysHeld = pos.entry_date
    ? Math.floor((Date.now() - new Date(pos.entry_date).getTime()) / 86400000)
    : 0
  const catDaysLeft = pos.catalyst_date
    ? Math.floor((new Date(pos.catalyst_date).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className={`bg-gray-900 border ${CAT_COLOR[pos.category] || 'border-gray-700'} rounded-xl p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-bold text-white text-xl">{pos.symbol}</span>
            <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{CAT_LABEL[pos.category]}</span>
            {pos.status === 'WATCHING' && <span className="text-yellow-400 text-xs">👁️ WATCHING</span>}
          </div>
          {pos.name && <div className="text-gray-400 text-sm">{pos.name}</div>}
        </div>
        <div className="text-right">
          {pos.entry_price && <div className="font-mono text-gray-200">${pos.entry_price}</div>}
          <div className="text-gray-500 text-xs">{daysHeld}gg tenuto</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm mb-3">
        {[
          ['Investito', pos.invested_eur ? `€${pos.invested_eur}` : '—'],
          ['Target', pos.target_pct ? `+${pos.target_pct}%` : '—'],
          ['Stop', pos.stop_price ? `$${pos.stop_price}` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="bg-gray-800 rounded-lg p-2 text-center">
            <div className="text-white font-mono text-sm">{v}</div>
            <div className="text-gray-500 text-xs">{k}</div>
          </div>
        ))}
      </div>
      {pos.catalyst && (
        <div className="text-yellow-400 text-xs mb-2">
          🎯 {pos.catalyst}
          {catDaysLeft !== null && (
            <span className={`ml-2 font-bold ${catDaysLeft <= 2 ? 'text-red-400 animate-pulse' : catDaysLeft <= 7 ? 'text-orange-400' : ''}`}>
              ({catDaysLeft > 0 ? `tra ${catDaysLeft}gg` : catDaysLeft === 0 ? 'OGGI' : `${Math.abs(catDaysLeft)}gg fa`})
            </span>
          )}
        </div>
      )}
      {pos.status === 'OPEN' && (
        <div className="flex gap-2 mt-3">
          <input
            type="number"
            placeholder="Prezzo uscita $"
            value={exitPrice}
            onChange={e => setExitPrice(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-red-500"
          />
          <button
            onClick={() => exitPrice && onClose(pos.id, parseFloat(exitPrice))}
            disabled={!exitPrice}
            className="bg-red-800 hover:bg-red-700 disabled:opacity-50 text-red-100 px-4 py-1.5 rounded-lg text-sm font-bold transition"
          >
            Chiudi
          </button>
        </div>
      )}
    </div>
  )
}
