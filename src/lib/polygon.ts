const POLYGON_KEY = process.env.POLYGON_API_KEY!
const BASE = 'https://api.polygon.io'

export async function getSnapshot(symbol: string) {
  const r = await fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${POLYGON_KEY}`)
  const d = await r.json()
  return d.ticker
}

// Quotazione estesa (include pre/post market)
export async function getExtendedQuote(symbol: string) {
  const r = await fetch(
    `${BASE}/v2/last/trade/${symbol}?apiKey=${POLYGON_KEY}`
  )
  const d = await r.json()
  return d.result
}

// RVOL: volume relativo
export async function getRVOL(symbol: string): Promise<number> {
  const snap = await getSnapshot(symbol)
  if (!snap) return 0
  const todayVol = snap.day?.volume || 0
  const avgVol = snap.prevDay?.volume || 1
  return parseFloat((todayVol / avgVol).toFixed(2))
}

// Dati post-market (after-hours)
export async function getPostmarketData(symbol: string) {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const r = await fetch(
    `${BASE}/v2/aggs/ticker/${symbol}/range/1/minute/${dateStr}/${dateStr}?adjusted=true&sort=desc&limit=50&apiKey=${POLYGON_KEY}`
  )
  const d = await r.json()
  if (!d.results) return null
  // Filtra solo barre after-hours: dopo 16:00 ET = 20:00 UTC
  const afterHoursMs = new Date(`${dateStr}T20:00:00Z`).getTime()
  const afterBars = d.results.filter((b: any) => b.t >= afterHoursMs)
  if (afterBars.length === 0) return null
  const latest = afterBars[0]
  const first = afterBars[afterBars.length - 1]
  return {
    symbol,
    last_price: latest.c,
    open_afterhours: first.o,
    change_pct: parseFloat((((latest.c - first.o) / first.o) * 100).toFixed(2)),
    volume_afterhours: afterBars.reduce((s: number, b: any) => s + b.v, 0),
    bars: afterBars,
    last_updated: new Date(latest.t).toISOString()
  }
}

// Pre-market data
export async function getPremarketData(symbol: string) {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]
  const r = await fetch(
    `${BASE}/v2/aggs/ticker/${symbol}/range/1/minute/${dateStr}/${dateStr}?adjusted=true&sort=asc&limit=100&apiKey=${POLYGON_KEY}`
  )
  const d = await r.json()
  if (!d.results) return null
  // Pre-market: 04:00-09:30 ET = 08:00-13:30 UTC
  const preStart = new Date(`${dateStr}T08:00:00Z`).getTime()
  const preEnd = new Date(`${dateStr}T13:30:00Z`).getTime()
  const preBars = d.results.filter((b: any) => b.t >= preStart && b.t < preEnd)
  if (preBars.length === 0) return null
  const volumes = preBars.map((b: any) => b.v)
  const totalVol = volumes.reduce((s: number, v: number) => s + v, 0)
  const high = Math.max(...preBars.map((b: any) => b.h))
  const low = Math.min(...preBars.map((b: any) => b.l))
  const vwapNumer = preBars.reduce((s: number, b: any) => s + ((b.h + b.l + b.c) / 3) * b.v, 0)
  const vwap = totalVol > 0 ? vwapNumer / totalVol : 0
  const latest = preBars[preBars.length - 1]
  const prevClose = (await getSnapshot(symbol))?.prevDay?.c || latest.o
  const gap = prevClose > 0 ? ((latest.c - prevClose) / prevClose) * 100 : 0
  return {
    symbol,
    premarket_high: high,
    premarket_low: low,
    premarket_last: latest.c,
    premarket_vwap: parseFloat(vwap.toFixed(4)),
    premarket_volume: totalVol,
    gap_pct: parseFloat(gap.toFixed(2)),
    bars: preBars,
    is_bull_flag: latest.c < high * 0.99 && latest.c > vwap
  }
}

// Top movers post-market (scan su lista ticker)
export async function getPostmarketMovers(symbols: string[], minChangePct = 3) {
  const results = []
  for (const sym of symbols.slice(0, 100)) {
    try {
      const data = await getPostmarketData(sym)
      if (data && Math.abs(data.change_pct) >= minChangePct) {
        results.push(data)
      }
    } catch {}
  }
  return results.sort((a, b) => b.change_pct - a.change_pct)
}

// Screener base: gap >15%, vol >100k, cap $2M-$50M, price $1-$10
export async function getGappers(minGap = 15) {
  const r = await fetch(
    `${BASE}/v2/snapshot/locale/us/markets/stocks/gainers?apiKey=${POLYGON_KEY}`
  )
  const d = await r.json()
  if (!d.tickers) return []
  return d.tickers.filter((t: any) => {
    const price = t.day?.c || 0
    const todayOpen = t.day?.o || 0
    const prevClose = t.prevDay?.c || 1
    const gap = ((todayOpen - prevClose) / prevClose) * 100
    return gap >= minGap && price >= 1 && price <= 10
  })
}
