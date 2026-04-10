import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { computeCTI } from '@/lib/formulaMagica'

const db = () => createServerClient()
const POLYGON = process.env.POLYGON_API_KEY!
const CRON_SECRET = process.env.CRON_SECRET || 'warroom-cron-2030'

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get('secret') !== CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const today = new Date().toISOString().split('T')[0]
  const alerts: any[] = []

  // 1. Aggiorna prezzi e genera alert per ticker in pipeline
  const { data: pipelineItems } = await db().from('pipeline').select('*').eq('session_date', today).in('status', ['AGGANCIATO', 'CECCHINATO_FATTO'])
  if (pipelineItems && pipelineItems.length > 0) {
    const symbols = pipelineItems.map((p: any) => p.symbol).join(',')
    try {
      const r = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${symbols}&apiKey=${POLYGON}`, { signal: AbortSignal.timeout(10000) })
      const d = await r.json()
      for (const t of d.tickers || []) {
        const price = t.day?.c || 0
        const item = pipelineItems.find((p: any) => p.symbol === t.ticker)
        if (!item) continue
        if (item.bsl_price && price >= item.bsl_price * 1.05) alerts.push({ type: 'FREE_TRADE', symbol: t.ticker, price, notes: `🟡 FREE TRADE: ${t.ticker} $${price} — sposta stop a breakeven!` })
        if (item.target_price && price >= item.target_price) alerts.push({ type: 'TARGET_HIT', symbol: t.ticker, price, notes: `🎯 TARGET: ${t.ticker} $${price} — considera uscita!` })
        if (item.stop_price && price <= item.stop_price) alerts.push({ type: 'STOP_HIT', symbol: t.ticker, price, notes: `🔴 STOP: ${t.ticker} $${price} — CHIUDI POSIZIONE!` })
      }
    } catch {}
  }

  // 2. Nuovi candidati intraday con CTI
  try {
    const r = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON}`, { signal: AbortSignal.timeout(10000) })
    const d = await r.json()
    const { data: existing } = await db().from('pipeline').select('symbol').eq('session_date', today)
    const existingSymbols = new Set((existing || []).map((p: any) => p.symbol))
    const newCandidates = (d.tickers || []).filter((t: any) => {
      const price = t.day?.c || 0; const rvol = (t.day?.v || 0) / Math.max(t.prevDay?.v || 1, 1)
      return price >= 1 && price <= 10 && (t.day?.changePercent || 0) >= 10 && rvol >= 3 && (t.day?.v || 0) >= 200000 && !existingSymbols.has(t.ticker)
    }).slice(0, 8)
    for (const t of newCandidates) {
      const price = t.day?.c || 0; const vol = t.day?.v || 0; const change = t.day?.changePercent || 0; const rvol = vol / Math.max(t.prevDay?.v || 1, 1)
      const cti = computeCTI({ symbol: t.ticker, price, prevClose: t.prevDay?.c || price, open: t.day?.o || price, high: t.day?.h || price, low: t.day?.l || price, volume: vol, avgVolume30d: t.prevDay?.v || vol, hasCatalyst: false, marketCap: 0 })
      await db().from('pipeline').insert({ session_date: today, symbol: t.ticker, status: 'SCOVATO', catalyst_desc: `INTRADAY AUTO: +${change.toFixed(1)}% RVOL ${rvol.toFixed(0)}x CTI ${cti.score}`, entry_window: 'INTRADAY', formula_score: cti.score, ai_verdict: cti.verdict, ai_rationale: cti.signals.slice(0, 2).join(' | '), bsl_price: cti.bsl, stop_price: cti.stop, target_price: cti.target, target_pct: 10, price_at_scan: price, rvol: parseFloat(rvol.toFixed(2)), notes: `Intraday auto ${new Date().toLocaleTimeString('it-IT')}` })
      alerts.push({ type: 'NEW_CANDIDATE', symbol: t.ticker, price, notes: `⚡ NUOVO: ${t.ticker} +${change.toFixed(1)}% CTI ${cti.score} — aggiunto Pipeline` })
    }
  } catch {}

  if (alerts.length > 0) {
    await db().from('postmarket_alerts').insert(alerts.map(a => ({ symbol: a.symbol, price: a.price || 0, alert_type: a.type, notes: a.notes })))
  }
  return NextResponse.json({ ok: true, alerts: alerts.length, details: alerts })
}
