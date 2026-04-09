// ============================================================
// AI ANALYSIS — Claude + Gemini
// Fix troncamento: ogni risposta viene divisa in chunk da 800 char
// con label [1/N] [2/N] per visualizzazione paginata
// ============================================================

const CLAUDE_MODEL = 'claude-sonnet-4-6'
const GEMINI_MODEL = 'gemini-1.5-flash-latest'

// Prompt sistema Cecchini v2.4
const SYSTEM_PROMPT = `Sei 🏛️ CLAUDE, analista militare della WarRoom "Operazione Milione 2030".
Protocollo attivo: Cecchini v2.4.
REGOLA ZERO: prezzo $1-$10 tassativo.
Stop loss SEMPRE simultaneo all'entrata, −8%.
Free Trade a +5%: sposta stop a breakeven.
TIME STOP L2: 15:45 IT assoluto.
Gap >30% riduce soglia RVOL minima a 2x.
Formula Magica: volume silenzioso crescente 3-5gg + prezzo compresso + catalyst IN ARRIVO + float basso.
Verdetto in formato: 🟢 GO / 🟡 WATCH / 🔴 NO seguito da motivazione oggettiva concisa.
Parametri obbligatori nel verdetto GO: BSL suggerito, stop, target, finestra di ingresso.
Max 800 caratteri per chunk. Se la risposta è più lunga indicalo con [continua→].`

// Analisi testuale
export async function analyzeText(prompt: string): Promise<string> {
  const res = await fetch('/api/analysis/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })
  const data = await res.json()
  return data.text || ''
}

// Analisi immagini (screenshot TradingView) — max 10 immagini
export async function analyzeImages(
  images: string[], // base64
  mode: 'SCREENER' | 'GRAFICI',
  context?: string
): Promise<string[]> {
  const res = await fetch('/api/analysis/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images, mode, context }),
    signal: AbortSignal.timeout(60000) // 60s timeout per analisi immagini
  })
  const data = await res.json()
  return data.chunks || []
}

// Verdetto rapido su ticker
export async function getVerdict(
  symbol: string,
  data: {
    price: number
    gap_pct: number
    rvol: number
    float: number
    market_cap: number
    catalyst: string
    premarket_vwap?: number
    is_bull_flag?: boolean
  }
): Promise<{ verdict: 'GO' | 'WATCH' | 'NO'; rationale: string; bsl?: number; stop?: number; target?: number; window?: string }> {
  const prompt = `Analizza questo ticker per Cecchini v2.4:
Ticker: ${symbol}
Prezzo: $${data.price}
Gap: ${data.gap_pct}%
RVOL: ${data.rvol}x
Float: ${(data.float / 1e6).toFixed(1)}M shares
Cap: $${(data.market_cap / 1e6).toFixed(0)}M
Catalyst: ${data.catalyst}
${data.premarket_vwap ? `PreMkt VWAP: $${data.premarket_vwap}` : ''}
${data.is_bull_flag !== undefined ? `Bull Flag PreMkt: ${data.is_bull_flag ? 'SÌ' : 'NO'}` : ''}

Dai verdetto con parametri operativi.`

  const text = await analyzeText(prompt)
  const isGo = text.includes('🟢') || text.toUpperCase().includes('GO')
  const isWatch = text.includes('🟡') || text.toUpperCase().includes('WATCH')
  return {
    verdict: isGo ? 'GO' : isWatch ? 'WATCH' : 'NO',
    rationale: text,
    bsl: isGo ? data.price * 1.01 : undefined,
    stop: isGo ? data.price * 0.92 : undefined,
    target: isGo ? data.price * 1.10 : undefined,
    window: 'PREMKT'
  }
}

// Analisi best gainer post-sessione
export async function analyzeBestGainer(
  symbol: string,
  gainPct: number,
  wasInSweep: boolean,
  wasInPipeline: boolean
): Promise<{ catalyst: string; catchable: boolean; when: string; new_rule: string }> {
  const prompt = `POST-SESSIONE STUDIO OBBLIGATORIO:
${symbol} ha fatto +${gainPct.toFixed(1)}% oggi.
Era nel nostro sweep: ${wasInSweep ? 'SÌ' : 'NO'}
Era nella pipeline: ${wasInPipeline ? 'SÌ' : 'NO'}

1. Qual è il catalyst che ha mosso il titolo? (cerca ovunque)
2. Era intercettabile con le nostre regole? Come e quando?
3. Se sì, codifica una nuova regola da aggiungere al sistema.
Sii diretto e pratico.`

  const text = await analyzeText(prompt)
  return {
    catalyst: text,
    catchable: !text.toLowerCase().includes('non intercettabile'),
    when: '',
    new_rule: ''
  }
}

// Chunk splitter: divide testo lungo in blocchi da maxLen caratteri
export function chunkText(text: string, maxLen = 800): string[] {
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
