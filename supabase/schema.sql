-- ============================================================
-- WARROOM v5.0 — SCHEMA SUPABASE COMPLETO
-- ============================================================

-- UNIVERSE: tutti i ticker NYSE/NASDAQ
CREATE TABLE IF NOT EXISTS universe_tickers (
  id              SERIAL PRIMARY KEY,
  symbol          TEXT NOT NULL UNIQUE,
  name            TEXT,
  exchange        TEXT,
  sector          TEXT,
  industry        TEXT,
  market_cap      BIGINT,
  float_shares    BIGINT,
  short_float     NUMERIC(5,2),
  avg_volume      BIGINT,
  price           NUMERIC(10,4),
  sma50           NUMERIC(10,4),
  sma200          NUMERIC(10,4),
  week52_high     NUMERIC(10,4),
  week52_low      NUMERIC(10,4),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- SWEEP: risultati sweep notturno
CREATE TABLE IF NOT EXISTS sweep_results (
  id              SERIAL PRIMARY KEY,
  sweep_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  symbol          TEXT NOT NULL,
  name            TEXT,
  catalyst_type   TEXT, -- '8K','FDA','EARNINGS','MERGER','VOLUME_SILENT','CONF_CALL'
  catalyst_desc   TEXT,
  catalyst_date   DATE,
  catalyst_source TEXT,
  formula_score   INTEGER DEFAULT 0, -- 0-100
  signal_silent_vol BOOLEAN DEFAULT FALSE,
  signal_premarket  BOOLEAN DEFAULT FALSE,
  recommended_horizon TEXT, -- 'INTRADAY','SWING1W','SWING2W','SWING1M','SWING6M','SWINGY'
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- PIPELINE: candidati nelle 4 colonne kanban
CREATE TABLE IF NOT EXISTS pipeline (
  id              SERIAL PRIMARY KEY,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  symbol          TEXT NOT NULL,
  name            TEXT,
  status          TEXT NOT NULL DEFAULT 'SCOVATO',
  -- SCOVATO | AGGANCIATO | CECCHINATO_FATTO | CECCHINATO_NON_FATTO
  catalyst_type   TEXT,
  catalyst_desc   TEXT,
  entry_window    TEXT, -- 'POSTMKT','PREMKT','APERTURA','POST_SFURIATA','INTRADAY'
  formula_score   INTEGER,
  ai_verdict      TEXT, -- 'GO','WATCH','NO'
  ai_rationale    TEXT,
  bsl_price       NUMERIC(10,4),
  stop_price      NUMERIC(10,4),
  target_price    NUMERIC(10,4),
  target_pct      NUMERIC(5,2),
  price_at_scan   NUMERIC(10,4),
  rvol            NUMERIC(8,2),
  float_shares    BIGINT,
  market_cap      BIGINT,
  screenshot_urls TEXT[],
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- TRADES: registro completo trade fatti e non fatti
CREATE TABLE IF NOT EXISTS trades (
  id              SERIAL PRIMARY KEY,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  symbol          TEXT NOT NULL,
  name            TEXT,
  category        TEXT NOT NULL, -- 'L1','L2','SWING1W','SWING2W','SWING1M','SWING6M','SWINGY'
  trade_done      BOOLEAN NOT NULL DEFAULT TRUE,
  entry_time      TIMESTAMPTZ,
  entry_window    TEXT,
  pmc             NUMERIC(10,4), -- prezzo medio carico
  qty             INTEGER,
  invested_eur    NUMERIC(10,2),
  stop_price      NUMERIC(10,4),
  stop_pct        NUMERIC(5,2) DEFAULT -8.0,
  target_price    NUMERIC(10,4),
  target_pct      NUMERIC(5,2),
  exit_time       TIMESTAMPTZ,
  exit_price      NUMERIC(10,4),
  result_pct      NUMERIC(8,4),
  result_eur      NUMERIC(10,2),
  catalyst        TEXT,
  catalyst_valid  TEXT, -- 'CONFERMATO','FALLITO','ASSENTE'
  lesson          TEXT,
  protocol_ok     BOOLEAN DEFAULT TRUE,
  violations      TEXT,
  cumulative_pnl  NUMERIC(10,2), -- aggiornato automaticamente
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- BEST GAINERS: studio post-sessione
CREATE TABLE IF NOT EXISTS best_gainers (
  id              SERIAL PRIMARY KEY,
  session_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  symbol          TEXT NOT NULL,
  name            TEXT,
  gain_pct        NUMERIC(8,4),
  peak_time       TEXT, -- ora del massimo
  open_price      NUMERIC(10,4),
  peak_price      NUMERIC(10,4),
  close_price     NUMERIC(10,4),
  catalyst_found  TEXT,
  catalyst_source TEXT,
  was_in_sweep    BOOLEAN DEFAULT FALSE,
  was_in_pipeline BOOLEAN DEFAULT FALSE,
  was_catchable   BOOLEAN,
  catchable_signal TEXT,
  catchable_when  TEXT,
  missed_reason   TEXT,
  potential_gain_eur NUMERIC(10,2),
  new_rule        TEXT, -- regola codificata se applicabile
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- REGOLE APPRESE
CREATE TABLE IF NOT EXISTS learned_rules (
  id              SERIAL PRIMARY KEY,
  rule_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  rule_text       TEXT NOT NULL,
  source_ticker   TEXT,
  source_session  DATE,
  category        TEXT, -- 'SWEEP','ENTRY','EXIT','CATALYST','SCREEN'
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- SWING POSITIONS: posizioni swing aperte
CREATE TABLE IF NOT EXISTS swing_positions (
  id              SERIAL PRIMARY KEY,
  symbol          TEXT NOT NULL,
  name            TEXT,
  category        TEXT NOT NULL, -- SWING1W etc
  entry_date      DATE,
  entry_price     NUMERIC(10,4),
  qty             INTEGER,
  invested_eur    NUMERIC(10,2),
  stop_price      NUMERIC(10,4),
  target_price    NUMERIC(10,4),
  target_pct      NUMERIC(5,2),
  catalyst        TEXT,
  catalyst_date   DATE,
  status          TEXT DEFAULT 'OPEN', -- OPEN | CLOSED | WATCHING
  exit_date       DATE,
  exit_price      NUMERIC(10,4),
  result_pct      NUMERIC(8,4),
  result_eur      NUMERIC(10,2),
  lesson          TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- POSTMARKET ALERTS
CREATE TABLE IF NOT EXISTS postmarket_alerts (
  id              SERIAL PRIMARY KEY,
  alert_time      TIMESTAMPTZ DEFAULT NOW(),
  symbol          TEXT NOT NULL,
  price           NUMERIC(10,4),
  change_pct      NUMERIC(8,4),
  volume          BIGINT,
  catalyst        TEXT,
  alert_type      TEXT, -- 'MOVE_UP','MOVE_DOWN','VOLUME_SPIKE','NEWS'
  notes           TEXT
);

-- INDICI
CREATE INDEX IF NOT EXISTS idx_sweep_date ON sweep_results(sweep_date);
CREATE INDEX IF NOT EXISTS idx_pipeline_date ON pipeline(session_date);
CREATE INDEX IF NOT EXISTS idx_pipeline_status ON pipeline(status);
CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(session_date);
CREATE INDEX IF NOT EXISTS idx_best_gainers_date ON best_gainers(session_date);
CREATE INDEX IF NOT EXISTS idx_swing_status ON swing_positions(status);

-- VIEW: P&L cumulativo
CREATE OR REPLACE VIEW vw_pnl_summary AS
SELECT
  COUNT(*) FILTER (WHERE trade_done AND result_eur > 0) AS wins,
  COUNT(*) FILTER (WHERE trade_done AND result_eur < 0) AS losses,
  COUNT(*) FILTER (WHERE trade_done) AS total_done,
  COUNT(*) FILTER (WHERE NOT trade_done) AS total_missed,
  COALESCE(SUM(result_eur) FILTER (WHERE trade_done), 0) AS total_pnl_eur,
  COALESCE(AVG(result_pct) FILTER (WHERE trade_done AND result_eur > 0), 0) AS avg_win_pct,
  COALESCE(AVG(result_pct) FILTER (WHERE trade_done AND result_eur < 0), 0) AS avg_loss_pct
FROM trades;
