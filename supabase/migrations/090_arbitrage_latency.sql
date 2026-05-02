-- Migration 090: Latency Arbitrage Cross-Broker (MT5)
-- Tabla de pares broker-rápido / broker-lento + columnas de latencia en bot_telemetry
-- + template `latency_arb_mt5` seedeado en algorithm_templates.

BEGIN;

-- =========================================================================
-- TABLE: arbitrage_latency_pairs
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.arbitrage_latency_pairs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  algorithm_id        UUID        NOT NULL REFERENCES public.algorithms(id) ON DELETE CASCADE,
  fast_bot_account_id UUID        NOT NULL REFERENCES public.bot_accounts(id) ON DELETE CASCADE,
  slow_bot_account_id UUID        NOT NULL REFERENCES public.bot_accounts(id) ON DELETE CASCADE,
  symbol              TEXT        NOT NULL,
  max_skew_points     INTEGER     NOT NULL DEFAULT 30  CHECK (max_skew_points > 0),
  min_pulse_ticks     INTEGER     NOT NULL DEFAULT 5   CHECK (min_pulse_ticks  >= 1),
  pulse_window_ms     INTEGER     NOT NULL DEFAULT 800 CHECK (pulse_window_ms  > 0),
  max_hold_seconds    INTEGER     NOT NULL DEFAULT 300 CHECK (max_hold_seconds >= 10 AND max_hold_seconds <= 600),
  min_hold_seconds    INTEGER     NOT NULL DEFAULT 60  CHECK (min_hold_seconds >= 5),
  enabled             BOOLEAN     NOT NULL DEFAULT false,
  last_signal_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fast_bot_account_id <> slow_bot_account_id),
  CHECK (min_hold_seconds <= max_hold_seconds)
);

CREATE INDEX IF NOT EXISTS idx_arb_latency_pairs_user_enabled
  ON public.arbitrage_latency_pairs (user_id, enabled, symbol);

CREATE INDEX IF NOT EXISTS idx_arb_latency_pairs_algo
  ON public.arbitrage_latency_pairs (algorithm_id);

ALTER TABLE public.arbitrage_latency_pairs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS arb_latency_pairs_own ON public.arbitrage_latency_pairs;
CREATE POLICY arb_latency_pairs_own ON public.arbitrage_latency_pairs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS arb_latency_pairs_service ON public.arbitrage_latency_pairs;
CREATE POLICY arb_latency_pairs_service ON public.arbitrage_latency_pairs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS arb_latency_pairs_set_updated_at ON public.arbitrage_latency_pairs;
CREATE TRIGGER arb_latency_pairs_set_updated_at
  BEFORE UPDATE ON public.arbitrage_latency_pairs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- ALTER: bot_telemetry — añadir columnas de latencia
-- =========================================================================
ALTER TABLE public.bot_telemetry
  ADD COLUMN IF NOT EXISTS feed_latency_ms      INTEGER,
  ADD COLUMN IF NOT EXISTS execution_latency_ms INTEGER;

-- =========================================================================
-- SEED: template latency_arb_mt5
-- =========================================================================
INSERT INTO public.algorithm_templates (
  template_key, name, description,
  market_type, algo_type,
  default_instrument, default_direction,
  default_lot_size, default_max_trades, default_risk_percent,
  magic_number, source_path, sort_index, parameters, supported_platforms
) VALUES (
  'latency_arb_mt5',
  'Latency Arb Cross-Broker (XAUUSD)',
  'Bot de arbitraje de latencia entre dos brokers MT5: detecta cuando el broker rápido adelanta al lento por encima de un threshold (max_skew_points) y valida que el movimiento es momentum sostenido (min_pulse_ticks dentro de pulse_window_ms) usando el quantum-math signal engine. Hold 1-5 min, kill-switch diario al -5%.',
  'forex', 'arbitrage',
  'XAUUSD', 'both',
  0.01, 10, 0.5,
  NULL,
  'src/lib/bot/arbitrage/latency-detector.ts',
  10,
  jsonb_build_object(
    'max_skew_points',   30,
    'min_pulse_ticks',   5,
    'pulse_window_ms',   800,
    'min_hold_seconds',  60,
    'max_hold_seconds',  300,
    'sessions',          jsonb_build_array('LONDON','NY','OVERLAP'),
    'pulse_engine',      'quantum_math_v1',
    'kelly_fraction',    0.20,
    'daily_dd_limit',    0.05,
    'risk_percent',      0.5,
    'max_correlation',   0.6,
    'engine_version',    '1.0.0',
    'seed',              42,
    'audit_trail_enabled', true
  ),
  ARRAY['MT5']::TEXT[]
)
ON CONFLICT (template_key) DO UPDATE SET
  description = EXCLUDED.description,
  parameters  = EXCLUDED.parameters,
  source_path = EXCLUDED.source_path,
  supported_platforms = EXCLUDED.supported_platforms;

COMMIT;

NOTIFY pgrst, 'reload schema';
