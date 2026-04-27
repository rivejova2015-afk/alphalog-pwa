-- Event-Driven Volatility Capture (Hybrid Mode)
-- Logs each false→true edge transition of the EventDetector so we can review
-- which event types triggered the bot's aggressive mode and how often.
-- Pure observability — no row → no behavior change.

CREATE TABLE polyarb_event_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid        NOT NULL,
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  event_type  text        NOT NULL,
  severity    numeric(4,3) NOT NULL,
  detected_at timestamptz NOT NULL,
  ttl_ms      integer     NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE polyarb_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own event log"
  ON polyarb_event_log FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_event_log_agent_time
  ON polyarb_event_log (agent_id, detected_at DESC);

CREATE INDEX idx_event_log_type_time
  ON polyarb_event_log (event_type, detected_at DESC);
