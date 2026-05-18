-- Migration 109: add 'binance' to historical_bars.source whitelist for
-- crypto CSV import (data.binance.vision bulk archive format).

BEGIN;

ALTER TABLE public.historical_bars
  DROP CONSTRAINT IF EXISTS historical_bars_source_check;
ALTER TABLE public.historical_bars
  ADD CONSTRAINT historical_bars_source_check
  CHECK (source IN ('mt4','mt5','dukascopy','histdata','tradovate','yahoo','cme','oanda','fxratesapi','binance','coinbase'));

COMMIT;
