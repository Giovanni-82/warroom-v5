import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()
const POLYGON = process.env.POLYGON_API_KEY!
const CRON_SECRET = process.env.CRON_SECRET || 'warroom-cron-2030'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

function getLevel(catalystType: string, score: number, horizon: string): string {
  if (horizon === 'SWINGY') return 'L3e'
  if (horizon === 'SWING6M') return 'L3d'
  if (horizon === 'SWING1M') return 'L3c'
  if (horizon === 'SWING2W') return 'L3b'
  if (horizon === 'SWING1W') return 'L3a'
  if (score >= 85) return 'L1'
  if (score >= 65) return 'L2'
  return 'L0'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const manual = searchParams.get('secret') === CRON_SECRET
  if (!manual && req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const results: any = { steps: [], errors: [], started_at: new Date().toISOString() }
  const today = new Date().toISOString().split('T')[0]
  console.log('=== CRON NOTTURNO v3 ===', today)

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
    results.steps.push({ step: 'sweep', total: d.total })
  } catch (e: any) { results.errors.push({ step: 'sweep', error: e.message }) }

  // STEP 3: Analisi AI profonda su tutti i candidati sweep
  try {
    const { data: sweepItems } = await db()
      .from('sweep_results').select('*')
      .eq('sweep_date', today).gte('formula_score', 55)
      .order('formula_score', { ascending: false }).limit(25)

    console.log(`STEP 3: Analisi su ${sweepItems?.length || 0} candidati`)
    let analyzed = 0, pipelined = 0

    for (const item of sweepItems || []) {
      try {
        const r = await fetch(`${APP_URL}/api/analyze-deep?symbol=${item.symbol}`, { signal: AbortSignal.timeout(45000) })
        const a = await r.json()
        if (a.error || !a.verdict) continue
        analyzed++
        const price = a.price || 0
        const level = getLevel(item.catalyst_type, item.formula_score, item.recommended_horizon)

        // Pipeline
        if (a.verdict !== 'NO') {
          await db().from('pipeline').upsert({
            session_date: today, symbol: item.symbol,
            status: a.verdict === 'GO' ? 'AGGANCIATO' : 'SCOVATO',
            catalyst_type: item.catalyst_type, catalyst_desc: item.catalyst_desc,
            formula_score: item.formula_score, ai_verdict: a.verdict,
            ai_rationale: a.analysis?.slice(0, 600) || '',
            bsl_price: price > 0 ? parseFloat((price * 1.01).toFixed(4)) : null,
            stop_price: price > 0 ? parseFloat((price * 0.92).toFixed(4)) : null,
            target_price: price > 0 ? parseFloat((price * 1.10).toFixed(4)) : null,
            target_pct: 10, price_at_scan: price,
            entry_window: item.recommended_horizon === 'INTRADAY' ? 'PREMKT' : 'SWING',
            notes: `AI notturna ${today}`
          }, { onConflict: 'session_date,symbol' })
          pipelined++
        }

        // Classifiche — popola tutti i livelli
        await db().from('classifiche_rendimento').upsert({
          symbol: item.symbol, level, entry_date: today, session_date: today,
          entry_price: price, current_price: price, target_pct: 10, stop_pct: -8,
          status: 'WATCHING', catalyst: item.catalyst_desc?.slice(0, 200),
          trade_done: false, source: 'AUTO_NIGHTLY',
          notes: `${a.verdict} | Score ${item.formula_score} | ${item.catalyst_type}`
        }, { onConflict: 'session_date,symbol' })

        await new Promise(r => setTimeout(r, 2000))
      } catch (e: any) { console.log(`Errore ${item.symbol}:`, e.message) }
    }
    results.steps.push({ step: 'deep_analysis', analyzed, pipelined })
    console.log(`STEP 3: ${analyzed} analisi, ${pipelined} in pipeline`)
  } catch (e: any) { results.errors.push({ step: 'deep_analysis', error: e.message }) }

  // STEP 4: SMA50/200
  try {
    const { data: top } = await db().from('universe_tickers').select('symbol').order('avg_volume', { ascending: false }).limit(20).gt('avg_volume', 0)
    const from200 = new Date(Date.now() - 210 * 86400000).toISOString().split('T')[0]
    let processed = 0
    for (const { symbol } of top || []) {
      try {
        const r = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from200}/${today}?adjusted=true&sort=asc&limit=210&apiKey=${POLYGON}`, { signal: AbortSignal.timeout(5000) })
        const d = await r.json()
        const closes = (d.results || []).map((b: any) => b.c)
        if (closes.length >= 50) {
          const sma50 = closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50
          const sma200 = closes.length >= 200 ? closes.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200 : null
          await db().from('universe_tickers').update({ sma50: parseFloat(sma50.toFixed(4)), sma200: sma200 ? parseFloat(sma200.toFixed(4)) : null }).eq('symbol', symbol)
          processed++
        }
        await new Promise(r => setTimeout(r, 12000))
      } catch {}
    }
    results.steps.push({ step: 'sma', processed })
  } catch (e: any) { results.errors.push({ step: 'sma', error: e.message }) }

  // STEP 5: OHLCV storia
  try {
    const { data: progress } = await db().from('learned_rules').select('rule_text').eq('category', 'SYSTEM_PROGRESS').maybeSingle()
    const offset = parseInt(progress?.rule_text || '0')
    const { data: batch } = await db().from('universe_tickers').select('symbol').order('avg_volume', { ascending: false }).range(offset, offset + 29)
    let stored = 0
    for (const { symbol } of batch || []) {
      try {
        const r = await fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/2010-01-01/${today}?adjusted=true&sort=asc&limit=50000&apiKey=${POLYGON}`, { signal: AbortSignal.timeout(10000) })
        const d = await r.json()
        if ((d.results || []).length > 0) {
          const rows = d.results.map((b: any) => ({ symbol, date: new Date(b.t).toISOString().split('T')[0], open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v, vwap: b.vw || null }))
          for (let i = 0; i < rows.length; i += 1000) await db().from('ohlcv_history').upsert(rows.slice(i, i + 1000), { onConflict: 'symbol,date', ignoreDuplicates: true })
          stored++
        }
        await new Promise(r => setTimeout(r, 12000))
      } catch {}
    }
    const newOffset = (offset + 30) >= 12500 ? 0 : offset + 30
    await db().from('learned_rules').upsert({ rule_text: String(newOffset), category: 'SYSTEM_PROGRESS', active: true, rule_date: today }, { onConflict: 'category' })
    results.steps.push({ step: 'ohlcv', stored, progress: ((newOffset / 12500) * 100).toFixed(1) + '%' })
  } catch (e: any) { results.errors.push({ step: 'ohlcv', error: e.message }) }

  results.completed_at = new Date().toISOString()
  return NextResponse.json(results)
}
