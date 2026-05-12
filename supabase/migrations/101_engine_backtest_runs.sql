-- Migration 101: persist engine v1 backtest runs.
-- Lets the user compare results across config tweaks instead of losing the
-- output the moment they hit refresh. Quality gates can later read aggregate
-- pass/fail from this table.

CREATE TABLE IF NOT EXISTS public.engine_backtest_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  algorithm_id    uuid NOT NULL REFERENCES public.algorithms(id) ON DELETE CASCADE,
  symbol          text NOT NULL,
  range_from      timestamptz NOT NULL,
  range_to        timestamptz NOT NULL,
  params          jsonb NOT NULL DEFAULT '{}'::jsonb,
  bars_loaded     jsonb NOT NULL DEFAULT '[]'::jsonb,
  baseline_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_balance   numeric,
  total_trades    integer,
  duration_ms     integer,
  monte_carlo     jsonb,
  walk_forward    jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.engine_backtest_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_engine_backtest_runs" ON public.engine_backtest_runs;
CREATE POLICY "users_own_engine_backtest_runs"
  ON public.engine_backtest_runs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_engine_backtest_runs_algo_created
  ON public.engine_backtest_runs (algorithm_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_engine_backtest_runs_user
  ON public.engine_backtest_runs (user_id, created_at DESC);
