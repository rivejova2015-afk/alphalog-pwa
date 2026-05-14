-- Migration 102: persist the equity curve alongside engine backtest runs.
-- E3 stored metrics + MC + WF but dropped the equity curve (heavy). E5's
-- side-by-side comparison needs it to overlay two runs, so add the column.
-- Sampled every 20 bars in the simulator — bounded jsonb, safe to store.

ALTER TABLE public.engine_backtest_runs
  ADD COLUMN IF NOT EXISTS equity_curve jsonb NOT NULL DEFAULT '[]'::jsonb;
