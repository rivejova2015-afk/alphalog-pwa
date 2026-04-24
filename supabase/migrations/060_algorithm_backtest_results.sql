-- Migration 060: algorithm_backtest_results — resultados de Strategy Tester MT5/MT4

CREATE TABLE public.algorithm_backtest_results (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id),
  algorithm_id   UUID        NOT NULL REFERENCES public.trading_algorithms(id),
  platform       TEXT        NOT NULL CHECK (platform IN ('MT4', 'MT5')),
  period_start   DATE,
  period_end     DATE,
  total_trades   INTEGER,
  win_rate       NUMERIC(5,2),   -- 0-100
  profit_factor  NUMERIC(8,4),
  max_drawdown   NUMERIC(5,2),   -- % 0-100
  net_profit     NUMERIC(14,2),
  sharpe_ratio   NUMERIC(8,4),
  recovery_factor NUMERIC(8,4),
  raw_data       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backtest_results_algorithm
  ON public.algorithm_backtest_results(algorithm_id, created_at DESC);

ALTER TABLE public.algorithm_backtest_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backtest_all_own"
  ON public.algorithm_backtest_results FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
