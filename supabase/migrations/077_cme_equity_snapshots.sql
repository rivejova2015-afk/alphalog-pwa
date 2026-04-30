-- Migration 077: CME equity curve snapshots (append-only, every 60s)

BEGIN;

CREATE TABLE IF NOT EXISTS public.cme_equity_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cme_account_id UUID NOT NULL REFERENCES public.algo_cme_accounts(id),
  equity_usd     NUMERIC(14,2) NOT NULL,
  balance_usd    NUMERIC(14,2) NOT NULL,
  daily_pnl_usd  NUMERIC(14,2) NOT NULL DEFAULT 0,
  open_pnl_usd   NUMERIC(14,2) NOT NULL DEFAULT 0,
  snapshot_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cme_equity_snapshots_user_account_time_idx
  ON public.cme_equity_snapshots(user_id, cme_account_id, snapshot_at DESC);

ALTER TABLE public.cme_equity_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY cme_equity_snapshots_select ON public.cme_equity_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY cme_equity_snapshots_insert ON public.cme_equity_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;
