import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()

// 1. SEC EDGAR 8-K — endpoint ufficiale RSS (più affidabile)
async function fetchEDGAR8K(): Promise<any[]> {
  try {
    const r = await fetch(
      'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=40&search_text=&output=atom',
      { headers: { 'User-Agent': 'WarRoom/1.0 warroom@example.com', 'Accept': 'application/xml' }, signal: AbortSignal.timeout(10000) }
    )
    const text = await r.text()
    const matches = [...text.matchAll(/<company-name>([^<]+)<\/company-name>[\s\S]*?<file-date>([^<]+)<\/file-date>/g)]
    const tickerMatches = [...text.matchAll(/<ticker-symbol>([^<]+)<\/ticker-symbol>/g)]
    const results: any[] = []
    tickerMatches.slice(0, 20).forEach((m, i) => {
      const sym = m[1]?.trim()
      if (sym && sym.length <= 6) {
        results.push({
          symbol: sym.toUpperCase(),
          catalyst_type: '8K',
          catalyst_desc: `8-K filing ${matches[i]?.[2] || 'oggi'}`,
          catalyst_source: 'SEC EDGAR',
          catalyst_date: new Date().toISOString().split('T')[0],
          formula_score: 65,
          recommended_horizon: 'INTRADAY',
          signal_silent_vol: false
        })
      }
    })
    console.log(`EDGAR 8-K: trovati ${results.length}`)
    return results
  } catch (e) {
    console.error('EDGAR 8-K error:', e)
    return []
  }
}

// 2. EDGAR full-text search API
async function fetchEDGARFullText(): Promise<any[]> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const url = `https://efts.sec.gov/LATEST/search-index?q=%228-K%22&dateRange=custom&startdt=${yesterday}&enddt=${today}&forms=8-K&hits.hits._source=period_of_report,entity_name,file_date,period_of_report`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'WarRoom/1.0 warroom@example.com' },
      signal: AbortSignal.timeout(10000)
    })
    const d = await r.json()
    const hits = d?.hits?.hits || []
    console.log(`EDGAR FTS: trovati ${hits.length}`)
    return hits.slice(0, 15).map((h: any) => ({
      symbol: h._source?.entity_name?.split(' ')[0]?.replace(/[^A-Z]/g, '') || 'UNKN',
      catalyst_type: '8K',
      catalyst_desc: `8-K: ${h._source?.entity_name || 'Filing recente'}`,
      catalyst_source: 'SEC EDGAR FTS',
      catalyst_date: h._source?.period_of_report || today,
      formula_score: 60,
      recommended_horizon: 'INTRADAY',
      signal_silent_vol: false
    })).filter((x: any) => x.symbol.length >= 2 && x.symbol.length <= 6)
  } catch (e) {
    console.error('EDGAR FTS error:', e)
    return []
  }
}

// 3. Earnings via Finnhub
async function fetchEarnings(): Promise<any[]> {
  try {
    const from = new Date().toISOString().split('T')[0]
    const to = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    const key = process.env.FINNHUB_API_KEY
    if (!key) { console.log('FINNHUB_API_KEY mancante'); return [] }
    const r = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${key}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const d = await r.json()
    const items = d?.earningsCalendar || []
    console.log(`Earnings: trovati ${items.length}`)
    return items.slice(0, 20).map((e: any) => ({
      symbol: e.symbol,
      catalyst_type: 'EARNINGS',
      catalyst_desc: `Earnings ${e.date} — EPS est: ${e.epsEstimate || 'n/d'}`,
      catalyst_source: 'Finnhub',
      catalyst_date: e.date,
      formula_score: 65,
      recommended_horizon: e.date === from ? 'INTRADAY' : 'SWING1W',
      signal_silent_vol: false
    }))
  } catch (e) {
    console.error('Earnings error:', e)
    return []
  }
}

// 4. Volume silenzioso via Polygon
async function fetchSilentVolume(): Promise<any[]> {
  try {
    const key = process.env.POLYGON_API_KEY
    if (!key) { console.log('POLYGON_API_KEY mancante'); return [] }
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${key}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const d = await r.json()
    const tickers = d?.tickers || []
    console.log(`Polygon gainers: trovati ${tickers.length}`)
    const silent = tickers.filter((t: any) => {
      const price = t.day?.c || 0
      const rvol = (t.day?.volume || 0) / Math.max(t.prevDay?.volume || 1, 1)
      const changePct = Math.abs(t.day?.changePercent || 0)
      return rvol >= 1.5 && rvol <= 3 && changePct < 5 && price >= 1 && price <= 10
    }).slice(0, 15)
    return silent.map((t: any) => {
      const rvol = ((t.day?.volume || 0) / Math.max(t.prevDay?.volume || 1, 1)).toFixed(1)
      return {
        symbol: t.ticker,
        catalyst_type: 'VOLUME_SILENT',
        catalyst_desc: `Volume silenzioso RVOL ${rvol}x senza news visibili — Formula Magica attiva`,
        catalyst_source: 'Polygon.io',
        catalyst_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        formula_score: 72,
        recommended_horizon: 'SWING1W',
        signal_silent_vol: true
      }
    })
  } catch (e) {
    console.error('Volume silenzioso error:', e)
    return []
  }
}

