-- Migration 078: CME signal queue (agent → risk check → execution)

BEGIN;

CREATE TABLE IF NOT EXISTS public.cme_signals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  algorithm_id      UUID REFERENCES public.algorithms(id),
  cme_account_id    UUID NOT NULL REFERENCES public.algo_cme_accounts(id),
  contract          TEXT NOT NULL,
  direction         TEXT NOT NULL CHECK (direction IN ('BUY','SELL')),
  signal_type       TEXT NOT NULL DEFAULT 'entry' CHECK (signal_type IN ('entry','exit')),
  quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  stop_loss_ticks   INTEGER CHECK (stop_loss_ticks > 0),
  take_profit_ticks INTEGER CHECK (take_profit_ticks > 0),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','executing','executed','rejected','skipped')),
  risk_check_result JSONB,
  reject_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at       TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 seconds')
);

CREATE INDEX IF NOT EXISTS cme_signals_user_status_idx
  ON public.cme_signals(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS cme_signals_algorithm_idx
  ON public.cme_signals(algorithm_id);

ALTER TABLE public.cme_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY cme_signals_select ON public.cme_signals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY cme_signals_insert ON public.cme_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY cme_signals_update ON public.cme_signals
  FOR UPDATE USING (auth.uid() = user_id);

COMMIT;
