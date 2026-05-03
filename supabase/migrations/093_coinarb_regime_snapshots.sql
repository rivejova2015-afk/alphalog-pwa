-- Coinarb Regime Snapshots
-- Time series of regime state. Bot writes one row per regime transition
-- (CALM↔TRENDING↔VOLATILE↔CRISIS) and optionally periodic checkpoints to
-- give the dashboard enough granularity for a 24h timeline chart.

CREATE TABLE coinarb_regime_snapshots (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  agent_id          uuid        NOT NULL,
  regime            text        NOT NULL,            -- CALM/TRENDING/VOLATILE/CRISIS
  agent_multiplier  numeric     NOT NULL,
  trend             text,                            -- UP/DOWN/SIDEWAYS
  trend_strength    numeric,                         -- 0..1
  volatility_pct    numeric,
  consistency_score numeric,                         -- 0..1
  previous_regime   text,                            -- null on first snapshot
  is_transition     boolean     NOT NULL DEFAULT false,
  captured_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coinarb_regime_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_coinarb_regime_snapshots"
  ON coinarb_regime_snapshots FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_coinarb_regime_agent_captured
  ON coinarb_regime_snapshots (agent_id, captured_at DESC);

CREATE INDEX idx_coinarb_regime_user_captured
  ON coinarb_regime_snapshots (user_id, captured_at DESC);

CREATE INDEX idx_coinarb_regime_transitions
  ON coinarb_regime_snapshots (agent_id, captured_at DESC)
  WHERE is_transition = true;
