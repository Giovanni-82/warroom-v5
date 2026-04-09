-- ============================================================
-- TABELLE AGGIUNTIVE — esegui su Supabase SQL Editor
-- ============================================================

-- Storia OHLCV completa (memoria storica dal 2000)
CREATE TABLE IF NOT EXISTS ohlcv_history (
  id          BIGSERIAL PRIMARY KEY,
  symbol      TEXT NOT NULL,
  date        DATE NOT NULL,
  open        NUMERIC(12,4),
  high        NUMERIC(12,4),
  low         NUMERIC(12,4),
  close       NUMERIC(12,4),
  volume      BIGINT,
  vwap        NUMERIC(12,4),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol, date)
);

-- Indici per query veloci
CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol ON ohlcv_history(symbol);
CREATE INDEX IF NOT EXISTS idx_ohlcv_date ON ohlcv_history(date DESC);
CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_date ON ohlcv_history(symbol, date DESC);

-- Constraint unico sweep_results (se non esiste già)
ALTER TABLE sweep_results 
ADD CONSTRAINT IF NOT EXISTS sweep_results_date_symbol_unique 
UNIQUE (sweep_date, symbol);

-- Constraint unico learned_rules per categoria sistema
ALTER TABLE learned_rules
ADD CONSTRAINT IF NOT EXISTS learned_rules_category_unique
UNIQUE (category);

-- View: statistiche database
CREATE OR REPLACE VIEW vw_database_stats AS
SELECT
  (SELECT COUNT(*) FROM universe_tickers) as total_tickers,
  (SELECT COUNT(*) FROM universe_tickers WHERE price > 0) as tickers_with_price,
  (SELECT COUNT(*) FROM universe_tickers WHERE sma50 IS NOT NULL) as tickers_with_sma,
  (SELECT COUNT(DISTINCT symbol) FROM ohlcv_history) as tickers_with_history,
  (SELECT COUNT(*) FROM ohlcv_history) as total_ohlcv_records,
  (SELECT MAX(date) FROM ohlcv_history) as latest_history_date,
  (SELECT rule_text FROM learned_rules WHERE category = 'SYSTEM_PROGRESS' LIMIT 1) as ohlcv_progress;
