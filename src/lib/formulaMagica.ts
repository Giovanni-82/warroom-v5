// ============================================================
// FORMULA MAGICA — COMPOSITE TRADING INDEX (CTI)
// Aggiornato ogni 5 minuti durante la sessione
// Ogni sera per i parametri storici
// Scala 0-100: >70 = WATCH, >85 = GO automatico
// ============================================================

export interface CTIInput {
  symbol: string
  // Dati di prezzo
  price: number
  prevClose: number
  open: number
  high: number
  low: number
  // Volume
  volume: number
  avgVolume30d: number
  // Tecnico
  sma20?: number
  sma50?: number
  sma200?: number
  vwap?: number
  week52High?: number
  week52Low?: number
  // Catalyst
  hasCatalyst: boolean
  catalystType?: string // '8K_MA' | '8K_FDA' | 'EARNINGS' | 'VOLUME_SILENT' | 'OTHER'
  catalystDaysAway?: number // giorni al catalyst (0 = oggi, -1 = ieri, 3 = fra 3 giorni)
  // Float e cap
  floatShares?: number
  marketCap?: number
  shortFloat?: number
  // Storico recente (ultimi 5 giorni)
  volumeHistory5d?: number[] // volumi ultimi 5 giorni
  priceHistory5d?: number[]  // prezzi chiusura ultimi 5 giorni
}

export interface CTIResult {
  symbol: string
  score: number          // 0-100
  verdict: 'GO' | 'WATCH' | 'NO'
  phase: 'SCOVATO' | 'AGGANCIATO' | 'CECCHINATO' | 'IGNORA'
  components: {
    catalyst: number     // 0-35
    volume: number       // 0-25
    tecnico: number      // 0-20
    storico: number      // 0-10
    struttura: number    // 0-10
  }
  signals: string[]
  bsl?: number
  stop?: number
  target?: number
  entry_window?: string
  formula_magica_active: boolean // vol silenzioso + compressione + catalyst in arrivo
}

