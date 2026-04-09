'use client'
import { useState, useEffect } from 'react'

function getMarketStatus(etHour: number, etMin: number, etDay: number): { label: string; color: string } {
  if (etDay === 0 || etDay === 6) return { label: 'CHIUSO', color: 'text-gray-400' }
  const t = etHour * 60 + etMin
  if (t >= 240 && t < 570) return { label: 'PRE-MARKET', color: 'text-yellow-400' }
  if (t >= 570 && t < 960) return { label: 'MERCATO APERTO', color: 'text-green-400' }
  if (t >= 960 && t < 1200) return { label: 'POST-MARKET', color: 'text-blue-400' }
  return { label: 'CHIUSO', color: 'text-gray-400' }
}

export function ClockBar() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const itTime = now.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const etTime = now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const etDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const status = getMarketStatus(etDate.getHours(), etDate.getMinutes(), etDate.getDay())

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 flex items-center justify-between text-sm">
      <div className="flex items-center gap-6">
        <span className="font-mono text-white">🇮🇹 <strong>{itTime}</strong> CEST</span>
        <span className="font-mono text-white">🇺🇸 <strong>{etTime}</strong> ET</span>
        <span className={`font-bold ${status.color}`}>{status.label}</span>
      </div>
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <span>WarRoom v5.0</span>
        <span className="text-gray-600">|</span>
        <span>Cecchini v2.4</span>
        <span className="text-gray-600">|</span>
        <span className="text-yellow-400 font-mono">P&L: <strong id="pnl-display">−€172</strong></span>
      </div>
    </div>
  )
}
