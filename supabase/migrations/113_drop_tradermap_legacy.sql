-- Drop legacy tradermap goal/quarter tables. Map Hot (map_hot_goals,
-- map_hot_milestones, map_hot_goal_links) replaces them entirely for goal
-- tracking; tradermap_* tables had zero rows in prod.
--
-- KEPT: user_level_state + progress_events — these feed the XP/level system
-- that's still wired into trade close events (lib/tradermap/progressEngine.ts
-- → onTradeClosedSaved). Map Hot doesn't replicate XP yet.

-- Cascade because tradermap_goal_quarters has FK to tradermap_goals.
DROP TABLE IF EXISTS public.tradermap_goal_quarters CASCADE;
DROP TABLE IF EXISTS public.tradermap_goals CASCADE;

COMMENT ON TABLE public.user_level_state IS
  'XP/level state per user. Survived TraderMap V2 cleanup (migration 113). '
  'Source of truth for /api/tradermap/level. Fed by onTradeClosedSaved via progress_events.';

COMMENT ON TABLE public.progress_events IS
  'Event-sourced XP feed. Survived TraderMap V2 cleanup (migration 113). '
  'Inserts from lib/tradermap/progressEngine.ts when a trade closes profitably.';
