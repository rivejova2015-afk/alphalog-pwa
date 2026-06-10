-- Drop the legacy TraderMap XP/level subsystem entirely.
--
-- Context: migration 116 deliberately KEPT user_level_state + progress_events
-- because they fed the XP/level engine (lib/tradermap/progressEngine.ts via
-- onTradeClosedSaved). Verified 2026-06-10 that the whole subsystem is dead:
--   * No UI component consumes /api/tradermap/level or /api/tradermap/progress-map/*.
--   * user_level_state.xp_total is never incremented (only initialized to 0 by
--     the upsert_user_level_state RPC).
--   * onTradeClosedSaved ran in the trades hot path (POST /api/tradehub/trades
--     + PUT /api/tradehub/trades/[id]) writing to progress_events +
--     progress_map_state — tables no screen reads. Pure dead compute.
--
-- App-side cleanup landed alongside this migration: removed the onTradeClosedSaved
-- call sites + deleted lib/tradermap/*, lib/progress-map/*, components/tradermap/*,
-- and the whole /api/tradermap/* route tree. The daily cleanup cron no longer
-- purges progress_events.
--
-- All drops are IF EXISTS so this is idempotent regardless of which tables a
-- given environment actually still has.

-- XP/level state + event feed (migration 008).
DROP TABLE IF EXISTS public.user_level_state CASCADE;
DROP TABLE IF EXISTS public.progress_events  CASCADE;
DROP FUNCTION IF EXISTS public.upsert_user_level_state CASCADE;

-- Progress-map ecosystem (migration 025).
DROP TABLE IF EXISTS public.progress_pending_sync       CASCADE;
DROP TABLE IF EXISTS public.progress_level_state        CASCADE;
DROP TABLE IF EXISTS public.progress_map_state          CASCADE;
DROP TABLE IF EXISTS public.progress_map_thresholds     CASCADE;
DROP TABLE IF EXISTS public.progress_map_levels         CASCADE;
DROP TABLE IF EXISTS public.progress_ecosystem_versions CASCADE;
DROP TABLE IF EXISTS public.progress_ecosystem_config   CASCADE;
