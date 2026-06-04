-- Migration 120: algorithms.default_backtest_balance (numeric, nullable)
--
-- Optional default starting capital for the engine-backtest endpoint. When the
-- algorithm is unbound (linked_bot_account_id IS NULL), the backtest panel
-- prefills "Capital inicial" with this value; null falls back to $10K. The
-- user can still override per run — value is just a default, not a constraint.
--
-- Part of the "algorithms without account" sprint: lets you create research
-- algos, run backtests with a fictional capital, and persist your preferred
-- default per strategy. Vincular cuenta sigue siendo opcional via el botón
-- "Deploy to account" en el detail modal.

ALTER TABLE public.algorithms
  ADD COLUMN IF NOT EXISTS default_backtest_balance NUMERIC
    CHECK (default_backtest_balance IS NULL OR default_backtest_balance > 0);

COMMENT ON COLUMN public.algorithms.default_backtest_balance IS
  'Optional default capital ($) prefilled in the backtest panel when the algorithm has no linked_bot_account_id. Overridable per run.';

NOTIFY pgrst, 'reload schema';
