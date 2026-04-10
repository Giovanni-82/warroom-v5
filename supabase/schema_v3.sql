-- ============================================================
-- NUOVE TABELLE v5.1 — esegui in Supabase SQL Editor
-- ============================================================

-- Fascicoli tecnici Claude + Gemini
CREATE TABLE IF NOT EXISTS fascicoli (
  id          BIGSERIAL PRIMARY KEY,
  symbol      TEXT NOT NULL,
  level       TEXT NOT NULL DEFAULT 'L1',
  claude_verdict   TEXT,
  claude_analysis  TEXT,
  gemini_verdict   TEXT,
  gemini_analysis  TEXT,
  final_verdict    TEXT,
  probability_pct  INTEGER DEFAULT 0,
  risk_reward      TEXT,
  bsl         NUMERIC(10,4),
  stop        NUMERIC(10,4),
  target      NUMERIC(10,4),
  catalyst    TEXT,
  gara_claude     TEXT,
  gara_giovanni   TEXT,
  gara_result     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(symbol)
);

-- Chat in-app con Claude
CREATE TABLE IF NOT EXISTS warroom_chat (
  id          BIGSERIAL PRIMARY KEY,
  role        TEXT NOT NULL CHECK (role IN ('user','claude')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Abilita realtime per chat
ALTER PUBLICATION supabase_realtime ADD TABLE warroom_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE postmarket_alerts;
