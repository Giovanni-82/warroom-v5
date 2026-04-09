'use client'
import { useEffect, useState, useCallback } from 'react'

interface PostmarketEntry {
  symbol: string
  last_price: number
  change_pct: number
  volume_afterhours: number
  open_afterhours?: number
  last_updated: string
  candidate?: boolean
  catalyst?: string
}

const WATCHLIST_KEY = 'wr_postmarket_watchlist'

export default function PostmarketPage() {
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [data, setData] = useState<PostmarketEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [addInput, setAddInput] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string>('')
  const [mode, setMode] = useState<'postmarket' | 'premarket'>('postmarket')

  useEffect(() => {
    const saved = localStorage.getItem(WATCHLIST_KEY)
    if (saved) setWatchlist(JSON.parse(saved))
  }, [])

  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist))
  }, [watchlist])

  const refresh = useCallback(async () => {
    if (watchlist.length === 0) return
    setLoading(true)
    try {
      const r = await fetch('/api/postmarket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: watchlist, type: mode })
      })
      const d = await r.json()
      setData(Array.isArray(d) ? d : [])
      setLastRefresh(new Date().toLocaleTimeString('it-IT'))
    } catch {}
    setLoading(false)
  }, [watchlist, mode])

  useEffect(() => {
    if (watchlist.length > 0) refresh()
  }, [watchlist, mode])

  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(refresh, 60000) // ogni minuto
    return () => clearInterval(t)
  }, [autoRefresh, refresh])

  function addToWatchlist() {
    const sym = addInput.toUpperCase().trim()
    if (!sym || watchlist.includes(sym)) return
    setWatchlist(prev => [...prev, sym])
    setAddInput('')
  }

  function removeFromWatchlist(sym: string) {
    setWatchlist(prev => prev.filter(s => s !== sym))
    setData(prev => prev.filter(d => d.symbol !== sym))
  }

  async function addToPipeline(entry: PostmarketEntry) {
    const today = new Date().toISOString().split('T')[0]
    await fetch('/api/ticker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: entry.symbol,
        status: 'SCOVATO',
        price_at_scan: entry.last_price,
        entry_window: mode === 'premarket' ? 'PREMKT' : 'POSTMKT',
        session_date: today,
        notes: `${mode === 'premarket' ? 'PreMkt' : 'PostMkt'} ${entry.change_pct > 0 ? '+' : ''}${entry.change_pct.toFixed(1)}%`
      })
    })
    alert(`${entry.symbol} aggiunto alla Pipeline!`)
  }

  const sorted = [...data].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">
            {mode === 'premarket' ? '🌅 Pre-Market Monitor' : '🌙 Post-Market Monitor'}
          </h1>
          <p className="text-gray-400 text-sm">
            {lastRefresh ? `Ultimo aggiornamento: ${lastRefresh}` : 'Dati after-hours live via Polygon.io'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setMode(m => m === 'premarket' ? 'postmarket' : 'premarket')}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition"
          >
            {mode === 'premarket' ? '→ PostMarket' : '→ PreMarket'}
          </button>
          <button
            onClick={() => setAutoRefresh(a => !a)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition ${autoRefresh ? 'bg-green-700 text-green-100' : 'bg-gray-700 text-gray-300'}`}
          >
            {autoRefresh ? '🟢 Auto ON' : '⚪ Auto OFF'}
          </button>
          <button
            onClick={refresh}
            disabled={loading || watchlist.length === 0}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-bold px-4 py-2 rounded-lg text-sm transition"
          >
            {loading ? '⏳' : '↻ Aggiorna'}
          </button>
        </div>
      </div>

      {/* Aggiungi ticker */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-gray-300 text-sm font-bold mb-3">Watchlist {mode}</h2>
        <div className="flex gap-2 mb-3">
          <input
            value={addInput}
            onChange={e => setAddInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addToWatchlist()}
            placeholder="Aggiungi ticker (es. FGNX)..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
          />
          <button onClick={addToWatchlist} className="bg-yellow-500 text-black font-bold px-4 py-2 rounded-lg text-sm">
            + Aggiungi
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {watchlist.map(sym => (
            <div key={sym} className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1">
              <span className="text-white text-sm font-bold">{sym}</span>
              <button onClick={() => removeFromWatchlist(sym)} className="text-gray-500 hover:text-red-400 ml-1 text-xs">×</button>
            </div>
          ))}
          {watchlist.length === 0 && <span className="text-gray-500 text-sm italic">Aggiungi ticker alla watchlist</span>}
        </div>
      </div>

      {/* Dati */}
      {sorted.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">📡</div>
          <p>{watchlist.length === 0 ? 'Aggiungi ticker alla watchlist per monitorarli.' : 'Nessun dato disponibile. Clicca Aggiorna.'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sorted.map(entry => {
            const isUp = entry.change_pct >= 0
            const isStrong = Math.abs(entry.change_pct) >= 5
            return (
              <div
                key={entry.symbol}
                className={`bg-gray-900 border rounded-xl p-4 flex items-center gap-4 transition ${isStrong ? (isUp ? 'border-green-700' : 'border-red-700') : 'border-gray-800'}`}
              >
                <div className="text-3xl">{isUp ? '📈' : '📉'}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-white text-xl">{entry.symbol}</span>
                    <span className={`text-2xl font-mono font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                      {isUp ? '+' : ''}{entry.change_pct.toFixed(2)}%
                    </span>
                    {isStrong && isUp && (
                      <span className="bg-green-900 text-green-300 text-xs px-2 py-0.5 rounded-full border border-green-700 font-bold animate-pulse">
                        ⚡ FORTE
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-gray-400">
                    <span>💵 ${entry.last_price?.toFixed(4)}</span>
                    {entry.volume_afterhours && (
                      <span>📊 Vol: {(entry.volume_afterhours / 1000).toFixed(0)}K</span>
                    )}
                    <span className="text-gray-500 text-xs">{entry.last_updated ? new Date(entry.last_updated).toLocaleTimeString('it-IT') : ''}</span>
                  </div>
                  {mode === 'premarket' && isUp && entry.change_pct >= 5 && (
                    <div className="mt-1 text-yellow-400 text-xs">
                      ⚠️ Gap elevato — verifica se è PRIMA o DOPO l'esplosione
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => addToPipeline(entry)}
                    className="bg-yellow-700 hover:bg-yellow-600 text-yellow-100 text-xs px-3 py-1.5 rounded-lg font-bold transition"
                  >
                    + Pipeline
                  </button>
                  <a
                    href={`https://www.tradingview.com/chart/?symbol=${entry.symbol}`}
                    target="_blank"
                    className="bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs px-3 py-1.5 rounded-lg transition text-center"
                  >
                    Chart →
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
