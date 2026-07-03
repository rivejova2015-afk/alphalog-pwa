-- 135_algorithm_alert_preferences.sql
-- =========================================================================
-- Wave 5 item 22 — user-configurable alert thresholds.
--
-- First cut, scoped deliberately: only wires up coinarb-heartbeat (the
-- simplest, most self-contained monitoring cron — a single per-algorithm
-- loop, no shared schema with other crons). The other ops crons
-- (bot-heartbeat-monitor, bot-daily-verify, bot-auto-recovery,
-- bot-slo-monitor, polyarb-heartbeat) keep their hardcoded thresholds for
-- now; wiring all of them is a larger, separate follow-up once this
-- pattern is proven.
--
-- One row per user (single-user system today, but RLS-correct for future
-- multi-user). Falls back to the cron's existing hardcoded defaults
-- (300s / 30min) when no row exists — this table is additive, not a
-- required dependency.
-- =========================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.algorithm_alert_preferences (
  user_id                          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  coinarb_heartbeat_stale_sec      INTEGER NOT NULL DEFAULT 300 CHECK (coinarb_heartbeat_stale_sec BETWEEN 60 AND 3600),
  coinarb_heartbeat_dedup_minutes  INTEGER NOT NULL DEFAULT 30  CHECK (coinarb_heartbeat_dedup_minutes BETWEEN 5 AND 1440),
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.algorithm_alert_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "algorithm_alert_preferences_select_own"
  ON public.algorithm_alert_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "algorithm_alert_preferences_insert_own"
  ON public.algorithm_alert_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "algorithm_alert_preferences_update_own"
  ON public.algorithm_alert_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- service_role (used by the coinarb-heartbeat cron) bypasses RLS by default,
-- no separate policy needed for the read side of the cron.

COMMIT;
