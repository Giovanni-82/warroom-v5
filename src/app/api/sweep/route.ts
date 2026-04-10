import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { computeCTI } from '@/lib/formulaMagica'

const db = () => createServerClient()
const POLYGON = process.env.POLYGON_API_KEY!
const FINNHUB = process.env.FINNHUB_API_KEY!

async function fetchEDGAR8K(): Promise<any[]> {
  try {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const r = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22item+1.01%22+OR+%22item+2.01%22&forms=8-K&dateRange=custom&startdt=${yesterday}&enddt=${today}`,
      { headers: { 'User-Agent': 'WarRoom/2.0 contact@warroom.io' }, signal: AbortSignal.timeout(12000) }
    )
    const d = await r.json()
    const results: any[] = []
    for (const h of (d?.hits?.hits || []).slice(0, 40)) {
      const tickers = h._source?.tickers || []
      const entityName = h._source?.entity_name || ''
      for (const ticker of tickers) {
        if (ticker && /^[A-Z]{1,6}$/.test(ticker)) {
          results.push({
            symbol: ticker, name: entityName,
            catalyst_type: '8K',
            catalyst_desc: `8-K Material Event: ${entityName}`,
            catalyst_source: 'SEC EDGAR',
            catalyst_date: h._source?.file_date || today,
            formula_score: 65, recommended_horizon: 'INTRADAY', signal_silent_vol: false
          })
        }
      }
    }
    console.log(`EDGAR 8-K: ${results.length} ticker`)
    return results
  } catch (e) { console.error('EDGAR:', e); return [] }
}

async function fetchEarnings(): Promise<any[]> {
  try {
    const from = new Date().toISOString().split('T')[0]
    const to = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    const r = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB}`, { signal: AbortSignal.timeout(10000) })
    const d = await r.json()
    const items = (d?.earningsCalendar || []).filter((e: any) => e.symbol && /^[A-Z]{1,6}$/.test(e.symbol))
    console.log(`Earnings: ${items.length}`)
    return items.map((e: any) => ({
      symbol: e.symbol, catalyst_type: 'EARNINGS',
      catalyst_desc: `Earnings ${e.date} — EPS est: ${e.epsEstimate || 'n/d'}`,
      catalyst_source: 'Finnhub', catalyst_date: e.date,
      formula_score: 65, recommended_horizon: e.date === from ? 'INTRADAY' : 'SWING1W', signal_silent_vol: false
    }))
  } catch (e) { return [] }
}

async function fetchSilentVolume(): Promise<any[]> {
  try {
    const r = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON}`, { signal: AbortSignal.timeout(10000) })
    const d = await r.json()
    const tickers = (d?.tickers || []).filter((t: any) => {
      const price = t.day?.c || 0; const rvol = (t.day?.volume || 0) / Math.max(t.prevDay?.volume || 1, 1)
      return price >= 1 && price <= 10 && rvol >= 1.5 && rvol <= 3 && Math.abs(t.day?.changePercent || 0) < 5
    }).slice(0, 15)
    console.log(`Volume silenzioso: ${tickers.length}`)
    return tickers.map((t: any) => ({
      symbol: t.ticker, catalyst_type: 'VOLUME_SILENT',
      catalyst_desc: `Volume silenzioso RVOL ${((t.day?.volume || 0) / Math.max(t.prevDay?.volume || 1, 1)).toFixed(1)}x — Formula Magica`,
      catalyst_source: 'Polygon.io', catalyst_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      formula_score: 72, recommended_horizon: 'SWING1W', signal_silent_vol: true
    }))
  } catch (e) { return [] }
}

async function fetchGainersCTI(): Promise<any[]> {
  try {
    const r = await fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON}`, { signal: AbortSignal.timeout(10000) })
    const d = await r.json()
    const candidates = (d?.tickers || []).filter((t: any) => {
      const p = t.day?.c || 0; return p >= 1 && p <= 10 && (t.day?.changePercent || 0) >= 10 && (t.day?.v || 0) >= 100000
    }).slice(0, 15)
    return candidates.map((t: any) => {
      const price = t.day?.c || 0; const vol = t.day?.v || 0; const change = t.day?.changePercent || 0
      const rvol = vol / Math.max(t.prevDay?.v || 1, 1)
      const cti = computeCTI({ symbol: t.ticker, price, prevClose: t.prevDay?.c || price, open: t.day?.o || price, high: t.day?.h || price, low: t.day?.l || price, volume: vol, avgVolume30d: t.prevDay?.v || vol, hasCatalyst: false, catalystDaysAway: 0, marketCap: 0 })
      return {
        symbol: t.ticker, catalyst_type: 'OTHER',
        catalyst_desc: `Gap +${change.toFixed(1)}% RVOL ${rvol.toFixed(0)}x | CTI Score: ${cti.score} | ${cti.verdict}`,
        catalyst_source: 'Polygon Gainers', catalyst_date: new Date().toISOString().split('T')[0],
        formula_score: cti.score, recommended_horizon: 'INTRADAY', signal_silent_vol: false,
        ai_verdict: cti.verdict, ai_rationale: cti.signals.slice(0, 3).join(' | ')
      }
    })
  } catch (e) { return [] }
}

export async function POST(req: NextRequest) {
  const sweepDate = new Date().toISOString().split('T')[0]
  console.log('=== SWEEP v2 ===', sweepDate)
  const [edgar, earnings, sv, gainers] = await Promise.allSettled([fetchEDGAR8K(), fetchEarnings(), fetchSilentVolume(), fetchGainersCTI()])
  const e = edgar.status === 'fulfilled' ? edgar.value : []
  const earn = earnings.status === 'fulfilled' ? earnings.value : []
  const s = sv.status === 'fulfilled' ? sv.value : []
  const g = gainers.status === 'fulfilled' ? gainers.value : []
  const allResults = [...e, ...earn, ...s, ...g]
  const dedup = new Map<string, any>()
  for (const r of allResults) {
    const key = r.symbol?.toUpperCase()?.trim()
    if (!key || key.length < 1 || key.length > 6 || !/^[A-Z]+$/.test(key)) continue
    if (['UNKN', 'TEST', 'NULL', 'NONE', 'NA'].includes(key)) continue
    if (!dedup.has(key) || r.formula_score > dedup.get(key).formula_score) dedup.set(key, { ...r, symbol: key, sweep_date: sweepDate })
  }
  const toInsert = Array.from(dedup.values())
  console.log(`Inserimento: ${toInsert.length} ticker unici validi`)
  if (toInsert.length > 0) {
    const { error } = await db().from('sweep_results').upsert(toInsert, { onConflict: 'sweep_date,symbol' })
    if (error) return NextResponse.json({ ok: false, error: error.message, total: toInsert.length }, { status: 500 })
  }
  return NextResponse.json({ ok: true, total: toInsert.length, by_channel: { edgar_8k: e.length, earnings: earn.length, silent_vol: s.length, gainers: g.length } })
}

export async function GET(req: NextRequest) {
  const date = new URL(req.url).searchParams.get('date') || new Date().toISOString().split('T')[0]
  const { data, error } = await db().from('sweep_results').select('*').eq('sweep_date', date).order('formula_score', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await db().from('learned_rules').upsert({ ...body }, { onConflict: 'category' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
