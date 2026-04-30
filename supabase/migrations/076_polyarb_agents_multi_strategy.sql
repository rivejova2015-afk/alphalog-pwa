-- 076_polyarb_agents_multi_strategy.sql
-- Allow multiple parallel polyarb agents per user (one per strategy/name).
--
-- The original index `idx_polyarb_agents_user` enforced one row per user_id,
-- which blocks running parallel strategies (e.g. production engine + 50x
-- variant) on the same Polymarket account. Replace it with a composite
-- (user_id, name) unique index so each strategy gets its own agent row,
-- still scoped per user and still respecting soft-delete.

DROP INDEX IF EXISTS idx_polyarb_agents_user;

CREATE UNIQUE INDEX idx_polyarb_agents_user_name
  ON polyarb_agents(user_id, name) WHERE deleted_at IS NULL;
