-- Migration 047: Signal engine session state (circuit breaker, P&L, Kelly, regime)

CREATE TABLE IF NOT EXISTS public.bot_signal_engine_state (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_instance_id         UUID NOT NULL REFERENCES public.bot_instances(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL DEFAULT '381e268e-a042-4612-8b39-7a120ace17d6',
  session_date            DATE NOT NULL,
  session_open            TIMESTAMPTZ NULL,
  session_close           TIMESTAMPTZ NULL,
  daily_pnl_pct           DECIMAL(10,6) NOT NULL DEFAULT 0,
  circuit_breaker_triggered BOOLEAN NOT NULL DEFAULT false,
  circuit_breaker_at      TIMESTAMPTZ NULL,
  circuit_breaker_reason  TEXT NULL,
  ops_count               INTEGER NOT NULL DEFAULT 0,
  current_equity          DECIMAL(18,2) NULL,
  session_base_equity     DECIMAL(18,2) NULL,
  quantum_state           JSONB NULL,
  kelly_current           DECIMAL(10,6) NULL,
  vol_target_current      DECIMAL(10,6) NULL,
  regime_code             TEXT NULL DEFAULT 'SIDEWAYS_LOW_VOL',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT bot_signal_engine_state_unique_session
    UNIQUE (bot_instance_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_bot_signal_engine_state_instance_date
  ON public.bot_signal_engine_state(bot_instance_id, session_date);

ALTER TABLE public.bot_signal_engine_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY bot_signal_engine_state_select_own ON public.bot_signal_engine_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY bot_signal_engine_state_insert_own ON public.bot_signal_engine_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY bot_signal_engine_state_update_own ON public.bot_signal_engine_state
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY bot_signal_engine_state_delete_own ON public.bot_signal_engine_state
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS bot_signal_engine_state_updated_at ON public.bot_signal_engine_state;
CREATE TRIGGER bot_signal_engine_state_updated_at
  BEFORE UPDATE ON public.bot_signal_engine_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
