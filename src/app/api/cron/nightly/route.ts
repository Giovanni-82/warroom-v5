import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()
const POLYGON = process.env.POLYGON_API_KEY!
const CRON_SECRET = process.env.CRON_SECRET || 'warroom-cron-2030'

// ============================================================
// CRON NOTTURNO — gira automaticamente ogni sera alle 22:00 IT
// Vercel chiama questa route via cron job configurato in vercel.json
// ============================================================

export async function GET(req: NextRequest) {
  // Sicurezza: solo Vercel cron o chiamata manuale con secret
  const auth = req.headers.get('authorization')
  const { searchParams } = new URL(req.url)
  const manual = searchParams.get('secret') === CRON_SECRET

  if (!manual && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: any = { steps: [], errors: [], started_at: new Date().toISOString() }
  console.log('=== CRON NOTTURNO AVVIATO ===', results.started_at)

  // ─────────────────────────────────────────────────────────
  // STEP 1: Snapshot completo tutti i ticker (1 chiamata sola)
  // ─────────────────────────────────────────────────────────
  try {
    console.log('STEP 1: Snapshot completo...')
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?apiKey=${POLYGON}`,
      { signal: AbortSignal.timeout(30000) }
    )
    const d = await r.json()
    const tickers = d.tickers || []
    console.log(`Snapshot: ${tickers.length} ticker ricevuti`)

    if (tickers.length > 0) {
      // Prepara batch da 500 per Supabase
      const toUpdate = tickers.map((t: any) => ({
        symbol: t.ticker,
        price: t.day?.c || t.lastTrade?.p || 0,
        avg_volume: t.day?.v || 0,
        updated_at: new Date().toISOString()
      })).filter((t: any) => t.price > 0)

      let updated = 0
      for (let i = 0; i < toUpdate.length; i += 500) {
        const batch = toUpdate.slice(i, i + 500)
        const { error } = await db()
          .from('universe_tickers')
          .upsert(batch, { onConflict: 'symbol', ignoreDuplicates: false })
        if (!error) updated += batch.length
      }
      results.steps.push({ step: 'snapshot', tickers_updated: updated })
      console.log(`STEP 1 completato: ${updated} ticker aggiornati`)
    }
  } catch (e: any) {
    results.errors.push({ step: 'snapshot', error: e.message })
    console.error('STEP 1 error:', e.message)
  }

  // ─────────────────────────────────────────────────────────
  // STEP 2: Sweep notturno automatico (catalyst per domani)
  // ─────────────────────────────────────────────────────────
  try {
    console.log('STEP 2: Sweep automatico...')
    const sweepRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/sweep`,
      { method: 'POST', signal: AbortSignal.timeout(30000) }
    )
    const sweepData = await sweepRes.json()
    results.steps.push({ step: 'sweep', result: sweepData })
    console.log('STEP 2 completato:', sweepData)
  } catch (e: any) {
    results.errors.push({ step: 'sweep', error: e.message })
    console.error('STEP 2 error:', e.message)
  }

  // ─────────────────────────────────────────────────────────
  // STEP 3: SMA50/200 per i top 500 ticker per volume
  // (rate limit rispettato: 5 call/min piano free)
  // ─────────────────────────────────────────────────────────
  try {
    console.log('STEP 3: SMA50/200 top ticker...')
    const { data: topTickers } = await db()
      .from('universe_tickers')
      .select('symbol')
      .order('avg_volume', { ascending: false })
      .limit(500)
      .gt('avg_volume', 0)

    if (topTickers && topTickers.length > 0) {
      let processed = 0
      const today = new Date().toISOString().split('T')[0]
      const from200 = new Date(Date.now() - 210 * 86400000).toISOString().split('T')[0]

      for (const { symbol } of topTickers.slice(0, 100)) {
        try {
          const r = await fetch(
            `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from200}/${today}?adjusted=true&sort=asc&limit=210&apiKey=${POLYGON}`,
            { signal: AbortSignal.timeout(5000) }
          )
          const d = await r.json()
          const closes = (d.results || []).map((b: any) => b.c)
          if (closes.length >= 50) {
            const sma50 = closes.slice(-50).reduce((a: number, b: number) => a + b, 0) / 50
            const sma200 = closes.length >= 200
              ? closes.slice(-200).reduce((a: number, b: number) => a + b, 0) / 200
              : null
            const week52High = Math.max(...closes.slice(-252))
            const week52Low = Math.min(...closes.slice(-252))
            await db().from('universe_tickers').update({
              sma50: parseFloat(sma50.toFixed(4)),
              sma200: sma200 ? parseFloat(sma200.toFixed(4)) : null,
              week52_high: parseFloat(week52High.toFixed(4)),
              week52_low: parseFloat(week52Low.toFixed(4))
            }).eq('symbol', symbol)
            processed++
          }
          // Rate limit: 5 call/min = 1 ogni 12 secondi (piano free)
          await new Promise(r => setTimeout(r, 12000))
        } catch {}
      }
      results.steps.push({ step: 'sma', processed })
      console.log(`STEP 3 completato: ${processed} SMA aggiornate`)
    }
  } catch (e: any) {
    results.errors.push({ step: 'sma', error: e.message })
    console.error('STEP 3 error:', e.message)
  }

  // ─────────────────────────────────────────────────────────
  // STEP 4: Storia OHLCV — 50 ticker alla volta (memoria storica)
  // Ogni notte elabora il batch successivo in sequenza
  // In ~250 notti avrà la storia completa di tutti i ticker
  // ─────────────────────────────────────────────────────────
  try {
    console.log('STEP 4: Storia OHLCV batch notturno...')
    const batchSize = 50
    // Recupera l'offset dell'ultima notte
    const { data: progress } = await db()
      .from('learned_rules')
      .select('rule_text')
      .eq('category', 'SYSTEM_PROGRESS')
      .single()
    const offset = parseInt(progress?.rule_text || '0')

    const { data: batch } = await db()
      .from('universe_tickers')
      .select('symbol')
      .order('avg_volume', { ascending: false })
      .range(offset, offset + batchSize - 1)

    if (batch && batch.length > 0) {
      let stored = 0
      const from = '2000-01-01'
      const to = new Date().toISOString().split('T')[0]

      for (const { symbol } of batch) {
        try {
          const r = await fetch(
            `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${POLYGON}`,
            { signal: AbortSignal.timeout(10000) }
          )
          const d = await r.json()
          if (d.results?.length > 0) {
            const rows = d.results.map((b: any) => ({
              symbol,
              date: new Date(b.t).toISOString().split('T')[0],
              open: b.o, high: b.h, low: b.l, close: b.c,
              volume: b.v, vwap: b.vw || null
            }))
            // Upsert in batch da 1000
            for (let i = 0; i < rows.length; i += 1000) {
              await db().from('ohlcv_history').upsert(
                rows.slice(i, i + 1000),
                { onConflict: 'symbol,date', ignoreDuplicates: true }
              )
            }
            stored++
          }
          await new Promise(r => setTimeout(r, 12000)) // rate limit
        } catch {}
      }

      // Salva progresso per la prossima notte
      const newOffset = offset + batchSize
      await db().from('learned_rules').upsert({
        rule_text: String(newOffset >= 12500 ? 0 : newOffset), // riparti da 0 quando finisce
        category: 'SYSTEM_PROGRESS',
        active: true,
        rule_date: new Date().toISOString().split('T')[0]
      }, { onConflict: 'category' })

      results.steps.push({ step: 'ohlcv', symbols_processed: stored, next_offset: newOffset })
      console.log(`STEP 4 completato: ${stored} ticker storicizzati, prossimo offset: ${newOffset}`)
    }
  } catch (e: any) {
    results.errors.push({ step: 'ohlcv', error: e.message })
    console.error('STEP 4 error:', e.message)
  }

  results.completed_at = new Date().toISOString()
  console.log('=== CRON NOTTURNO COMPLETATO ===', results)
  return NextResponse.json(results)
}
