-- Migration 107: add 'fxratesapi' to the historical_bars.source whitelist.
--
-- fxratesapi.com is the only no-auth free HTTP API we found that returns real
-- XAUUSD/XAGUSD/XPTUSD/XPDUSD spot prices (not the GC=F futures proxy Yahoo
-- forces us to use). It's D1-only and has a 366-day history limit per call,
-- so it's a true backup — not a primary — but it adds spot fidelity for the
-- D1 timeframe when Yahoo fails.
--
-- Added alongside existing sources rather than replacing anything.

BEGIN;

ALTER TABLE public.historical_bars
  DROP CONSTRAINT IF EXISTS historical_bars_source_check;
ALTER TABLE public.historical_bars
  ADD CONSTRAINT historical_bars_source_check
  CHECK (source IN ('mt4','mt5','dukascopy','histdata','tradovate','yahoo','cme','oanda','fxratesapi'));

COMMIT;
