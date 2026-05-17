-- Migration 108: per-algorithm dispatch telemetry for the new server-side
-- dispatcher (Sprint A — Tradovate execution path).
--
-- Why these columns:
--   * last_signal_bar_ts → primary dedup key. The cron only emits a fresh
--     signal when the latest bar's ts is strictly greater than this. Without
--     it we'd re-emit BUY 60 times on the same M1 bar (cron runs every 60s).
--   * last_dispatch_at → "when did we last touch this algo at all?". Useful
--     in the UI ("last evaluated 3 minutes ago"). Updated even on dedup-
--     skip so we can detect stalled algos (last_dispatch_at older than ~5min
--     when the cron is supposed to run every 60s indicates a problem).
--   * last_dispatch_action / last_dispatch_reason → human-readable trail.
--     Helps debug "why didn't my algo trade?" without trawling cme_signals.
--
-- All four are nullable: existing algorithms (pre-Sprint-A) have nothing to
-- backfill. The cron writes them on first dispatch.

BEGIN;

ALTER TABLE public.algorithms
  ADD COLUMN IF NOT EXISTS last_dispatch_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_signal_bar_ts    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_dispatch_action  TEXT,
  ADD COLUMN IF NOT EXISTS last_dispatch_reason  TEXT;

-- Partial index covering the cron's hot query:
--   SELECT ... FROM algorithms
--   WHERE platform = 'Tradovate' AND status IN ('live','paper') AND deleted_at IS NULL
--   ORDER BY last_dispatch_at NULLS FIRST  -- so never-dispatched algos go first
CREATE INDEX IF NOT EXISTS algorithms_dispatch_idx
  ON public.algorithms (platform, status, last_dispatch_at)
  WHERE deleted_at IS NULL;

COMMIT;
