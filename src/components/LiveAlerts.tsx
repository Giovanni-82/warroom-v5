'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Alert {
  id: number
  symbol: string
  price: number
  alert_type: string
  notes: string
  alert_time: string
}

const ALERT_STYLE: Record<string, string> = {
  FREE_TRADE: 'border-yellow-600 bg-yellow-950',
  TARGET_HIT: 'border-green-600 bg-green-950',
  STOP_HIT: 'border-red-600 bg-red-950',
  NEW_CANDIDATE: 'border-blue-600 bg-blue-950',
  MOVE_UP: 'border-green-700 bg-green-950',
}

const ALERT_ICON: Record<string, string> = {
  FREE_TRADE: '🟡',
  TARGET_HIT: '🎯',
  STOP_HIT: '🔴',
  NEW_CANDIDATE: '⚡',
  MOVE_UP: '📈',
}

export function LiveAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    loadAlerts()
    // Realtime subscription via Supabase
    const channel = supabase
      .channel('alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'postmarket_alerts'
      }, (payload) => {
        setAlerts(prev => [payload.new as Alert, ...prev].slice(0, 20))
        setUnread(n => n + 1)
        // Suono notifica
        if (typeof window !== 'undefined') {
          try { new Audio('/notification.mp3').play() } catch {}
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadAlerts() {
    const { data } = await supabase
      .from('postmarket_alerts')
      .select('*')
      .order('alert_time', { ascending: false })
      .limit(20)
    setAlerts(data || [])
  }

  function clearUnread() { setUnread(0) }

  if (alerts.length === 0) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4" onClick={clearUnread}>
        <div className="flex items-center gap-2">
          <h2 className="text-white font-bold text-sm">🔔 Alert Live</h2>
          {unread > 0 && (
            <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
              {unread} nuovi
            </span>
          )}
        </div>
        <span className="text-gray-500 text-xs">aggiornamento automatico</span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {alerts.map(alert => (
          <div key={alert.id} className={`border rounded-xl px-4 py-3 text-sm ${ALERT_STYLE[alert.alert_type] || 'border-gray-700 bg-gray-800'}`}>
            <div className="flex items-center gap-2">
              <span>{ALERT_ICON[alert.alert_type] || '📢'}</span>
              <span className="font-bold text-white">{alert.symbol}</span>
              {alert.price > 0 && <span className="text-gray-300 font-mono">${alert.price}</span>}
              <span className="text-gray-400 text-xs ml-auto">
                {new Date(alert.alert_time).toLocaleTimeString('it-IT')}
              </span>
            </div>
            {alert.notes && (
              <div className="text-gray-300 text-xs mt-1">{alert.notes}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
