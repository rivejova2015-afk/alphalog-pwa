-- Migration 072: CME connection state + is_paper column for algo_cme_accounts

BEGIN;

ALTER TABLE public.algo_cme_accounts
  ADD COLUMN IF NOT EXISTS is_paper BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.cme_connections (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cme_account_id         UUID NOT NULL REFERENCES public.algo_cme_accounts(id) ON DELETE CASCADE,
  status                 TEXT NOT NULL DEFAULT 'disconnected'
                           CHECK (status IN ('connected','disconnected','error','paused')),
  broker_type            TEXT NOT NULL DEFAULT 'tradovate'
                           CHECK (broker_type IN ('tradovate','ibkr','tradestation')),
  tradovate_account_id   INTEGER,
  tradovate_account_spec TEXT,
  access_token_vault_key TEXT,
  token_expires_at       TIMESTAMPTZ,
  daily_pnl_usd          NUMERIC(14,2) DEFAULT 0,
  last_error             TEXT,
  error_at               TIMESTAMPTZ,
  last_connected_at      TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, cme_account_id)
);

CREATE INDEX IF NOT EXISTS cme_connections_user_id_idx ON public.cme_connections(user_id);
CREATE INDEX IF NOT EXISTS cme_connections_status_idx ON public.cme_connections(status);

ALTER TABLE public.cme_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY cme_connections_select ON public.cme_connections
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY cme_connections_insert ON public.cme_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY cme_connections_update ON public.cme_connections
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY cme_connections_delete ON public.cme_connections
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
