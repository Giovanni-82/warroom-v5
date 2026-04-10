import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const db = () => createServerClient()

export async function POST(req: NextRequest) {
  const { message, history } = await req.json()
  if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 })

  // Recupera contesto: candidati oggi, P&L, sessione corrente
  const today = new Date().toISOString().split('T')[0]
  const { data: pipeline } = await db().from('pipeline').select('symbol,ai_verdict,formula_score,catalyst_desc').eq('session_date', today).order('formula_score', { ascending: false }).limit(5)
  const { data: trades } = await db().from('trades').select('symbol,result_eur,result_pct').order('trade_date', { ascending: false }).limit(5)

  const context = `
CONTESTO WARROOM OGGI (${today}):
Candidati pipeline: ${pipeline?.map(p => `${p.symbol} ${p.ai_verdict} score:${p.formula_score}`).join(', ') || 'nessuno ancora'}
Ultimi trade: ${trades?.map(t => `${t.symbol} ${t.result_eur > 0 ? '+' : ''}€${t.result_eur}`).join(', ') || 'nessuno'}
P&L cumulativo: −€172
Protocollo: Cecchini v2.4 | Sizing: €1.000/trade | Stop: −8% | Target: +10%
Regola Zero: prezzo $1-$10 tassativo`

  const messages = [
    ...( history || []).map((m: any) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
    { role: 'user', content: message }
  ]

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: `Sei 🏛️ CLAUDE, analista militare della WarRoom "Operazione Milione 2030".
Parli in italiano, sei diretto e operativo. Max 3 paragrafi brevi.
Rispondi SOLO a domande di trading, analisi ticker, protocollo Cecchini, sessioni.
${context}`,
      messages
    }),
    signal: AbortSignal.timeout(25000)
  })
  const d = await r.json()
  const reply = d.content?.[0]?.text || 'Errore risposta Claude'
  return NextResponse.json({ reply })
}
