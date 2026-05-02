-- Migration 085: algo_paper_trades — paper execution log for trading_algorithms in 'paper' state
-- Simpler schema than paper_trades (which mirrors the trades table).
-- Used when an algorithm's status = 'paper' and signals are routed here instead of a broker.

CREATE TABLE IF NOT EXISTS public.algo_paper_trades (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  algorithm_id UUID        REFERENCES public.trading_algorithms(id) ON DELETE SET NULL,
  symbol       TEXT        NOT NULL,
  direction    TEXT        NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  entry_price  NUMERIC(14,5),
  exit_price   NUMERIC(14,5),
  pnl          NUMERIC(14,2),
  status       TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  source       TEXT        NOT NULL DEFAULT 'signal' CHECK (source IN ('signal', 'webhook', 'manual')),
  opened_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_algo_paper_trades_user_created
  ON public.algo_paper_trades(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_algo_paper_trades_algorithm_created
  ON public.algo_paper_trades(algorithm_id, created_at DESC)
  WHERE algorithm_id IS NOT NULL;

ALTER TABLE public.algo_paper_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY algo_paper_trades_all ON public.algo_paper_trades
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