// 5. Top gainers Polygon (candidati intraday)
async function fetchTopGainers(): Promise<any[]> {
  try {
    const key = process.env.POLYGON_API_KEY
    if (!key) return []
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${key}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const d = await r.json()
    const tickers = d?.tickers || []
    // Filtro Cecchini: prezzo $1-$10, cambio >10%
    const candidates = tickers.filter((t: any) => {
      const price = t.day?.c || 0
      const change = t.day?.changePercent || 0
      const vol = t.day?.volume || 0
      return price >= 1 && price <= 10 && change >= 10 && vol >= 100000
    }).slice(0, 10)
    console.log(`Top gainers Cecchini: trovati ${candidates.length}`)
    return candidates.map((t: any) => ({
      symbol: t.ticker,
      catalyst_type: 'OTHER',
      catalyst_desc: `Gap +${(t.day?.changePercent || 0).toFixed(1)}% vol ${((t.day?.volume || 0) / 1000).toFixed(0)}K — verifica catalyst`,
      catalyst_source: 'Polygon.io Gainers',
      catalyst_date: new Date().toISOString().split('T')[0],
      formula_score: 55,
      recommended_horizon: 'INTRADAY',
      signal_silent_vol: false
    }))
  } catch (e) {
    console.error('Top gainers error:', e)
    return []
  }
}

export async function POST(req: NextRequest) {
  const sweepDate = new Date().toISOString().split('T')[0]
  console.log('=== SWEEP AVVIATO ===', sweepDate)

  const [edgar8k, edgarFts, earnings, silentVol, topGainers] = await Promise.allSettled([
    fetchEDGAR8K(),
    fetchEDGARFullText(),
    fetchEarnings(),
    fetchSilentVolume(),
    fetchTopGainers()
  ])

  const e8k = edgar8k.status === 'fulfilled' ? edgar8k.value : []
  const efts = edgarFts.status === 'fulfilled' ? edgarFts.value : []
  const earn = earnings.status === 'fulfilled' ? earnings.value : []
  const sv = silentVol.status === 'fulfilled' ? silentVol.value : []
  const tg = topGainers.status === 'fulfilled' ? topGainers.value : []

  const allResults = [...e8k, ...efts, ...earn, ...sv, ...tg]
  console.log(`Totale risultati grezzi: ${allResults.length}`)

  // Dedup per symbol
  const dedup = new Map<string, any>()
  for (const r of allResults) {
    const key = r.symbol?.toUpperCase()?.trim()
    if (!key || key.length < 1 || key.length > 6 || key.includes(' ')) continue
    if (!dedup.has(key) || r.formula_score > dedup.get(key).formula_score) {
      dedup.set(key, { ...r, symbol: key, sweep_date: sweepDate })
    }
  }

  const toInsert = Array.from(dedup.values())
  console.log(`Ticker unici da inserire: ${toInsert.length}`)

  // Salva in Supabase
  let inserted = 0
  if (toInsert.length > 0) {
    const { data, error } = await db()
      .from('sweep_results')
      .upsert(toInsert, { onConflict: 'sweep_date,symbol' })
      .select()
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({
        ok: false,
        error: error.message,
        debug: { e8k: e8k.length, efts: efts.length, earn: earn.length, sv: sv.length, tg: tg.length, total: toInsert.length }
      }, { status: 500 })
    }
    inserted = data?.length || 0
  }

  return NextResponse.json({
    ok: true,
    total: toInsert.length,
    by_channel: {
      edgar_8k: e8k.length,
      edgar_rw: efts.length,
      fda: 0,
      earnings: earn.length,
      news: tg.length,
      silent_vol: sv.length
    }
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const { data, error } = await db()
    .from('sweep_results')
    .select('*')
    .eq('sweep_date', date)
    .order('formula_score', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

// Salva regola appresa
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db()
    .from('learned_rules')
    .insert(body)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
