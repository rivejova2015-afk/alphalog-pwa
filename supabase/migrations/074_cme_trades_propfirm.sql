-- Migration 074: CME trade history for propfirm accounts (Tradovate)

BEGIN;

CREATE TABLE IF NOT EXISTS public.cme_trades_propfirm (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cme_account_id     UUID NOT NULL REFERENCES public.algo_cme_accounts(id),
  connection_id      UUID REFERENCES public.cme_connections(id),
  algorithm_id       UUID REFERENCES public.algorithms(id),
  signal_id          UUID,
  contract           TEXT NOT NULL,
  direction          TEXT NOT NULL CHECK (direction IN ('BUY','SELL')),
  quantity           INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  entry_price        NUMERIC(14,5),
  exit_price         NUMERIC(14,5),
  fill_price         NUMERIC(14,5),
  stop_loss_price    NUMERIC(14,5),
  take_profit_price  NUMERIC(14,5),
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','filled','cancelled','rejected','closed')),
  broker_order_id    TEXT,
  broker_position_id TEXT,
  fill_timestamp     TIMESTAMPTZ,
  close_reason       TEXT CHECK (close_reason IN
                       ('take_profit','stop_loss','kill_switch','circuit_breaker','manual')),
  pnl_usd            NUMERIC(14,2),
  commission_usd     NUMERIC(14,2),
  slippage_ticks     INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cme_trades_propfirm_user_account_idx
  ON public.cme_trades_propfirm(user_id, cme_account_id, fill_timestamp DESC);
CREATE INDEX IF NOT EXISTS cme_trades_propfirm_algorithm_idx
  ON public.cme_trades_propfirm(algorithm_id);

ALTER TABLE public.cme_trades_propfirm ENABLE ROW LEVEL SECURITY;

CREATE POLICY cme_trades_propfirm_select ON public.cme_trades_propfirm
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY cme_trades_propfirm_insert ON public.cme_trades_propfirm
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY cme_trades_propfirm_update ON public.cme_trades_propfirm
  FOR UPDATE USING (auth.uid() = user_id);

COMMIT;
