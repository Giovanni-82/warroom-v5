import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()
const POLYGON = process.env.POLYGON_API_KEY!
const FINNHUB = process.env.FINNHUB_API_KEY!

// ============================================================
// ANALISI PROFONDA — Claude pensa, non una formula
// Recupera tutti i dati disponibili e chiede a Claude
// di ragionare come un analista esperto di Cecchini v2.4
// ============================================================

async function getPolygonSnapshot(symbol: string) {
  try {
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${POLYGON}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const d = await r.json()
    return d.ticker || null
  } catch { return null }
}

async function getPolygonDetails(symbol: string) {
  try {
    const r = await fetch(
      `https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${POLYGON}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const d = await r.json()
    return d.results || null
  } catch { return null }
}

async function getOHLCV5d(symbol: string) {
  try {
    const to = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const r = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=10&apiKey=${POLYGON}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const d = await r.json()
    return d.results || []
  } catch { return [] }
}

async function getFinnhubProfile(symbol: string) {
  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB}`,
      { signal: AbortSignal.timeout(8000) }
    )
    return await r.json()
  } catch { return null }
}

async function getFinnhubNews(symbol: string) {
  try {
    const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const to = new Date().toISOString().split('T')[0]
    const r = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${FINNHUB}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const news = await r.json()
    return Array.isArray(news) ? news.slice(0, 5) : []
  } catch { return [] }
}

async function getSweepCatalyst(symbol: string) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await db()
      .from('sweep_results')
      .select('*')
      .eq('symbol', symbol)
      .gte('sweep_date', new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0])
      .order('sweep_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data
  } catch { return null }
}

