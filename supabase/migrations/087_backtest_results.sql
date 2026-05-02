-- 087_backtest_results.sql
-- Heavy result data separated from backtest_jobs

CREATE TABLE IF NOT EXISTS public.backtest_results (
  job_id         uuid PRIMARY KEY REFERENCES public.backtest_jobs(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metrics        jsonb NOT NULL,        -- sharpe, sortino, profit factor, expectancy, etc.
  equity_curve   jsonb NOT NULL,        -- [{ts, equity, drawdown}, ...]
  trades         jsonb NOT NULL,        -- simulated trade list
  monte_carlo    jsonb,                 -- percentile bands + distribution stats
  walk_forward   jsonb,                 -- IS/OOS windows
  stress_tests   jsonb,                 -- spread×2, comm+50%, etc.
  sensitivity    jsonb,                 -- parameter sweep heatmap
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.backtest_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY backtest_results_own ON public.backtest_results FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY backtest_results_service ON public.backtest_results FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
