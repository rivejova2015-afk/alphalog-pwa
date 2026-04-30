-- 077_polyarb_50x_validation_checkpoints.sql
--
-- Stores Day-N reliability gate decisions for the PolyArb 500x agent.
-- One row per (agent_id, checkpoint_day). The Day-10 validator inserts
-- exactly one row per agent at day 10; future checkpoint days (20, 30,...)
-- can reuse the same table.

CREATE TABLE polyarb_50x_validation_checkpoints (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          uuid NOT NULL REFERENCES polyarb_agents(id) ON DELETE CASCADE,
  checkpoint_day    int  NOT NULL,
  validation_passed boolean NOT NULL,
  decision          text NOT NULL,
  metrics_json      jsonb NOT NULL,
  recommendation    text,
  executed_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, checkpoint_day)
);

ALTER TABLE polyarb_50x_validation_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service-role-only"
  ON polyarb_50x_validation_checkpoints
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX polyarb_50x_validation_checkpoints_agent_idx
  ON polyarb_50x_validation_checkpoints (agent_id, checkpoint_day DESC);
