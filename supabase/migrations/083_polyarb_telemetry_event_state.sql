-- Migration 083: Add `event_state` jsonb column to polyarb_telemetry.
--
-- The PolyArb 500x telemetry writer (polyarb/src/telemetry/writer.ts:121)
-- upserts `event_state` on every flush. The column was never added, so every
-- upsert returns:
--   "Could not find the 'event_state' column of 'polyarb_telemetry' in the schema cache"
-- That swallows the entire telemetry payload (no equity, no win-rate, no
-- velocity snapshot, no heartbeat update). Adding the column makes the upsert
-- succeed and unblocks the dashboard.
--
-- `event_state` carries the macro-event detector snapshot (FOMC / CPI / NFP
-- proximity) and is opaque to the DB — store it as jsonb so it can grow
-- without future migrations.

ALTER TABLE polyarb_telemetry
  ADD COLUMN IF NOT EXISTS event_state jsonb;

COMMENT ON COLUMN polyarb_telemetry.event_state IS
  'Macro event detector snapshot: { activeEvent, minutesUntil, kellyMultiplier, reason }';
