import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_SCREENER = `Sei 🏛️ CLAUDE, analista WarRoom Cecchini v2.4.
Stai analizzando screenshot di uno screener pre-market.
Per ogni ticker visibile:
1. Indica symbol, prezzo, gap%, volume se leggibili
2. Valuta se rispetta i parametri Cecchini v2.4
3. Assegna priorità: ALTA / MEDIA / BASSA
4. Motiva brevemente
REGOLA ZERO: prezzo $1-$10. Ignora tutto ciò che non rispetta i parametri base.
Formula Magica attiva. Sii rapido e pratico.`

const SYSTEM_GRAFICI = `Sei 🏛️ CLAUDE, analista WarRoom Cecchini v2.4.
Stai analizzando grafici candlestick TradingView.
Per ogni grafico:
1. Identifica il pattern (bull flag, VCP, breakout, compressione...)
2. Valuta: prezzo vs VWAP, supporti/resistenze chiave, volume
3. Verdetto: 🟢 GO / 🟡 WATCH / 🔴 NO
4. Se GO: BSL suggerito, stop (-8%), target (+10/15%), finestra ingresso
5. Se NO: motivo oggettivo
REGOLA ZERO: prezzo $1-$10 tassativo. Sii conciso e operativo.`

function chunkText(text: string, maxLen = 800): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + maxLen, text.length)
    if (end < text.length) {
      const ls = text.lastIndexOf(' ', end)
      if (ls > i) end = ls
    }
    chunks.push(text.slice(i, end).trim())
    i = end + 1
  }
  return chunks.map((c, idx) => `[${idx + 1}/${chunks.length}] ${c}`)
}

export async function POST(req: NextRequest) {
  const { images, mode, context } = await req.json()
  if (!images || images.length === 0) {
    return NextResponse.json({ error: 'Nessuna immagine' }, { status: 400 })
  }
  const limited = images.slice(0, 10) // max 10
  const system = mode === 'SCREENER' ? SYSTEM_SCREENER : SYSTEM_GRAFICI
  const content: any[] = limited.map((b64: string) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: b64.replace(/^data:image\/\w+;base64,/, '')
    }
  }))
  if (context) content.push({ type: 'text', text: context })
  content.push({
    type: 'text',
    text: mode === 'SCREENER'
      ? 'Analizza questi screenshot dello screener. Identifica i candidati migliori secondo Cecchini v2.4.'
      : 'Analizza questi grafici. Dai verdetto operativo per ciascuno.'
  })
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system,
      messages: [{ role: 'user', content }]
    }),
    signal: AbortSignal.timeout(60000)
  })
  const data = await res.json()
  const text = data.content?.map((b: any) => b.text || '').join('') || ''
  const chunks = chunkText(text, 800)
  return NextResponse.json({ text, chunks, total_chunks: chunks.length, images_analyzed: limited.length })
}
