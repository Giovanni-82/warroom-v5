import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { computeCTI } from '@/lib/formulaMagica'

const db = () => createServerClient()
const POLYGON = process.env.POLYGON_API_KEY!
const CRON_SECRET = process.env.CRON_SECRET || 'warroom-cron-2030'

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get('secret') !== CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const today = new Date().toISOString().split('T')[0]
  const results: any[] = []
  try {
    const r = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON}`, { signal: AbortSignal.timeout(15000) })
    const d = await r.json()
    const candidates = (d.tickers || []).filter((t: any) => {
      const price = t.day?.c || 0; const prevClose = t.prevDay?.c || 1
      const gap = ((price - prevClose) / prevClose) * 100
      const vol = t.day?.v || 0; const rvol = vol / Math.max(t.prevDay?.v || 1, 1)
      return price >= 1 && price <= 10 && gap >= 10 && vol >= 50000 && rvol >= 2
    })
    for (const t of candidates.slice(0, 15)) {
      const price = t.day?.c || 0; const vol = t.day?.v || 0; const prevClose = t.prevDay?.c || 1
      const gap = ((price - prevClose) / prevClose) * 100; const rvol = vol / Math.max(t.prevDay?.v || 1, 1)
      const cti = computeCTI({ symbol: t.ticker, price, prevClose, open: t.day?.o || price, high: t.day?.h || price, low: t.day?.l || price, volume: vol, avgVolume30d: t.prevDay?.v || vol, hasCatalyst: false, catalystDaysAway: 0, marketCap: 0 })
      if (cti.score < 40) continue
      await db().from('pipeline').upsert({
        session_date: today, symbol: t.ticker, status: cti.score >= 75 ? 'AGGANCIATO' : 'SCOVATO',
        catalyst_desc: `PRE-MKT AUTO: Gap +${gap.toFixed(1)}% RVOL ${rvol.toFixed(0)}x | CTI ${cti.score}`,
        entry_window: 'PREMKT', formula_score: cti.score, ai_verdict: cti.verdict,
        ai_rationale: cti.signals.slice(0, 3).join(' | '),
        bsl_price: cti.bsl, stop_price: cti.stop, target_price: cti.target, target_pct: 10,
        price_at_scan: price, rvol: parseFloat(rvol.toFixed(2)),
        notes: `Auto pre-market ${new Date().toLocaleTimeString('it-IT')}`
      }, { onConflict: 'session_date,symbol' })
      results.push({ symbol: t.ticker, score: cti.score, verdict: cti.verdict })
    }
    return NextResponse.json({ ok: true, scanned: candidates.length, inserted: results.length, results })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
