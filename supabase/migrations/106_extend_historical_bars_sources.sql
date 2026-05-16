-- Migration 106: extend historical_bars.source whitelist to cover every
-- ingest path we now support, and rename the existing Yahoo rows from the
-- misleading 'histdata' tag to a proper 'yahoo' tag.
--
-- Background:
--   - Migration 088 only allowed ('mt4','mt5','dukascopy','histdata').
--   - bars-loader.ts wrote Yahoo bars as 'histdata' (wrong — 'histdata'
--     should mean HistData.com, a different forex source).
--   - The previous commit (3eba868) silently broke the new Tradovate CSV
--     import: bars-import accepts source='tradovate' but the INSERT
--     violates the CHECK and fails silently.
--   - Implementing real Dukascopy + HistData fetchers needs the schema to
--     accept those values (already in constraint) and 'yahoo' to be a
--     distinct, accurate label.
--
-- Net effect after this migration: every row that says 'yahoo' is from
-- Yahoo, every row that says 'histdata' is from HistData.com (none
-- exist yet — implemented in this sprint), Tradovate imports succeed.

BEGIN;

-- Step 1: drop the old CHECK first. Updating rows to 'yahoo' while the
-- constraint still bans that value would fire the check per row and abort.
ALTER TABLE public.historical_bars
  DROP CONSTRAINT IF EXISTS historical_bars_source_check;

-- Step 2: relabel Yahoo rows. As of today no real HistData.com ingestion
-- exists, so every row tagged 'histdata' was actually produced by
-- yahoo-fetcher.ts. (Same applies to the coverage table.)
UPDATE public.historical_bars         SET source = 'yahoo' WHERE source = 'histdata';
UPDATE public.historical_bars_coverage SET source = 'yahoo' WHERE source = 'histdata';

-- Step 3: re-add the constraint with the extended whitelist.
ALTER TABLE public.historical_bars
  ADD CONSTRAINT historical_bars_source_check
  CHECK (source IN ('mt4','mt5','dukascopy','histdata','tradovate','yahoo','cme','oanda'));

COMMIT;
