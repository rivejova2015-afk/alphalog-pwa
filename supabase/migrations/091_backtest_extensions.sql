-- 091_backtest_extensions.sql
-- L1/L5/L8/L11/L14/L15 supporting tables and columns for the 15-level
-- backtest upgrade.

-- L5/L8: extra result columns surfaced by the orchestrator
ALTER TABLE public.backtest_results
  ADD COLUMN IF NOT EXISTS regime     jsonb,
  ADD COLUMN IF NOT EXISTS robustness jsonb;

-- L1: persisted multi-symbol portfolio backtest outputs
CREATE TABLE IF NOT EXISTS public.portfolio_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label           text NOT NULL,
  legs            jsonb NOT NULL,
  portfolio_equity jsonb NOT NULL,
  metrics         jsonb NOT NULL,
  ran_from        timestamptz NOT NULL,
  ran_to          timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portfolio_results_user_created
  ON public.portfolio_results (user_id, created_at DESC);

ALTER TABLE public.portfolio_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY portfolio_results_own ON public.portfolio_results FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY portfolio_results_service ON public.portfolio_results FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- L15: daemon state — strategy decay tracking
CREATE TABLE IF NOT EXISTS public.backtest_daemon_state (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  algorithm_id        uuid NOT NULL REFERENCES public.algorithms(id) ON DELETE CASCADE,
  last_check_at       timestamptz NOT NULL DEFAULT now(),
  last_oos_sharpe     numeric,
  last_is_sharpe      numeric,
  decay_alert         boolean NOT NULL DEFAULT false,
  decay_alert_emitted_at timestamptz,
  meta                jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (algorithm_id)
);

CREATE INDEX IF NOT EXISTS backtest_daemon_user
  ON public.backtest_daemon_state (user_id, last_check_at DESC);

ALTER TABLE public.backtest_daemon_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY daemon_state_own ON public.backtest_daemon_state FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY daemon_state_service ON public.backtest_daemon_state FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS daemon_state_set_updated_at ON public.backtest_daemon_state;
CREATE TRIGGER daemon_state_set_updated_at
  BEFORE UPDATE ON public.backtest_daemon_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- L11: persisted ML model weights
CREATE TABLE IF NOT EXISTS public.ml_models (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  algorithm_id    uuid REFERENCES public.algorithms(id) ON DELETE SET NULL,
  kind            text NOT NULL CHECK (kind IN ('logreg','rl_policy','xgb','lgbm','onnx')),
  symbol          text,
  timeframe       text,
  feature_names   text[] NOT NULL DEFAULT '{}',
  weights         jsonb NOT NULL,
  train_acc       numeric,
  valid_acc       numeric,
  trained_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ml_models_user_kind
  ON public.ml_models (user_id, kind, trained_at DESC);

ALTER TABLE public.ml_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY ml_models_own ON public.ml_models FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY ml_models_service ON public.ml_models FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- L14: paper-bridge signals (separate from existing paper_trades — these are
-- backtest-engine-generated, not broker-executed)
CREATE TABLE IF NOT EXISTS public.backtest_paper_signals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  algorithm_id    uuid NOT NULL REFERENCES public.algorithms(id) ON DELETE CASCADE,
  signal_ts       timestamptz NOT NULL,
  symbol          text NOT NULL,
  timeframe       text NOT NULL,
  side            text NOT NULL CHECK (side IN ('long','short','flat')),
  entry_price     numeric,
  sl_price        numeric,
  tp_price        numeric,
  expected_pnl    numeric,
  source          text NOT NULL DEFAULT 'paper_bridge',
  meta            jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS backtest_paper_signals_algo_ts
  ON public.backtest_paper_signals (algorithm_id, signal_ts DESC);

ALTER TABLE public.backtest_paper_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY paper_signals_own ON public.backtest_paper_signals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY paper_signals_service ON public.backtest_paper_signals FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
