-- Migration 045: Add superpower snapshot columns + Memory Bank table

-- SP#5 Regime Detector
ALTER TABLE polyarb_telemetry ADD COLUMN IF NOT EXISTS regime_snapshot jsonb;

-- SP#3 Adaptive Kelly
ALTER TABLE polyarb_telemetry ADD COLUMN IF NOT EXISTS adaptive_kelly_state jsonb;

-- SP#6 Cross-Market Confirmation
ALTER TABLE polyarb_telemetry ADD COLUMN IF NOT EXISTS cross_market_snapshot jsonb;

-- SP#4 Sentiment Pulse
ALTER TABLE polyarb_telemetry ADD COLUMN IF NOT EXISTS sentiment_snapshot jsonb;

-- SP#2 Memory Bank stats
ALTER TABLE polyarb_telemetry ADD COLUMN IF NOT EXISTS memory_bank_stats jsonb;

-- SP#2 Memory Bank — signal outcome history table
CREATE TABLE IF NOT EXISTS polyarb_signal_memory (
  id uuid PRIMARY KEY,
  agent_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  condition_id text NOT NULL,
  symbol text NOT NULL,
  regime text NOT NULL,
  distance_zone text NOT NULL,
  velocity_alignment text NOT NULL,
  hunt_bucket text NOT NULL,
  edge_at_entry numeric NOT NULL,
  entered_at timestamptz NOT NULL,
  outcome text,
  pnl_usd numeric,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS polyarb_signal_memory_agent_idx ON polyarb_signal_memory(agent_id);
CREATE INDEX IF NOT EXISTS polyarb_signal_memory_symbol_regime_idx ON polyarb_signal_memory(agent_id, symbol, regime, distance_zone, velocity_alignment, hunt_bucket);
CREATE INDEX IF NOT EXISTS polyarb_signal_memory_outcome_idx ON polyarb_signal_memory(agent_id, outcome, closed_at DESC);

ALTER TABLE polyarb_signal_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "polyarb_signal_memory_user" ON polyarb_signal_memory;
CREATE POLICY "polyarb_signal_memory_user"
  ON polyarb_signal_memory
  FOR ALL
  USING (auth.uid() = user_id);

COMMENT ON TABLE polyarb_signal_memory IS
  'SP#2 Memory Bank: records each signal entry and its outcome for adaptive learning';
