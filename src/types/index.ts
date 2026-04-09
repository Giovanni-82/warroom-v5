export type Verdict = 'GO' | 'WATCH' | 'NO'
export type PipelineStatus = 'SCOVATO' | 'AGGANCIATO' | 'CECCHINATO_FATTO' | 'CECCHINATO_NON_FATTO'
export type EntryWindow = 'POSTMKT' | 'PREMKT' | 'APERTURA' | 'POST_SFURIATA' | 'INTRADAY'
export type TradeCategory = 'L1' | 'L2' | 'SWING1W' | 'SWING2W' | 'SWING1M' | 'SWING6M' | 'SWINGY'
export type CatalystType = '8K' | 'FDA' | 'EARNINGS' | 'MERGER' | 'VOLUME_SILENT' | 'CONF_CALL' | 'OTHER'
export type Horizon = 'INTRADAY' | 'SWING1W' | 'SWING2W' | 'SWING1M' | 'SWING6M' | 'SWINGY'
export type SwingStatus = 'OPEN' | 'CLOSED' | 'WATCHING'

export interface Ticker {
  id: number
  symbol: string
  name: string
  exchange: string
  sector: string
  market_cap: number
  float_shares: number
  short_float: number
  avg_volume: number
  price: number
  sma50: number
  sma200: number
  week52_high: number
  week52_low: number
  updated_at: string
}

export interface SweepResult {
  id: number
  sweep_date: string
  symbol: string
  name: string
  catalyst_type: CatalystType
  catalyst_desc: string
  catalyst_date: string
  catalyst_source: string
  formula_score: number
  signal_silent_vol: boolean
  signal_premarket: boolean
  recommended_horizon: Horizon
  notes: string
}

export interface PipelineItem {
  id: number
  session_date: string
  symbol: string
  name: string
  status: PipelineStatus
  catalyst_type: CatalystType
  catalyst_desc: string
  entry_window: EntryWindow
  formula_score: number
  ai_verdict: Verdict
  ai_rationale: string
  bsl_price: number
  stop_price: number
  target_price: number
  target_pct: number
  price_at_scan: number
  rvol: number
  float_shares: number
  market_cap: number
  notes: string
}

export interface Trade {
  id: number
  session_date: string
  symbol: string
  name: string
  category: TradeCategory
  trade_done: boolean
  entry_time: string
  entry_window: EntryWindow
  pmc: number
  qty: number
  invested_eur: number
  stop_price: number
  target_pct: number
  exit_time: string
  exit_price: number
  result_pct: number
  result_eur: number
  catalyst: string
  catalyst_valid: string
  lesson: string
  protocol_ok: boolean
  violations: string
  cumulative_pnl: number
}

export interface BestGainer {
  id: number
  session_date: string
  symbol: string
  name: string
  gain_pct: number
  peak_time: string
  open_price: number
  peak_price: number
  close_price: number
  catalyst_found: string
  was_in_sweep: boolean
  was_in_pipeline: boolean
  was_catchable: boolean
  catchable_signal: string
  catchable_when: string
  missed_reason: string
  potential_gain_eur: number
  new_rule: string
}

export interface SwingPosition {
  id: number
  symbol: string
  name: string
  category: TradeCategory
  entry_date: string
  entry_price: number
  qty: number
  invested_eur: number
  stop_price: number
  target_price: number
  target_pct: number
  catalyst: string
  catalyst_date: string
  status: SwingStatus
  exit_date: string
  exit_price: number
  result_pct: number
  result_eur: number
  notes: string
}

export interface PostmarketQuote {
  symbol: string
  price: number
  change: number
  change_pct: number
  volume: number
  last_updated: string
}

export interface AIChunk {
  text: string
  done: boolean
  chunk_index: number
  total_chunks?: number
}
