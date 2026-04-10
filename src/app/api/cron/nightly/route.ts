import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()
const POLYGON = process.env.POLYGON_API_KEY!
const CRON_SECRET = process.env.CRON_SECRET || 'warroom-cron-2030'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const manual = searchParams.get('secret') === CRON_SECRET
  if (!manual && req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const results: any = { steps: [], errors: [], started_at: new Date().toISOString() }
  const today = new Date().toISOString().split('T')[0]

  // STEP 1: Snapshot prezzi
  try {
    const r = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON}`, { signal: AbortSignal.timeout(30000) })
    const d = await r.json()
    const tickers = (d.tickers || []).filter((t: any) => (t.day?.c || 0) > 0)
    let updated = 0
    for (let i = 0; i < tickers.length; i += 500) {
      const batch = tickers.slice(i, i + 500).map((t: any) => ({ symbol: t.ticker, price: t.day?.c || 0, avg_volume: t.day?.v || 0, updated_at: new Date().toISOString() }))
      const { error } = await db().from('universe_tickers').upsert(batch, { onConflict: 'symbol' })
      if (!error) updated += batch.length
    }
    results.steps.push({ step: 'snapshot', updated })
  } catch (e: any) { results.errors.push({ step: 'snapshot', error: e.message }) }

  // STEP 2: Sweep
  try {
    const r = await fetch(`${APP_URL}/api/sweep`, { method: 'POST', signal: AbortSignal.timeout(30000) })
    const d = await r.json()
    results.steps.push({ step: 'sweep', ...d })
  } catch (e: any) { results.errors.push({ step: 'sweep', error: e.message }) }

  // STEP 3: Auto-pipeline dai candidati sweep
  try {
    const { data: sweepItems } = await db().from('sweep_results').select('*').eq('sweep_date', today).gte('formula_score', 65).order('formula_score', { ascending: false }).limit(20)
    let autopipelined = 0
    for (const item of sweepItems || []) {
      await db().from('pipeline').upsert({
        session_date: today, symbol: item.symbol, status: item.formula_score >= 80 ? 'AGGANCIATO' : 'SCOVATO',
        catalyst_type: item.catalyst_type, catalyst_desc: item.catalyst_desc,
        formula_score: item.formula_score, ai_verdict: item.formula_score >= 80 ? 'GO' : 'WATCH',
        ai_rationale: `Auto-sweep score ${item.formula_score}/100 | ${item.recommended_horizon}`,
        target_pct: 10, notes: `Auto-sweep ${today}`
      }, { onConflict: 'session_date,symbol' })
      autopipelined++
    }
    results.steps.push({ step: 'auto_pipeline', autopipelined })
  } catch (e: any) { results.errors.push({ step: 'auto_pipeline', error: e.message }) }

  // STEP 4: OHLCV batch notturno
  try {
    const { data: progress } = await db().from('learned_rules').select('rule_text').eq('category', 'SYSTEM_PROGRESS').maybeSingle()
    const offset = parseInt(progress?.rule_text || '0')
    const { data: batch } = await db().from('universe_tickers').select('symbol').order('avg_volume', { ascending: false }).range(offset, offset + 49)
    let stored = 0
    const from = '2010-01-01'; const to = today
    for (const { symbol } of (batch || [])) {
      try {
        const r = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${POLYGON}`, { signal: AbortSignal.timeout(10000) })
        const d = await r.json()
        if ((d.results || []).length > 0) {
          const rows = d.results.map((b: any) => ({ symbol, date: new Date(b.t).toISOString().split('T')[0], open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v, vwap: b.vw || null }))
          for (let i = 0; i < rows.length; i += 1000) await db().from('ohlcv_history').upsert(rows.slice(i, i + 1000), { onConflict: 'symbol,date', ignoreDuplicates: true })
          stored++
        }
        await new Promise(r => setTimeout(r, 12000))
      } catch {}
    }
    const newOffset = (offset + 50) >= 12500 ? 0 : offset + 50
    await db().from('learned_rules').upsert({ rule_text: String(newOffset), category: 'SYSTEM_PROGRESS', active: true, rule_date: today }, { onConflict: 'category' })
    results.steps.push({ step: 'ohlcv', stored, next_offset: newOffset, progress: ((newOffset / 12500) * 100).toFixed(1) + '%' })
  } catch (e: any) { results.errors.push({ step: 'ohlcv', error: e.message }) }

  results.completed_at = new Date().toISOString()
  return NextResponse.json(results)
}
