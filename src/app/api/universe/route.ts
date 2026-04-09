import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()

// Scarica lista completa ticker da NASDAQ Trader (gratuito, aggiornato ogni giorno)
async function downloadNasdaqTickers(): Promise<any[]> {
  const urls = [
    'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt',
    'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt'
  ]
  const all: any[] = []
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'WarRoom/1.0' } })
      const text = await r.text()
      const lines = text.split('\n').slice(1) // Skip header
      for (const line of lines) {
        const parts = line.split('|')
        if (parts.length < 2) continue
        const symbol = parts[0]?.trim()
        const name = parts[1]?.trim()
        if (!symbol || symbol === 'File Creation Time' || symbol.includes(' ')) continue
        all.push({ symbol, name, exchange: url.includes('nasdaq') ? 'NASDAQ' : 'NYSE/OTHER' })
      }
    } catch {}
  }
  return all
}

// Arricchisce ticker con dati Polygon (batch da 50)
async function enrichTickers(symbols: string[]): Promise<any[]> {
  const enriched: any[] = []
  for (let i = 0; i < symbols.length; i += 50) {
    const batch = symbols.slice(i, i + 50)
    try {
      const r = await fetch(
        `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${batch.join(',')}&apiKey=${process.env.POLYGON_API_KEY}`
      )
      const d = await r.json()
      for (const t of d.tickers || []) {
        const price = t.day?.c || t.lastTrade?.p || 0
        if (price < 0.5 || price > 500) continue // Filtra outlier
        enriched.push({
          symbol: t.ticker,
          price,
          avg_volume: t.prevDay?.v || 0,
          market_cap: 0, // Richiede endpoint separato
          updated_at: new Date().toISOString()
        })
      }
    } catch {}
    await new Promise(r => setTimeout(r, 200)) // Rate limit
  }
  return enriched
}

export async function POST(req: NextRequest) {
  // 1. Scarica lista ticker
  const tickers = await downloadNasdaqTickers()
  if (tickers.length === 0) {
    return NextResponse.json({ error: 'Impossibile scaricare lista ticker' }, { status: 500 })
  }
  // 2. Upsert base (solo symbol + name)
  const baseInsert = tickers.map(t => ({
    symbol: t.symbol,
    name: t.name,
    exchange: t.exchange,
    updated_at: new Date().toISOString()
  }))
  // Batch insert da 500
  let inserted = 0
  for (let i = 0; i < baseInsert.length; i += 500) {
    const batch = baseInsert.slice(i, i + 500)
    const { error } = await db()
      .from('universe_tickers')
      .upsert(batch, { onConflict: 'symbol' })
    if (!error) inserted += batch.length
  }
  return NextResponse.json({
    ok: true,
    total_downloaded: tickers.length,
    total_inserted: inserted,
    updated_at: new Date().toISOString()
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const minFloat = parseFloat(searchParams.get('min_float') || '0')
  const maxFloat = parseFloat(searchParams.get('max_float') || '999999999')
  const limit = parseInt(searchParams.get('limit') || '100')
  let query = db()
    .from('universe_tickers')
    .select('*')
    .limit(limit)
    .order('avg_volume', { ascending: false })
  if (q) query = query.or(`symbol.ilike.%${q}%,name.ilike.%${q}%`)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, total: data?.length || 0 })
}
