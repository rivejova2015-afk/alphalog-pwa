-- Coinarb Calibration Tracker
-- One row per closed position. Stores predicted_confidence (validator output)
-- vs the actual outcome so the dashboard can render a reliability diagram and
-- compute Brier score per regime / tier. Bot writes from loop-50x on close.

CREATE TABLE coinarb_calibration (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  agent_id             uuid        NOT NULL,
  position_id          uuid,
  symbol               text        NOT NULL,
  venue                text        NOT NULL,
  predicted_confidence numeric     NOT NULL,            -- 0..1 from validator
  predicted_edge       numeric,                         -- abs(gap) at entry
  regime               text,
  tier                 text,
  outcome              smallint    NOT NULL,            -- 1 win, 0 loss
  pnl_usd              numeric     NOT NULL,
  brier_score          numeric     NOT NULL,            -- (predicted - outcome)^2
  closed_at            timestamptz NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT coinarb_calibration_outcome_chk CHECK (outcome IN (0, 1)),
  CONSTRAINT coinarb_calibration_pred_chk    CHECK (predicted_confidence >= 0 AND predicted_confidence <= 1)
);

ALTER TABLE coinarb_calibration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_coinarb_calibration"
  ON coinarb_calibration FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_coinarb_calibration_agent_closed
  ON coinarb_calibration (agent_id, closed_at DESC);

CREATE INDEX idx_coinarb_calibration_user_closed
  ON coinarb_calibration (user_id, closed_at DESC);

CREATE INDEX idx_coinarb_calibration_regime
  ON coinarb_calibration (agent_id, regime)
  WHERE regime IS NOT NULL;
