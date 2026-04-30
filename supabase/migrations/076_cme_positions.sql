-- Migration 076: CME real-time open positions (refreshed every 30s by cron)

BEGIN;

CREATE TABLE IF NOT EXISTS public.cme_positions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cme_account_id     UUID NOT NULL REFERENCES public.algo_cme_accounts(id),
  connection_id      UUID REFERENCES public.cme_connections(id),
  algorithm_id       UUID REFERENCES public.algorithms(id),
  contract           TEXT NOT NULL,
  direction          TEXT NOT NULL CHECK (direction IN ('LONG','SHORT')),
  quantity           INTEGER NOT NULL CHECK (quantity > 0),
  avg_entry_price    NUMERIC(14,5),
  current_price      NUMERIC(14,5),
  unrealized_pnl_usd NUMERIC(14,2),
  stop_loss_price    NUMERIC(14,5),
  take_profit_price  NUMERIC(14,5),
  broker_position_id TEXT,
  is_manual          BOOLEAN NOT NULL DEFAULT false,
  opened_at          TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, cme_account_id, broker_position_id)
);

CREATE INDEX IF NOT EXISTS cme_positions_user_account_idx
  ON public.cme_positions(user_id, cme_account_id);

ALTER TABLE public.cme_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cme_positions_select ON public.cme_positions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY cme_positions_insert ON public.cme_positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY cme_positions_update ON public.cme_positions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY cme_positions_delete ON public.cme_positions
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
