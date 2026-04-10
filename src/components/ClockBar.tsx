'use client'
import { useState, useEffect } from 'react'

function getPhase(etH: number, etM: number, day: number) {
  if (day === 0 || day === 6) return { label: 'CHIUSO — WEEKEND', color: 'text-gray-400' }
  const t = etH * 60 + etM
  if (t >= 240 && t < 570)  return { label: '🌅 PRE-MARKET', color: 'text-yellow-400' }
  if (t >= 570 && t < 960)  return { label: '🟢 MERCATO APERTO', color: 'text-green-400' }
  if (t >= 960 && t < 1200) return { label: '🌆 POST-MARKET', color: 'text-blue-400' }
  return { label: '⛔ CHIUSO', color: 'text-gray-500' }
}

export function ClockBar({ pnl = -172 }: { pnl?: number }) {
  const [tick, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 1000); return () => clearInterval(t) }, [])

  const now = new Date()
  const itStr = now.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const etStr = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const phase = getPhase(etDate.getHours(), etDate.getMinutes(), etDate.getDay())
  const dateStr = now.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })

  return (
    <div className="bg-gray-950 border-b border-gray-800 px-4 py-2 flex items-center justify-between text-sm flex-wrap gap-2">
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2">
          <span>🇮🇹</span>
          <span className="font-mono font-bold text-white text-base">{itStr}</span>
          <span className="text-gray-500 text-xs">IT • {dateStr}</span>
        </div>
        <div className="text-gray-700">|</div>
        <div className="flex items-center gap-2">
          <span>🇺🇸</span>
          <span className="font-mono font-bold text-white text-base">{etStr}</span>
          <span className="text-gray-500 text-xs">ET</span>
        </div>
        <span className={`font-bold text-sm ${phase.color}`}>{phase.label}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>WarRoom v5 • Cecchini v2.4</span>
        <span className={`font-mono font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          P&L: {pnl >= 0 ? '+' : ''}€{pnl}
        </span>
      </div>
    </div>
  )
}
