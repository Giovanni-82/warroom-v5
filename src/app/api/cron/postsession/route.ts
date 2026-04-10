import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()
const POLYGON = process.env.POLYGON_API_KEY!
const CRON_SECRET = process.env.CRON_SECRET || 'warroom-cron-2030'

async function analyzeWithClaude(symbol: string, gainPct: number, wasInSweep: boolean, wasInPipeline: boolean): Promise<string> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: 'Sei 🏛️ CLAUDE analista WarRoom Cecchini v2.4. Analisi post-sessione. Rispondi in max 600 caratteri.',
        messages: [{ role: 'user', content: `POST-SESSIONE: ${symbol} +${gainPct.toFixed(1)}% oggi. Era nel sweep: ${wasInSweep ? 'SÌ' : 'NO'}. Era in pipeline: ${wasInPipeline ? 'SÌ' : 'NO'}. 1) Catalyst probabile? 2) Era intercettabile con sweep EDGAR? 3) Regola da codificare? Sii chirurgico.` }]
      }),
      signal: AbortSignal.timeout(30000)
    })
    const d = await res.json()
    return d.content?.[0]?.text || ''
  } catch { return '' }
}

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get('secret') !== CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const today = new Date().toISOString().split('T')[0]
  const gainers: any[] = []
  try {
    const r = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON}`, { signal: AbortSignal.timeout(15000) })
    const d = await r.json()
    const bigMovers = (d.tickers || []).filter((t: any) => (t.day?.changePercent || 0) >= 10 && (t.day?.c || 0) >= 0.5)
    const { data: sweepToday } = await db().from('sweep_results').select('symbol').eq('sweep_date', today)
    const { data: pipelineToday } = await db().from('pipeline').select('symbol').eq('session_date', today)
    const sweepSymbols = new Set((sweepToday || []).map((s: any) => s.symbol))
    const pipelineSymbols = new Set((pipelineToday || []).map((p: any) => p.symbol))
    for (const t of bigMovers.slice(0, 20)) {
      const symbol = t.ticker; const gainPct = t.day?.changePercent || 0
      const wasInSweep = sweepSymbols.has(symbol); const wasInPipeline = pipelineSymbols.has(symbol)
      const aiAnalysis = await analyzeWithClaude(symbol, gainPct, wasInSweep, wasInPipeline)
      const openPrice = t.day?.o || 0; const peakPrice = t.day?.h || 0
      const potentialGain = openPrice > 0 ? (Math.floor(1000 / openPrice) * (peakPrice - openPrice)) : 0
      await db().from('best_gainers').upsert({
        session_date: today, symbol, gain_pct: gainPct,
        open_price: openPrice, peak_price: peakPrice, close_price: t.day?.c || 0,
        catalyst_found: aiAnalysis.slice(0, 300),
        was_in_sweep: wasInSweep, was_in_pipeline: wasInPipeline,
        was_catchable: wasInSweep || wasInPipeline,
        potential_gain_eur: parseFloat(potentialGain.toFixed(2))
      }, { onConflict: 'session_date,symbol' })
      // Auto-popola classifiche
      await db().from('classifiche_rendimento').upsert({
        symbol, level: 'AUTO', status: 'MISSED', session_date: today,
        entry_date: today, entry_price: openPrice, virtual_result_pct: gainPct,
        catalyst: aiAnalysis.slice(0, 200), trade_done: false,
        source: 'AUTO_POSTSESSION',
        notes: `Auto post-sessione: +${gainPct.toFixed(1)}% | ${wasInSweep ? 'Nel sweep' : 'Non nel sweep'}`
      }, { onConflict: 'session_date,symbol' })
      gainers.push({ symbol, gainPct: gainPct.toFixed(1), wasInSweep, wasInPipeline, potentialGain: potentialGain.toFixed(0) })
      await new Promise(r => setTimeout(r, 2000))
    }
    return NextResponse.json({ ok: true, date: today, total: gainers.length, were_catchable: gainers.filter(g => g.wasInSweep || g.wasInPipeline).length, total_potential_eur: gainers.reduce((s, g) => s + parseFloat(g.potentialGain), 0).toFixed(0), gainers })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
