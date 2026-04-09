import { NextRequest, NextResponse } from 'next/server'

const SYSTEM = `Sei 🏛️ CLAUDE, analista militare della WarRoom "Operazione Milione 2030".
Protocollo attivo: Cecchini v2.4.
REGOLA ZERO: prezzo $1-$10 tassativo.
Stop loss SEMPRE simultaneo all'entrata, −8%.
Free Trade a +5%: sposta stop a breakeven.
TIME STOP L2: 15:45 IT assoluto.
Gap >30% riduce soglia RVOL minima a 2x.
Formula Magica: volume silenzioso crescente 3-5gg + prezzo compresso + catalyst IN ARRIVO + float basso.
Verdetto: 🟢 GO / 🟡 WATCH / 🔴 NO + motivazione oggettiva.
Parametri GO obbligatori: BSL, stop, target, finestra ingresso.`

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }]
    })
  })
  const data = await res.json()
  const text = data.content?.map((b: any) => b.text || '').join('') || ''
  // Chunk per evitare troncamento in UI
  const chunks = chunkText(text, 800)
  return NextResponse.json({ text, chunks, total_chunks: chunks.length })
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + maxLen, text.length)
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end)
      if (lastSpace > i) end = lastSpace
    }
    chunks.push(text.slice(i, end).trim())
    i = end + 1
  }
  return chunks.map((c, idx) => `[${idx + 1}/${chunks.length}] ${c}`)
}
