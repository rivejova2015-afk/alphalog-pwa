-- 20260714210235_drop_algorithm_alert_preferences.sql
-- =========================================================================
-- Drops algorithm_alert_preferences (created in migration 135). It only
-- ever wired up coinarb-heartbeat thresholds (coinarb_heartbeat_stale_sec /
-- coinarb_heartbeat_dedup_minutes) — Coinarb was retired completely on
-- 2026-07-13/14 (bot, Fly app, algorithms/bots/bot_accounts rows, cron
-- entries, /api/ops/cron/coinarb-heartbeat, /api/algorithms/alert-preferences,
-- AlertPreferencesPanel.client.tsx). No other consumer ever read this table.
-- =========================================================================

BEGIN;

DROP TABLE IF EXISTS public.algorithm_alert_preferences;

COMMIT;
