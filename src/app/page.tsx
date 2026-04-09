'use client'
import { useEffect, useState } from 'react'

const MILIONE_TARGET = 1000000
const STARTING_CAPITAL = 58000 + 50000

export default function Dashboard() {
  const [pnl, setPnl] = useState({ total_pnl_eur: -172, wins: 0, losses: 0, total_done: 0, win_rate: '0', to_million: 0 })
  const [rules, setRules] = useState<any[]>([])
  const [sweepCount, setSweepCount] = useState(0)
  const [pipelineCount, setPipelineCount] = useState(0)

  useEffect(() => {
    fetch('/api/trades', { method: 'PUT' }).then(r => r.json()).then(setPnl).catch(() => {})
    fetch('/api/sweep?date=' + new Date().toISOString().split('T')[0]).then(r => r.json()).then(d => setSweepCount(Array.isArray(d) ? d.length : 0)).catch(() => {})
    fetch('/api/ticker?date=' + new Date().toISOString().split('T')[0]).then(r => r.json()).then(d => setPipelineCount(Array.isArray(d) ? d.length : 0)).catch(() => {})
  }, [])

  const toward = STARTING_CAPITAL + pnl.total_pnl_eur
  const pct = Math.min((toward / MILIONE_TARGET) * 100, 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🎯 WarRoom v5.0</h1>
          <p className="text-gray-400 text-sm">Operazione Milione 2030 — Fronte 3 Cecchini v2.4</p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-mono font-bold ${pnl.total_pnl_eur >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pnl.total_pnl_eur >= 0 ? '+' : ''}€{pnl.total_pnl_eur.toFixed(0)}
          </div>
          <div className="text-gray-400 text-xs">P&L cumulativo Fronte 3</div>
        </div>
      </div>

      {/* Barra verso il milione */}
      <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
        <div className="flex justify-between mb-2">
          <span className="text-gray-400 text-sm">Percorso verso €1.000.000</span>
          <span className="text-yellow-400 font-mono text-sm">€{toward.toLocaleString('it-IT')} / €1.000.000</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>{pct.toFixed(2)}% completato</span>
          <span>Mancano €{(MILIONE_TARGET - toward).toLocaleString('it-IT')} — Dic 2030</span>
        </div>
      </div>

      {/* Stats rapide */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Trade fatti', value: pnl.total_done, color: 'text-white' },
          { label: 'Win rate', value: `${pnl.win_rate}%`, color: 'text-green-400' },
          { label: 'Sweep oggi', value: sweepCount, color: 'text-blue-400' },
          { label: 'Pipeline oggi', value: pipelineCount, color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-gray-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Protocollo Cecchini v2.4 */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h2 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">📋 Protocollo Cecchini v2.4</h2>
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          {[
            ['REGOLA ZERO', 'Prezzo $1–$10 tassativo. Nessuna eccezione.'],
            ['STOP LOSS', '−8% SEMPRE simultaneo all\'entrata'],
            ['FREE TRADE', 'A +5% → sposta stop a breakeven immediatamente'],
            ['TIME STOP L2', '15:45 IT assoluto, nessuna eccezione'],
            ['SIZING FASE 1', '€1.000/trade, un solo trade al giorno'],
            ['RVOL DINAMICO', 'Gap >30% → soglia RVOL min scende a 2x'],
            ['SINGLE BULLET', 'Stop hit = piattaforma chiusa, zero revenge'],
            ['FORMULA MAGICA', 'Vol silenzioso 3-5gg + compressione + catalyst IN ARRIVO'],
            ['BSL OFFSET', '<50x +$0.05 | 50-200x +$0.15 | >200x +$0.30'],
            ['L1 DOUBLE CHECK', '15:28: prezzo < premarket high E sopra VWAP'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-yellow-400 font-bold min-w-[110px]">{k}</span>
              <span className="text-gray-300">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Regole apprese dal sistema */}
      <div className="bg-gray-900 border border-yellow-900 rounded-2xl p-5">
        <h2 className="text-yellow-400 font-bold mb-3 text-sm uppercase tracking-wider">🧠 Regole apprese dal sistema</h2>
        {rules.length === 0 ? (
          <p className="text-gray-500 text-sm italic">Nessuna regola ancora codificata. Si popolerà dopo la Camera di Analisi.</p>
        ) : (
          <div className="space-y-2">
            {rules.map(r => (
              <div key={r.id} className="flex gap-3 text-sm">
                <span className="text-gray-500 text-xs min-w-[80px]">{r.rule_date}</span>
                <span className="text-gray-200">{r.rule_text}</span>
                {r.source_ticker && <span className="text-yellow-600 text-xs">({r.source_ticker})</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/sweep', label: '🔍 Avvia Sweep', desc: 'Scansione notturna' },
          { href: '/pipeline', label: '🎯 Pipeline', desc: 'Candidati di oggi' },
          { href: '/analisi', label: '🖼️ Analisi Screenshot', desc: 'Carica TradingView' },
          { href: '/camera', label: '🔬 Camera', desc: 'Review post-sessione' },
        ].map(a => (
          <a key={a.href} href={a.href} className="bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-yellow-600 rounded-xl p-4 transition-all">
            <div className="font-bold text-white text-sm">{a.label}</div>
            <div className="text-gray-400 text-xs mt-1">{a.desc}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
