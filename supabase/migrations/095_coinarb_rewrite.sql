-- 095_coinarb_rewrite.sql
-- Coinarb full rewrite: spot-only crypto bot (BTC-USD/ETH-USD/SOL-USD).
-- Strips polymarket-era columns (market_slug, condition_id, outcome, leverage_used,
-- shares, redeemed*, market_question), adds symbol/direction + SMC/risk fields,
-- repurposes telemetry, and creates 4 new tables for the new pipeline.
--
-- ORDER MATTERS: add new columns nullable first, backfill from old, then enforce
-- NOT NULL and drop the old columns. The dashboard endpoints that read the old
-- columns ship in the same PR so the cutover is atomic.

BEGIN;

-- ==========================================================================
-- A1. coinarb_positions: add new columns (nullable for backfill)
-- ==========================================================================
ALTER TABLE coinarb_positions
  ADD COLUMN IF NOT EXISTS symbol              text,
  ADD COLUMN IF NOT EXISTS direction           text,
  ADD COLUMN IF NOT EXISTS base_qty            numeric,
  ADD COLUMN IF NOT EXISTS stop_loss_price     numeric,
  ADD COLUMN IF NOT EXISTS take_profit_price   numeric,
  ADD COLUMN IF NOT EXISTS smc_zone_type       text,
  ADD COLUMN IF NOT EXISTS smc_zone_price      numeric,
  ADD COLUMN IF NOT EXISTS arb_gap_pct         numeric,
  ADD COLUMN IF NOT EXISTS fear_greed_at_entry integer,
  ADD COLUMN IF NOT EXISTS phase_at_entry      text;

-- A2. Backfill from market_slug ("spot:BTC-USD" → symbol="BTC-USD") and side
UPDATE coinarb_positions
SET symbol    = COALESCE(symbol, NULLIF(split_part(market_slug, ':', 2), '')),
    direction = COALESCE(direction, side),
    base_qty  = COALESCE(base_qty, shares)
WHERE symbol IS NULL OR direction IS NULL OR base_qty IS NULL;