export function computeCTI(input: CTIInput): CTIResult {
  const signals: string[] = []
  let catalystScore = 0
  let volumeScore = 0
  let tecnicoScore = 0
  let storicoScore = 0
  let strutturaScore = 0

  const gap = input.prevClose > 0 ? ((input.price - input.prevClose) / input.prevClose) * 100 : 0
  const rvol = input.avgVolume30d > 0 ? input.volume / input.avgVolume30d : 0

  // ─── REGOLA ZERO: prezzo $1-$10 ───────────────────────────
  if (input.price < 1 || input.price > 10) {
    return { symbol: input.symbol, score: 0, verdict: 'NO', phase: 'IGNORA',
      components: { catalyst: 0, volume: 0, tecnico: 0, storico: 0, struttura: 0 },
      signals: ['❌ REGOLA ZERO: prezzo fuori range $1-$10'],
      formula_magica_active: false }
  }

  // ─── COMPONENTE 1: CATALYST (peso 35%) ────────────────────
  if (input.hasCatalyst) {
    const daysAway = input.catalystDaysAway ?? 0
    const baseScore = {
      '8K_MA': 35,      // M&A massima priorità
      '8K_FDA': 33,     // FDA molto alto
      'EARNINGS': 28,   // Earnings alto
      'VOLUME_SILENT': 20, // Volume silenzioso
      'OTHER': 15       // Altro
    }[input.catalystType || 'OTHER'] || 15

    // Sconto per distanza temporale
    const timeMultiplier = daysAway <= 0 ? 1.0 :
                           daysAway <= 1 ? 0.95 :
                           daysAway <= 3 ? 0.85 :
                           daysAway <= 7 ? 0.70 : 0.50

    catalystScore = Math.round(baseScore * timeMultiplier)
    signals.push(`✅ Catalyst ${input.catalystType} (${daysAway <= 0 ? 'oggi' : `tra ${daysAway}gg`}) +${catalystScore}`)
  }

  // ─── COMPONENTE 2: VOLUME (peso 25%) ──────────────────────
  // RVOL
  if (rvol >= 200) { volumeScore += 20; signals.push(`⚡ RVOL ${rvol.toFixed(0)}x ESPLOSIVO`) }
  else if (rvol >= 50) { volumeScore += 16; signals.push(`🔥 RVOL ${rvol.toFixed(0)}x FORTE`) }
  else if (rvol >= 10) { volumeScore += 12; signals.push(`📊 RVOL ${rvol.toFixed(0)}x buono`) }
  else if (rvol >= 5)  { volumeScore += 8; signals.push(`📊 RVOL ${rvol.toFixed(1)}x sufficiente`) }
  else if (rvol >= 2)  { volumeScore += 4 }

  // Volume assoluto minimo
  if (input.volume >= 1000000) volumeScore += 5
  else if (input.volume >= 500000) volumeScore += 3
  else if (input.volume >= 100000) volumeScore += 1
  else { volumeScore = Math.max(0, volumeScore - 5); signals.push('⚠️ Volume assoluto basso') }

  // Volume silenzioso (FORMULA MAGICA component)
  if (input.volumeHistory5d && input.volumeHistory5d.length >= 3) {
    const avgRecent = input.volumeHistory5d.slice(-3).reduce((a, b) => a + b, 0) / 3
    const avgOlder = input.avgVolume30d
    const silentRvol = avgRecent / avgOlder
    if (silentRvol >= 1.5 && silentRvol <= 3 && !input.hasCatalyst) {
      volumeScore += 8
      signals.push('🔇 VOLUME SILENZIOSO: crescita anomala senza news visibili')
    }
  }

  volumeScore = Math.min(25, volumeScore)

  // ─── COMPONENTE 3: TECNICO (peso 20%) ─────────────────────
  // Gap
  if (gap >= 30 && rvol >= 2) { tecnicoScore += 8; signals.push(`📈 Gap +${gap.toFixed(1)}% con RVOL ok`) }
  else if (gap >= 15) { tecnicoScore += 6 }
  else if (gap >= 10) { tecnicoScore += 4 }
  else if (gap >= 5)  { tecnicoScore += 2 }

  // Prezzo vs VWAP (se disponibile)
  if (input.vwap) {
    if (input.price > input.vwap * 1.02) {
      tecnicoScore += 5; signals.push('✅ Prezzo sopra VWAP')
    } else if (input.price < input.vwap * 0.98) {
      tecnicoScore -= 5; signals.push('⚠️ Prezzo sotto VWAP — L2 vietato')
    }
  }

  // Prezzo vs SMA50/200
  if (input.sma50 && input.price > input.sma50) tecnicoScore += 3
  if (input.sma200 && input.price > input.sma200) tecnicoScore += 2

  // 52W high breakout
  if (input.week52High && input.price >= input.week52High * 0.98) {
    tecnicoScore += 4; signals.push('🚀 Vicino/sopra massimo 52 settimane')
  }

  // Compressione (Formula Magica: prezzo compresso vicino a resistenza)
  if (input.priceHistory5d && input.priceHistory5d.length >= 3) {
    const maxRecent = Math.max(...input.priceHistory5d)
    const minRecent = Math.min(...input.priceHistory5d)
    const rangeCompression = (maxRecent - minRecent) / minRecent
    if (rangeCompression < 0.05) {
      tecnicoScore += 3; signals.push('🔲 COMPRESSIONE: range stretto — pronto all\'esplosione')
    }
  }

  tecnicoScore = Math.min(20, Math.max(0, tecnicoScore))

  // ─── COMPONENTE 4: STORICO (peso 10%) ─────────────────────
  // Float basso favorito
  if (input.floatShares) {
    const floatM = input.floatShares / 1e6
    if (floatM < 5) { storicoScore += 6; signals.push(`✅ Float micro: ${floatM.toFixed(1)}M`) }
    else if (floatM < 10) { storicoScore += 5 }
    else if (floatM < 15) { storicoScore += 3 }
    else if (floatM > 20) { storicoScore += 0 }
  }

  // Short float (potenziale squeeze)
  if (input.shortFloat && input.shortFloat > 20) {
    storicoScore += 4; signals.push(`🎯 Short float ${input.shortFloat.toFixed(0)}% — squeeze potenziale`)
  }

  storicoScore = Math.min(10, storicoScore)

  // ─── COMPONENTE 5: STRUTTURA AZIENDALE (peso 10%) ─────────
  // Cap range Cecchini ($2M-$150M)
  if (input.marketCap) {
    const capM = input.marketCap / 1e6
    if (capM >= 2 && capM <= 50) { strutturaScore += 7 }
    else if (capM >= 50 && capM <= 150) { strutturaScore += 5 }
    else if (capM < 2) { strutturaScore += 2 }
    else { strutturaScore += 0 }
  }

  // Prezzo nel range ottimale ($1-$5 = micro, più esplosivo)
  if (input.price >= 1 && input.price <= 5) strutturaScore += 3
  else if (input.price > 5 && input.price <= 10) strutturaScore += 1

  strutturaScore = Math.min(10, strutturaScore)

  // ─── SCORE TOTALE ──────────────────────────────────────────
  const totalScore = catalystScore + volumeScore + tecnicoScore + storicoScore + strutturaScore

  // ─── FORMULA MAGICA CHECK ──────────────────────────────────
  const hasVolumeSilenzioso = signals.some(s => s.includes('VOLUME SILENZIOSO'))
  const hasCompressione = signals.some(s => s.includes('COMPRESSIONE'))
  const hasCatalystInArrivo = input.hasCatalyst && (input.catalystDaysAway ?? 0) >= 0
  const formulaMagicaActive = (hasVolumeSilenzioso || rvol >= 2) && hasCompressione && hasCatalystInArrivo

  if (formulaMagicaActive) {
    signals.unshift('🧲 FORMULA MAGICA ATTIVA: posizionamento preventivo consigliato')
  }

  // ─── VERDICT ──────────────────────────────────────────────
  const verdict: CTIResult['verdict'] = totalScore >= 85 ? 'GO' :
                                        totalScore >= 65 ? 'WATCH' : 'NO'
  const phase: CTIResult['phase'] = totalScore >= 85 ? 'CECCHINATO' :
                                    totalScore >= 65 ? 'AGGANCIATO' :
                                    totalScore >= 45 ? 'SCOVATO' : 'IGNORA'

  // ─── PARAMETRI OPERATIVI ──────────────────────────────────
  const bslOffset = rvol < 50 ? 0.05 : rvol < 200 ? 0.15 : 0.30
  const bsl = parseFloat((input.price + bslOffset).toFixed(4))
  const stop = parseFloat((input.price * 0.92).toFixed(4))
  const targetMultiplier = formulaMagicaActive ? 1.15 : 1.10
  const target = parseFloat((input.price * targetMultiplier).toFixed(4))

  // Finestra di ingresso
  const now = new Date()
  const etHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }))
  const entry_window = etHour < 9 ? 'PREMKT' : etHour === 9 ? 'APERTURA' : 'INTRADAY'

  return {
    symbol: input.symbol,
    score: totalScore,
    verdict,
    phase,
    components: { catalyst: catalystScore, volume: volumeScore, tecnico: tecnicoScore, storico: storicoScore, struttura: strutturaScore },
    signals,
    bsl,
    stop,
    target,
    entry_window,
    formula_magica_active: formulaMagicaActive
  }
}

// Helper: batch CTI su lista di ticker
export function batchCTI(inputs: CTIInput[]): CTIResult[] {
  return inputs
    .map(computeCTI)
    .filter(r => r.verdict !== 'NO' || r.score >= 30)
    .sort((a, b) => b.score - a.score)
}
