-- E1 Outcome Calibration Tracker
-- Stores per-bucket win/loss counts so the bot can correct for
-- systematic Polymarket over/under-estimation of probabilities.

CREATE TABLE polyarb_calibration_data (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  symbol      text        NOT NULL,
  prob_bucket text        NOT NULL,
  wins        integer     NOT NULL DEFAULT 0,
  total       integer     NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, symbol, prob_bucket)
);

ALTER TABLE polyarb_calibration_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own calibration data"
  ON polyarb_calibration_data FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_calibration_lookup
  ON polyarb_calibration_data (agent_id, symbol, prob_bucket);
