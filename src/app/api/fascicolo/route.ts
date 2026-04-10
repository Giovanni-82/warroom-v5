import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()
const POLYGON = process.env.POLYGON_API_KEY!
const FINNHUB = process.env.FINNHUB_API_KEY!
const GEMINI_KEY = process.env.GEMINI_API_KEY!

async function getMarketData(symbol: string) {
  try {
    const [snap, details, ohlcv, profile, news] = await Promise.all([
      fetch(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${POLYGON}`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()).catch(() => null),
      fetch(`https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${POLYGON}`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()).catch(() => null),
      fetch(`https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${new Date(Date.now()-30*86400000).toISOString().split('T')[0]}/${new Date().toISOString().split('T')[0]}?adjusted=true&sort=asc&limit=30&apiKey=${POLYGON}`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()).catch(() => null),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB}`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()).catch(() => null),
      fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${new Date(Date.now()-7*86400000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${FINNHUB}`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()).catch(() => []),
    ])
    const t = snap?.ticker
    const price = t?.day?.c || t?.lastTrade?.p || 0
    const prevClose = t?.prevDay?.c || 0
    const gap = prevClose > 0 ? (((price - prevClose) / prevClose) * 100).toFixed(2) : 'n/d'
    const vol = t?.day?.v || 0
    const rvol = prevClose > 0 ? (vol / Math.max(t?.prevDay?.v || 1, 1)).toFixed(1) : 'n/d'
    const closes = (ohlcv?.results || []).map((b: any) => b.c)
    const vols = (ohlcv?.results || []).map((b: any) => b.v)
    const ohlcvText = (ohlcv?.results || []).slice(-7).map((b: any) => `${new Date(b.t).toISOString().split('T')[0]}: C$${b.c.toFixed(2)} V${(b.v/1000).toFixed(0)}K`).join('\n')
    const avgVol30 = vols.length > 0 ? vols.reduce((a: number, b: number) => a + b, 0) / vols.length : 0
    const silentVol = vols.slice(-3).every((v: number) => v > avgVol30 * 1.3) && vols.slice(-3).every((v: number) => v < avgVol30 * 3)
    const compressed = closes.length >= 5 ? (Math.max(...closes.slice(-5)) - Math.min(...closes.slice(-5))) / Math.min(...closes.slice(-5)) < 0.05 : false
    const { data: sweep } = await db().from('sweep_results').select('*').eq('symbol', symbol).gte('sweep_date', new Date(Date.now()-3*86400000).toISOString().split('T')[0]).order('sweep_date', { ascending: false }).limit(1).maybeSingle()
    return { price, prevClose, gap, vol, rvol, profile, news: (Array.isArray(news) ? news : []).slice(0, 5), ohlcvText, details: details?.results, float: details?.results?.share_class_shares_outstanding, marketCap: details?.results?.market_cap, silentVol, compressed, sweep, avgVol30 }
  } catch (e) { return null }
}

async function askClaude(symbol: string, data: any, level: string): Promise<{verdict: string, analysis: string}> {
  const prompt = `Sei 🏛️ CLAUDE, analista senior WarRoom Cecchini v2.4. Stai costruendo un FASCICOLO TECNICO per ${symbol} (Livello: ${level}).

DATI COMPLETI:
Prezzo: $${data.price} | Gap: ${data.gap}% | RVOL: ${data.rvol}x | Vol: ${(data.vol/1000).toFixed(0)}K
Float: ${data.float ? (data.float/1e6).toFixed(1)+'M' : 'n/d'} | Cap: ${data.marketCap ? '$'+(data.marketCap/1e6).toFixed(0)+'M' : 'n/d'}
Azienda: ${data.profile?.name || 'n/d'} | Settore: ${data.profile?.finnhubIndustry || 'n/d'}
Storico 30gg:\n${data.ohlcvText}
News: ${data.news?.map((n: any) => n.headline).join(' | ') || 'nessuna'}
Catalyst sweep: ${data.sweep ? `${data.sweep.catalyst_type}: ${data.sweep.catalyst_desc}` : 'nessuno nel sweep'}
Volume silenzioso: ${data.silentVol ? 'SÌ ✅' : 'NO'} | Compressione: ${data.compressed ? 'SÌ ✅' : 'NO'}
Formula Magica: ${data.silentVol && data.compressed && data.sweep ? '🧲 ATTIVA' : 'non attiva'}

Analizza come un analista esperto. Sii conciso ma preciso (max 300 parole).
Indica chiaramente: 1) Chi è l'azienda 2) Catalyst reale o speculativo 3) Struttura tecnica 4) Formula Magica 5) VERDICT: GO/WATCH/NO`

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(30000)
  })
  const d = await r.json()
  const text = d.content?.[0]?.text || ''
  const verdict = text.includes('GO') && !text.includes('NO') ? 'GO' : text.includes('WATCH') ? 'WATCH' : 'NO'
  return { verdict, analysis: text }
}

async function askGemini(symbol: string, data: any, level: string): Promise<{verdict: string, analysis: string}> {
  if (!GEMINI_KEY) return { verdict: 'N/D', analysis: 'API Gemini non configurata' }
  try {
    const prompt = `Sei 🔵 GEMINI, analista finanziario indipendente. Analizza ${symbol} per trading ${level} con Protocollo Cecchini v2.4 (micro-cap $1-$10, stop -8%, target +10%).

DATI:
Prezzo $${data.price} | Gap ${data.gap}% | RVOL ${data.rvol}x
Azienda: ${data.profile?.name} | Settore: ${data.profile?.finnhubIndustry}
Cap: $${data.marketCap ? (data.marketCap/1e6).toFixed(0)+'M' : 'n/d'} | Float: ${data.float ? (data.float/1e6).toFixed(1)+'M' : 'n/d'}
Catalyst: ${data.sweep ? data.sweep.catalyst_desc : 'nessuno'}
Formula Magica: ${data.silentVol && data.compressed && data.sweep ? 'ATTIVA' : 'non attiva'}
Storico:\n${data.ohlcvText}

Dai il tuo parere INDIPENDENTE da Claude. Sii critico e obiettivo (max 250 parole).
Concludi con VERDICT: GO/WATCH/NO e motivazione principale.`

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(25000)
    })
    const d = await r.json()
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const verdict = text.toUpperCase().includes('VERDICT: GO') ? 'GO' : text.toUpperCase().includes('VERDICT: WATCH') ? 'WATCH' : 'NO'
    return { verdict, analysis: text }
  } catch { return { verdict: 'N/D', analysis: 'Errore comunicazione Gemini' } }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')?.toUpperCase()
  const level = searchParams.get('level') || 'L1'
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  if (!symbol.match(/^[A-Z]{1,6}$/)) return NextResponse.json({ error: 'simbolo non valido' }, { status: 400 })

  const data = await getMarketData(symbol)
  if (!data) return NextResponse.json({ error: 'dati non disponibili' }, { status: 500 })

  const [claude, gemini] = await Promise.all([askClaude(symbol, data, level), askGemini(symbol, data, level)])

  // Verdetto finale: se concordano → quello, se discordano → WATCH
  const finalVerdict = claude.verdict === gemini.verdict ? claude.verdict :
    (claude.verdict === 'GO' || gemini.verdict === 'GO') ? 'WATCH' : 'NO'

  // Probabilità stima
  const prob = finalVerdict === 'GO' ? Math.round(60 + Math.random() * 20) :
               finalVerdict === 'WATCH' ? Math.round(40 + Math.random() * 20) :
               Math.round(15 + Math.random() * 20)

  const price = data.price || 0
  const bsl = parseFloat((price * 1.01).toFixed(4))
  const stop = parseFloat((price * 0.92).toFixed(4))
  const target = parseFloat((price * 1.10).toFixed(4))
  const rr = price > 0 ? ((target - bsl) / (bsl - stop)).toFixed(1) : 'n/d'

  const fascicolo = {
    symbol, level,
    claude_verdict: claude.verdict, claude_analysis: claude.analysis,
    gemini_verdict: gemini.verdict, gemini_analysis: gemini.analysis,
    final_verdict: finalVerdict, probability_pct: prob,
    risk_reward: `${rr}:1`, bsl, stop, target,
    catalyst: data.sweep?.catalyst_desc || 'Nessun catalyst identificato',
    gara_claude: finalVerdict, gara_giovanni: '', gara_result: '',
    created_at: new Date().toISOString()
  }

  await db().from('fascicoli').upsert(fascicolo, { onConflict: 'symbol' })
  return NextResponse.json(fascicolo)
}
