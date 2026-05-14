-- Migration 103: repoint algo_paper_trades.algorithm_id FK.
-- Migration 085 pointed it at trading_algorithms (legacy). The /api/webhooks
-- /algo-trade route (Phase A) now resolves algorithms against the canonical
-- `algorithms` table, so paper-trade inserts carry an algorithms.id — which
-- would violate the old FK. Same fix shape as migration 098 did for
-- algorithm_deployments.

ALTER TABLE public.algo_paper_trades
  DROP CONSTRAINT IF EXISTS algo_paper_trades_algorithm_id_fkey;

ALTER TABLE public.algo_paper_trades
  ADD CONSTRAINT algo_paper_trades_algorithm_id_fkey
  FOREIGN KEY (algorithm_id) REFERENCES public.algorithms(id) ON DELETE SET NULL;
