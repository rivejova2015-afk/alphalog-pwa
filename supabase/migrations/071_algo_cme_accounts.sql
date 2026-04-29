-- Migration 071: CME futures accounts (propfirm + real broker)
-- Stores saved CME accounts that can be linked to algorithm strategies.

BEGIN;

CREATE TABLE IF NOT EXISTS public.algo_cme_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_type    TEXT NOT NULL CHECK (account_type IN ('propfirm', 'broker')),
  provider_name   TEXT NOT NULL,
  account_number  TEXT NOT NULL,
  label           TEXT,
  funded_amount   NUMERIC(14,2),
  max_daily_loss  NUMERIC(14,2),
  max_trailing_dd NUMERIC(14,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS algo_cme_accounts_user_id_idx ON public.algo_cme_accounts(user_id);

ALTER TABLE public.algo_cme_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY algo_cme_accounts_select ON public.algo_cme_accounts
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY algo_cme_accounts_insert ON public.algo_cme_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY algo_cme_accounts_update ON public.algo_cme_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY algo_cme_accounts_delete ON public.algo_cme_accounts
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
