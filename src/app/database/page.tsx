'use client'
import { useEffect, useState } from 'react'

export default function DatabasePage() {
  const [tickers, setTickers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateResult, setUpdateResult] = useState<any>(null)

  useEffect(() => {
    const t = setTimeout(() => search(), 300)
    return () => clearTimeout(t)
  }, [q])

  async function search() {
    setLoading(true)
    const params = new URLSearchParams({ limit: '50' })
    if (q) params.set('q', q)
    const r = await fetch(`/api/universe?${params}`)
    const d = await r.json()
    setTickers(d.data || [])
    setTotal(d.total || 0)
    setLoading(false)
  }

  async function updateUniverse() {
    setUpdating(true)
    setUpdateResult(null)
    const r = await fetch('/api/universe', { method: 'POST' })
    const d = await r.json()
    setUpdateResult(d)
    await search()
    setUpdating(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">🗄️ Database Universo Ticker</h1>
          <p className="text-gray-400 text-sm">~10.000 ticker NYSE/NASDAQ · Fonte: NASDAQ Trader · Aggiornamento giornaliero</p>
        </div>
        <button
          onClick={updateUniverse}
          disabled={updating}
          className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-6 py-2 rounded-lg text-sm transition"
        >
          {updating ? '⏳ Aggiornamento in corso...' : '⬇️ Aggiorna Database'}
        </button>
      </div>

      {updateResult && (
        <div className={`border rounded-xl p-4 ${updateResult.ok ? 'bg-green-950 border-green-800 text-green-300' : 'bg-red-950 border-red-800 text-red-300'}`}>
          {updateResult.ok
            ? `✅ Aggiornato: ${updateResult.total_downloaded.toLocaleString()} ticker scaricati, ${updateResult.total_inserted.toLocaleString()} inseriti`
            : `❌ Errore: ${updateResult.error}`}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Cerca per ticker o nome azienda..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500"
        />
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-400 text-sm flex items-center">
          {loading ? '⏳' : `${total} risultati`}
        </div>
      </div>

      {/* Tabella */}
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
            <tr>
              {['Ticker', 'Nome', 'Exchange', 'Prezzo', 'Avg Volume', 'SMA50', 'SMA200', 'Aggiornato'].map(h => (
                <th key={h} className="px-3 py-3 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-20 text-gray-500">
                  {loading ? 'Caricamento...' : q ? 'Nessun risultato' : 'Database vuoto. Clicca "Aggiorna Database" per scaricare tutti i ticker.'}
                </td>
              </tr>
            ) : tickers.map(t => (
              <tr key={t.symbol} className="border-t border-gray-800 hover:bg-gray-900 transition">
                <td className="px-3 py-3 font-bold text-white">
                  <a href={`https://finviz.com/quote.ashx?t=${t.symbol}`} target="_blank" className="hover:text-yellow-400 transition">
                    {t.symbol}
                  </a>
                </td>
                <td className="px-3 py-3 text-gray-300 max-w-[200px] truncate">{t.name || '—'}</td>
                <td className="px-3 py-3 text-gray-400 text-xs">{t.exchange || '—'}</td>
                <td className="px-3 py-3 font-mono text-gray-200">{t.price ? `$${t.price}` : '—'}</td>
                <td className="px-3 py-3 font-mono text-gray-400">{t.avg_volume ? (t.avg_volume / 1000).toFixed(0) + 'K' : '—'}</td>
                <td className="px-3 py-3 font-mono text-gray-400">{t.sma50 ? `$${t.sma50}` : '—'}</td>
                <td className="px-3 py-3 font-mono text-gray-400">{t.sma200 ? `$${t.sma200}` : '—'}</td>
                <td className="px-3 py-3 text-gray-500 text-xs">{t.updated_at ? new Date(t.updated_at).toLocaleDateString('it-IT') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
