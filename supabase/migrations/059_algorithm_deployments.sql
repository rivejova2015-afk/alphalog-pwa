-- Migration 059: algorithm_deployments — asignación de algoritmos a cuentas bot
-- Un algoritmo puede desplegarse en múltiples cuentas (1→N y N→1)

CREATE TABLE public.algorithm_deployments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id),
  algorithm_id   UUID        NOT NULL REFERENCES public.trading_algorithms(id),
  bot_account_id UUID        NOT NULL REFERENCES public.bot_accounts(id),
  status         TEXT        NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'paused', 'stopped')),
  deployed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at     TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solo un deploy activo por algoritmo+cuenta
CREATE UNIQUE INDEX idx_algorithm_deployments_active
  ON public.algorithm_deployments(algorithm_id, bot_account_id)
  WHERE status = 'active';

CREATE INDEX idx_algorithm_deployments_algorithm
  ON public.algorithm_deployments(algorithm_id, status);

CREATE INDEX idx_algorithm_deployments_account
  ON public.algorithm_deployments(bot_account_id, status);

ALTER TABLE public.algorithm_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deployments_all_own"
  ON public.algorithm_deployments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_algorithm_deployments_updated_at
  BEFORE UPDATE ON public.algorithm_deployments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
