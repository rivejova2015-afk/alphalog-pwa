-- Migration 048: HMM regime detection snapshots (immutable, append-only)

CREATE TABLE IF NOT EXISTS public.bot_regime_states (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_instance_id     UUID NOT NULL REFERENCES public.bot_instances(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL DEFAULT '381e268e-a042-4612-8b39-7a120ace17d6',
  detected_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  regime_code         TEXT NOT NULL CHECK (regime_code IN (
                        'BULL_TREND_STRONG',
                        'BULL_TREND_WEAK',
                        'BEAR_TREND_STRONG',
                        'BEAR_TREND_WEAK',
                        'SIDEWAYS_LOW_VOL',
                        'SIDEWAYS_HIGH_VOL',
                        'BREAKOUT_IMMINENT'
                      )),
  hmm_state_probs     JSONB NOT NULL DEFAULT '{}',
  hmm_viterbi_path    JSONB NULL,
  strategy_applied    TEXT NOT NULL DEFAULT 'MEAN_REVERSION',
  confidence          DECIMAL(5,4) NOT NULL DEFAULT 0.5
                        CHECK (confidence BETWEEN 0 AND 1),
  features_snapshot   JSONB NOT NULL DEFAULT '{}',
  is_cold_start       BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_regime_states_instance_detected
  ON public.bot_regime_states(bot_instance_id, detected_at DESC);

ALTER TABLE public.bot_regime_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY bot_regime_states_select_own ON public.bot_regime_states
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY bot_regime_states_insert_own ON public.bot_regime_states
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY bot_regime_states_delete_own ON public.bot_regime_states
  FOR DELETE USING (auth.uid() = user_id);
