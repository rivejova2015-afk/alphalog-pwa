-- Migration 073: CME risk configuration per account (circuit breaker, pause)

BEGIN;

CREATE TABLE IF NOT EXISTS public.cme_risk_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cme_account_id      UUID NOT NULL REFERENCES public.algo_cme_accounts(id) ON DELETE CASCADE,
  circuit_breaker_pct NUMERIC(5,2) NOT NULL DEFAULT 80
                        CHECK (circuit_breaker_pct > 0 AND circuit_breaker_pct <= 100),
  max_positions       INTEGER CHECK (max_positions > 0),
  enabled             BOOLEAN NOT NULL DEFAULT true,
  paused_reason       TEXT CHECK (paused_reason IN ('circuit_breaker','manual','violation')),
  paused_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, cme_account_id)
);

CREATE INDEX IF NOT EXISTS cme_risk_configs_user_id_idx ON public.cme_risk_configs(user_id);

ALTER TABLE public.cme_risk_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY cme_risk_configs_select ON public.cme_risk_configs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY cme_risk_configs_insert ON public.cme_risk_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY cme_risk_configs_update ON public.cme_risk_configs
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY cme_risk_configs_delete ON public.cme_risk_configs
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
