'use client'
import { useState } from 'react'

export function CronStatus() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<any>(null)

  async function runManual() {
    setRunning(true)
    setResult(null)
    try {
      const r = await fetch(`/api/cron/nightly?secret=${process.env.NEXT_PUBLIC_CRON_SECRET || 'warroom-cron-2030'}`)
      const d = await r.json()
      setResult(d)
    } catch (e: any) {
      setResult({ error: e.message })
    }
    setRunning(false)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-sm">⚙️ Cron Notturno</h2>
          <p className="text-gray-400 text-xs mt-1">Automatico ogni sera 22:00 IT su Vercel</p>
        </div>
        <button
          onClick={runManual}
          disabled={running}
          className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold transition"
        >
          {running ? '⏳ In esecuzione...' : '▶ Avvia ora'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 text-center text-xs mb-3">
        {[
          { label: 'Snapshot prezzi', icon: '💵', desc: 'Tutti i ticker' },
          { label: 'Sweep catalyst', icon: '🔍', desc: 'Candidati domani' },
          { label: 'SMA50/200', icon: '📈', desc: 'Top 100 ticker' },
          { label: 'Storia OHLCV', icon: '🏛️', desc: '50 ticker/notte' },
        ].map(s => (
          <div key={s.label} className="bg-gray-800 rounded-lg p-2">
            <div className="text-lg">{s.icon}</div>
            <div className="text-gray-300 font-medium mt-1">{s.label}</div>
            <div className="text-gray-500">{s.desc}</div>
          </div>
        ))}
      </div>

      {result && (
        <div className="bg-gray-800 rounded-lg p-3 text-xs">
          {result.error ? (
            <span className="text-red-400">{result.error}</span>
          ) : (
            <div className="space-y-1">
              {result.steps?.map((s: any, i: number) => (
                <div key={i} className="flex gap-2 text-gray-300">
                  <span className="text-green-400">✓</span>
                  <span>{s.step}: {JSON.stringify(s).slice(0, 80)}</span>
                </div>
              ))}
              {result.errors?.map((e: any, i: number) => (
                <div key={i} className="flex gap-2 text-red-400">
                  <span>✗</span>
                  <span>{e.step}: {e.error}</span>
                </div>
              ))}
              <div className="text-gray-500 mt-1">Completato: {result.completed_at}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