async function callClaude(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: `Sei 🏛️ CLAUDE, analista militare della WarRoom "Operazione Milione 2030".
Protocollo attivo: Cecchini v2.4.
REGOLA ZERO: prezzo $1-$10 tassativo.
Formula Magica: volume silenzioso crescente 3-5gg + prezzo compresso + catalyst IN ARRIVO + float basso.

Il tuo compito è analizzare il ticker come un analista esperto — non come una formula meccanica.
Devi ragionare su:
1. Chi è questa azienda? È solida o speculativa?
2. Il catalyst è reale o è fumo?
3. I volumi raccontano una storia?
4. Il grafico degli ultimi 5 giorni mostra compressione o distribuzione?
5. C'è la Formula Magica attiva?
6. Qual è il rischio reale?

Rispondi in italiano, in modo diretto e operativo.
Formato risposta:
🏛️ ANALISI [SYMBOL]
📊 AZIENDA: [chi è, cosa fa, settore]
🎯 CATALYST: [reale/speculativo, fonte, quando]
📈 VOLUME: [storia degli ultimi 5 giorni]
📉 GRAFICO: [struttura tecnica, compressione o distribuzione]
🧲 FORMULA MAGICA: [attiva/non attiva — motivazione]
⚡ VERDICT: GO/WATCH/NO
📌 PARAMETRI: BSL $X | Stop $X (-8%) | Target $X (+Y%)
⚠️ RISCHIO: [motivazione oggettiva]`,
      messages: [{ role: 'user', content: prompt }]
    }),
    signal: AbortSignal.timeout(30000)
  })
  const d = await res.json()
  return d.content?.[0]?.text || 'Analisi non disponibile'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')?.toUpperCase()
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  // Raccolta dati parallela
  const [snapshot, details, ohlcv5d, profile, news, catalyst] = await Promise.all([
    getPolygonSnapshot(symbol),
    getPolygonDetails(symbol),
    getOHLCV5d(symbol),
    getFinnhubProfile(symbol),
    getFinnhubNews(symbol),
    getSweepCatalyst(symbol)
  ])

  // Costruisce il contesto per Claude
  const price = snapshot?.day?.c || snapshot?.lastTrade?.p || 0
  const prevClose = snapshot?.prevDay?.c || 0
  const gap = prevClose > 0 ? (((price - prevClose) / prevClose) * 100).toFixed(2) : 'n/d'
  const volume = snapshot?.day?.v || 0
  const avgVol = snapshot?.prevDay?.v || 1
  const rvol = (volume / avgVol).toFixed(1)
  const vwap = snapshot?.day?.vw || 0
  const high52w = snapshot?.day?.h || 0
  const float = details?.share_class_shares_outstanding || 0
  const marketCap = details?.market_cap || 0

  const ohlcvText = ohlcv5d.length > 0
    ? ohlcv5d.map((b: any) => `${new Date(b.t).toISOString().split('T')[0]}: O$${b.o} H$${b.h} L$${b.l} C$${b.c} V${(b.v/1000).toFixed(0)}K`).join('\n')
    : 'Dati storici non disponibili'

  const newsText = news.length > 0
    ? news.map((n: any) => `• ${n.headline} (${n.source}, ${new Date(n.datetime * 1000).toISOString().split('T')[0]})`).join('\n')
    : 'Nessuna news recente'

  const prompt = `Analizza il ticker ${symbol} con tutti i dati seguenti:

📊 DATI REALTIME (Polygon.io):
- Prezzo attuale: $${price}
- Gap vs ieri: ${gap}%
- Volume oggi: ${(volume/1000).toFixed(0)}K
- RVOL: ${rvol}x
- VWAP: $${vwap}
- Prezzo vs VWAP: ${price > vwap ? 'SOPRA' : 'SOTTO'}
- Float: ${float > 0 ? (float/1e6).toFixed(1)+'M shares' : 'n/d'}
- Market Cap: ${marketCap > 0 ? '$'+(marketCap/1e6).toFixed(0)+'M' : 'n/d'}

📈 STORICO 5 GIORNI:
${ohlcvText}

🏢 PROFILO AZIENDA (Finnhub):
- Nome: ${profile?.name || 'n/d'}
- Settore: ${profile?.finnhubIndustry || 'n/d'}
- Exchange: ${profile?.exchange || 'n/d'}
- Paese: ${profile?.country || 'n/d'}
- Dipendenti: ${profile?.employeeTotal || 'n/d'}
- IPO: ${profile?.ipo || 'n/d'}

📰 NEWS ULTIMI 7 GIORNI:
${newsText}

🎯 CATALYST NELLO SWEEP:
${catalyst ? `Tipo: ${catalyst.catalyst_type} | Descrizione: ${catalyst.catalyst_desc} | Data: ${catalyst.catalyst_date} | Fonte: ${catalyst.catalyst_source}` : 'Nessun catalyst trovato nel sweep'}

Analizza tutto questo e dammi il tuo verdetto ragionato.`

  const analysis = await callClaude(prompt)

  // Estrai verdict dal testo
  const verdict = analysis.includes('⚡ VERDICT: GO') ? 'GO' :
                  analysis.includes('⚡ VERDICT: WATCH') ? 'WATCH' : 'NO'

  // Salva in pipeline se GO o WATCH
  const today = new Date().toISOString().split('T')[0]
  if (verdict !== 'NO' && price >= 1 && price <= 10) {
    await db().from('pipeline').upsert({
      session_date: today, symbol, status: verdict === 'GO' ? 'AGGANCIATO' : 'SCOVATO',
      catalyst_type: catalyst?.catalyst_type || 'OTHER',
      catalyst_desc: catalyst?.catalyst_desc || 'Analisi AI profonda',
      formula_score: verdict === 'GO' ? 88 : 70,
      ai_verdict: verdict, ai_rationale: analysis.slice(0, 500),
      price_at_scan: price, rvol: parseFloat(rvol),
      target_pct: 10, notes: `Analisi AI profonda ${new Date().toLocaleTimeString('it-IT')}`
    }, { onConflict: 'session_date,symbol' })
  }

  return NextResponse.json({ symbol, price, gap, rvol, verdict, analysis, data: { snapshot: !!snapshot, profile: !!profile, news: news.length, catalyst: !!catalyst, ohlcv: ohlcv5d.length } })
}