-- Any rows still missing symbol (shouldn't happen) get a safe default
UPDATE coinarb_positions
SET symbol = 'BTC-USD'
WHERE symbol IS NULL OR symbol = '';

UPDATE coinarb_positions
SET direction = 'BUY'
WHERE direction IS NULL OR direction NOT IN ('BUY','SELL');

-- A3. Enforce NOT NULL + check constraint, drop polymarket-era columns
ALTER TABLE coinarb_positions
  ALTER COLUMN symbol SET DEFAULT 'BTC-USD',
  ALTER COLUMN symbol SET NOT NULL,
  ALTER COLUMN direction SET DEFAULT 'BUY',
  ALTER COLUMN direction SET NOT NULL;

ALTER TABLE coinarb_positions
  DROP CONSTRAINT IF EXISTS coinarb_positions_direction_chk;
ALTER TABLE coinarb_positions
  ADD CONSTRAINT coinarb_positions_direction_chk CHECK (direction IN ('BUY','SELL'));

ALTER TABLE coinarb_positions
  DROP COLUMN IF EXISTS market_slug,
  DROP COLUMN IF EXISTS condition_id,
  DROP COLUMN IF EXISTS outcome,
  DROP COLUMN IF EXISTS redeemed,
  DROP COLUMN IF EXISTS redeemed_at,
  DROP COLUMN IF EXISTS market_question,
  DROP COLUMN IF EXISTS leverage_used,
  DROP COLUMN IF EXISTS shares;

-- entry_reason jsonb is PRESERVED — dashboard /stats/pnl reads .tier from it.
-- New bot continues writing { regime, tier, validatorConfidence, ... }.

CREATE INDEX IF NOT EXISTS idx_coinarb_positions_symbol_status
  ON coinarb_positions (agent_id, symbol, status)
  WHERE deleted_at IS NULL;

-- ==========================================================================
-- A4. coinarb_trades: same shape — add symbol/direction, drop old
-- ==========================================================================
ALTER TABLE coinarb_trades
  ADD COLUMN IF NOT EXISTS symbol    text,
  ADD COLUMN IF NOT EXISTS direction text;

UPDATE coinarb_trades
SET symbol    = COALESCE(symbol, NULLIF(split_part(market_slug, ':', 2), '')),
    direction = COALESCE(direction, side)
WHERE market_slug IS NOT NULL OR side IS NOT NULL;

ALTER TABLE coinarb_trades
  DROP CONSTRAINT IF EXISTS coinarb_trades_direction_chk;
ALTER TABLE coinarb_trades
  ADD CONSTRAINT coinarb_trades_direction_chk
    CHECK (direction IS NULL OR direction IN ('BUY','SELL'));

ALTER TABLE coinarb_trades
  DROP COLUMN IF EXISTS condition_id,
  DROP COLUMN IF EXISTS market_slug,
  DROP COLUMN IF EXISTS outcome,
  DROP COLUMN IF EXISTS order_signature;

-- ==========================================================================
-- A5. coinarb_telemetry — drop polymarket flags, add operational state
-- ==========================================================================
ALTER TABLE coinarb_telemetry
  DROP COLUMN IF EXISTS ws_polymarket_connected,
  DROP COLUMN IF EXISTS velocity_snapshot,
  DROP COLUMN IF EXISTS memory_bank_stats,
  DROP COLUMN IF EXISTS event_state,
  DROP COLUMN IF EXISTS adaptive_kelly_state,
  DROP COLUMN IF EXISTS cross_market_snapshot,
  DROP COLUMN IF EXISTS sentiment_snapshot,
  DROP COLUMN IF EXISTS regime_snapshot;

ALTER TABLE coinarb_telemetry
  ADD COLUMN IF NOT EXISTS ws_coinbase_connected     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ws_binance_connected_spot boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_trades_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_wins         integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_losses       integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase_current      text    DEFAULT '$100',
  ADD COLUMN IF NOT EXISTS risk_pct_current   numeric DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS capital_current    numeric,
  ADD COLUMN IF NOT EXISTS smc_bias           jsonb,
  ADD COLUMN IF NOT EXISTS fear_greed_index   integer,
  ADD COLUMN IF NOT EXISTS paused_until       timestamptz;

-- ==========================================================================
-- A6. coinarb_agents: rename default
-- ==========================================================================
UPDATE coinarb_agents SET name = 'Coinarb' WHERE name = 'PolyArb-v1';
ALTER TABLE coinarb_agents ALTER COLUMN name SET DEFAULT 'Coinarb';

-- ==========================================================================
-- A7. coinarb_decisions: spot-only venue
-- ==========================================================================
ALTER TABLE coinarb_decisions
  DROP CONSTRAINT IF EXISTS coinarb_decisions_venue_check;
ALTER TABLE coinarb_decisions
  ADD CONSTRAINT coinarb_decisions_venue_check
    CHECK (venue IS NULL OR venue = 'spot');

-- ==========================================================================
-- A8. coinarb_liquidity_map — SMC liquidity zones (EQH/EQL, swing highs/lows)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS coinarb_liquidity_map (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  agent_id     uuid        NOT NULL,
  symbol       text        NOT NULL,
  timeframe    text        NOT NULL,             -- '1D','4H','1H','30M','15M','5M','1M'
  zone_type    text        NOT NULL,             -- 'EQH','EQL','SWING_HIGH','SWING_LOW','OB','FVG'
  price_top    numeric     NOT NULL,
  price_bottom numeric     NOT NULL,
  detected_at  timestamptz NOT NULL DEFAULT now(),
  swept_at     timestamptz,
  meta         jsonb       DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coinarb_liquidity_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_coinarb_liquidity_map"
  ON coinarb_liquidity_map FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coinarb_liquidity_agent_symbol_tf
  ON coinarb_liquidity_map (agent_id, symbol, timeframe, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_coinarb_liquidity_unswept
  ON coinarb_liquidity_map (agent_id, symbol, timeframe)
  WHERE swept_at IS NULL;

-- ==========================================================================
-- A9. coinarb_smc_signals — SMC events (BOS, CHOCH, OB, FVG)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS coinarb_smc_signals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  agent_id     uuid        NOT NULL,
  symbol       text        NOT NULL,
  timeframe    text        NOT NULL,
  signal_type  text        NOT NULL,             -- 'BOS','CHOCH','OB','FVG'
  direction    text,                             -- 'BULLISH','BEARISH'
  price        numeric,
  strength     numeric,                          -- 0..1
  detected_at  timestamptz NOT NULL DEFAULT now(),
  invalidated_at timestamptz,
  meta         jsonb       DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coinarb_smc_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_coinarb_smc_signals"
  ON coinarb_smc_signals FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coinarb_smc_agent_symbol_tf
  ON coinarb_smc_signals (agent_id, symbol, timeframe, detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_coinarb_smc_active
  ON coinarb_smc_signals (agent_id, symbol, signal_type)
  WHERE invalidated_at IS NULL;

-- ==========================================================================
-- A10. coinarb_daily_stats — one row per UTC day per agent
-- ==========================================================================
CREATE TABLE IF NOT EXISTS coinarb_daily_stats (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  agent_id                 uuid        NOT NULL,
  day_utc                  date        NOT NULL,
  total_trades             integer     NOT NULL DEFAULT 0,
  wins                     integer     NOT NULL DEFAULT 0,
  losses                   integer     NOT NULL DEFAULT 0,
  win_rate                 numeric,
  total_pnl_usd            numeric     NOT NULL DEFAULT 0,
  best_trade_usd           numeric,
  worst_trade_usd          numeric,
  capital_start_usd        numeric,
  capital_end_usd          numeric,
  phase_start              text,
  phase_end                text,
  circuit_breaker_triggered boolean    NOT NULL DEFAULT false,
  consecutive_loss_max     integer     NOT NULL DEFAULT 0,
  fear_greed_avg           numeric,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, day_utc)
);

ALTER TABLE coinarb_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_coinarb_daily_stats"
  ON coinarb_daily_stats FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coinarb_daily_stats_user_day
  ON coinarb_daily_stats (user_id, day_utc DESC);

-- ==========================================================================
-- A11. coinarb_phase_log — capital phase transitions (11-phase ladder)
-- ==========================================================================
CREATE TABLE IF NOT EXISTS coinarb_phase_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  agent_id        uuid        NOT NULL,
  from_phase      text,
  to_phase        text        NOT NULL,
  from_risk_pct   numeric,
  to_risk_pct     numeric     NOT NULL,
  capital_at_change numeric   NOT NULL,
  reason          text,                          -- 'compound_up','compound_down','manual'
  changed_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coinarb_phase_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_coinarb_phase_log"
  ON coinarb_phase_log FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coinarb_phase_log_agent_changed
  ON coinarb_phase_log (agent_id, changed_at DESC);

COMMIT;
