import { NextRequest, NextResponse } from 'next/server'
import { computeCTI, batchCTI, CTIInput } from '@/lib/formulaMagica'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()
const POLYGON = process.env.POLYGON_API_KEY!

async function enrichWithPolygon(symbol: string): Promise<Partial<CTIInput>> {
  try {
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${POLYGON}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const d = await r.json()
    const t = d.ticker
    if (!t) return {}
    return {
      price: t.day?.c || t.lastTrade?.p || 0,
      prevClose: t.prevDay?.c || 0,
      open: t.day?.o || 0,
      high: t.day?.h || 0,
      low: t.day?.l || 0,
      volume: t.day?.v || 0,
      avgVolume30d: t.prevDay?.v || 1,
      vwap: t.day?.vw || undefined
    }
  } catch { return {} }
}

async function getSMA(symbol: string): Promise<{ sma50?: number; sma200?: number; week52High?: number; week52Low?: number }> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - 260 * 86400000).toISOString().split('T')[0]
    const r = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${today}?adjusted=true&sort=asc&limit=260&apiKey=${POLYGON}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const d = await r.json()
    const closes = (d.results || []).map((b: any) => b.c)
    if (closes.length < 50) return {}
    const sma50 = closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50
    const sma200 = closes.length >= 200 ? closes.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200 : undefined
    const week52 = closes.slice(-252)
    return {
      sma50, sma200,
      week52High: Math.max(...week52),
      week52Low: Math.min(...week52)
    }
  } catch { return {} }
}

// GET /api/cti?symbol=ELAB — calcola CTI per un ticker
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')?.toUpperCase()
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  const [priceData, smaData] = await Promise.all([enrichWithPolygon(symbol), getSMA(symbol)])

  // Cerca catalyst nel sweep di oggi
  const today = new Date().toISOString().split('T')[0]
  const { data: sweepEntry } = await db().from('sweep_results').select('*').eq('sweep_date', today).eq('symbol', symbol).single()

  const input: CTIInput = {
    symbol,
    price: priceData.price || 0,
    prevClose: priceData.prevClose || 0,
    open: priceData.open || 0,
    high: priceData.high || 0,
    low: priceData.low || 0,
    volume: priceData.volume || 0,
    avgVolume30d: priceData.avgVolume30d || 1,
    vwap: priceData.vwap,
    ...smaData,
    hasCatalyst: !!sweepEntry,
    catalystType: (sweepEntry?.catalyst_type as any) || undefined,
    catalystDaysAway: sweepEntry ? Math.ceil((new Date(sweepEntry.catalyst_date).getTime() - Date.now()) / 86400000) : undefined,
    marketCap: 0
  }

  const result = computeCTI(input)

  // Salva nella pipeline se score >= 65
  if (result.score >= 65) {
    await db().from('pipeline').upsert({
      session_date: today,
      symbol,
      status: result.verdict === 'GO' ? 'AGGANCIATO' : 'SCOVATO',
      catalyst_type: sweepEntry?.catalyst_type || 'OTHER',
      catalyst_desc: sweepEntry?.catalyst_desc || `CTI ${result.score}/100`,
      entry_window: result.entry_window,
      formula_score: result.score,
      ai_verdict: result.verdict,
      ai_rationale: result.signals.join(' | '),
      bsl_price: result.bsl,
      stop_price: result.stop,
      target_price: result.target,
      target_pct: 10,
      price_at_scan: input.price,
      rvol: priceData.volume && priceData.avgVolume30d ? parseFloat((priceData.volume / priceData.avgVolume30d).toFixed(2)) : 0,
      notes: `CTI auto-calcolato ${new Date().toLocaleTimeString('it-IT')}`
    }, { onConflict: 'session_date,symbol' })
  }

  return NextResponse.json({ ...result, input })
}

// POST /api/cti — batch CTI su lista ticker
export async function POST(req: NextRequest) {
  const { symbols } = await req.json()
  if (!symbols?.length) return NextResponse.json([])
  const results = await Promise.allSettled(
    symbols.slice(0, 20).map(async (sym: string) => {
      const price = await enrichWithPolygon(sym)
      return computeCTI({
        symbol: sym, price: price.price || 0, prevClose: price.prevClose || 0,
        open: price.open || 0, high: price.high || 0, low: price.low || 0,
        volume: price.volume || 0, avgVolume30d: price.avgVolume30d || 1,
        hasCatalyst: false, marketCap: 0
      })
    })
  )
  return NextResponse.json(
    results.filter(r => r.status === 'fulfilled').map(r => (r as any).value).sort((a, b) => b.score - a.score)
  )
}
