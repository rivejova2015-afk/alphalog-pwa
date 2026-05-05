-- Migration 096: engine_config column + Base Engine v1 template + phase log
-- Adds the structured engine_config JSONB to algorithms (canonical) and
-- trading_algorithms (legacy POST surface), seeds the Base Engine v1 template,
-- relaxes the algo_type CHECK to admit 'base_engine', cleans up legacy template
-- params, repoints the version_pinned quality gate, and creates a per-strategy
-- phase change log.

-- ── 1. engine_config column ───────────────────────────────────────────────
ALTER TABLE public.algorithms
  ADD COLUMN IF NOT EXISTS engine_config jsonb DEFAULT NULL;

ALTER TABLE public.trading_algorithms
  ADD COLUMN IF NOT EXISTS engine_config jsonb DEFAULT NULL;

-- ── 2. Clean legacy goldrangebasketr params ───────────────────────────────
UPDATE public.algorithm_templates
SET parameters = parameters
  - 'decision_engine_enabled'
  - 'order_flow_enabled'
  - 'range_gate_enabled'
WHERE template_key = 'goldrangebasketr';

-- ── 3. Repoint version_pinned quality gate ────────────────────────────────
UPDATE public.algorithm_quality_gate_definitions
SET source_field = 'engine_config.engine_version'
WHERE gate_key = 'version_pinned';

-- ── 4. Relax algo_type CHECK to admit 'base_engine' ──────────────────────
ALTER TABLE public.algorithm_templates
  DROP CONSTRAINT IF EXISTS algorithm_templates_algo_type_check;

ALTER TABLE public.algorithm_templates
  ADD CONSTRAINT algorithm_templates_algo_type_check
  CHECK (algo_type = ANY (ARRAY['scalping','grid_basket','arbitrage','base_engine']));

-- ── 5. algorithm_phase_log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.algorithm_phase_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id),
  algorithm_id      uuid NOT NULL REFERENCES public.algorithms(id),
  from_phase        text,
  to_phase          text,
  from_risk_pct     numeric,
  to_risk_pct       numeric,
  capital_at_change numeric,
  reason            text,
  changed_at        timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.algorithm_phase_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_phase_log" ON public.algorithm_phase_log;
CREATE POLICY "users_own_phase_log"
ON public.algorithm_phase_log
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_algorithm_phase_log_algorithm
  ON public.algorithm_phase_log (algorithm_id, changed_at DESC);

-- ── 6. Base Engine v1 template ────────────────────────────────────────────
INSERT INTO public.algorithm_templates (
  template_key,
  name,
  description,
  market_type,
  algo_type,
  default_instrument,
  default_direction,
  default_lot_size,
  default_max_trades,
  default_risk_percent,
  parameters,
  is_active,
  sort_index,
  supported_platforms
) VALUES (
  'base_engine_v1',
  'Base Engine v1',
  'Engine base con análisis Multi-Timeframe ponderado (D1/H4/H1/M15/M5/M1), detección de Order Blocks y Fair Value Gaps, probabilidad en cascada, gestión de capital por fases (11 fases 1%→15%) y circuit breaker de 3 niveles. Default inamovible para todas las estrategias nuevas.',
  'forex',
  'base_engine',
  'XAUUSD',
  'both',
  0.01,
  100,
  1,
  '{
    "multi_tf": {
      "timeframes": [
        {"tf": "D1",  "weight": 0.30, "role": "trend_liquidity"},
        {"tf": "H4",  "weight": 0.25, "role": "structure_liquidity"},
        {"tf": "H1",  "weight": 0.20, "role": "structure_session"},
        {"tf": "M15", "weight": 0.15, "role": "order_blocks"},
        {"tf": "M5",  "weight": 0.07, "role": "impulse_confirm"},
        {"tf": "M1",  "weight": 0.03, "role": "execution"}
      ],
      "min_bias_score": 60,
      "sessions": {
        "XAUUSD": [
          {"name": "London", "start_gmt": "08:00", "end_gmt": "12:00"},
          {"name": "NY",     "start_gmt": "13:30", "end_gmt": "17:00"}
        ],
        "US500": [
          {"name": "NY", "start_gmt": "13:30", "end_gmt": "20:00"}
        ]
      }
    }
  }'::jsonb,
  true,
  0,
  ARRAY['MT4','MT5']
)
ON CONFLICT (template_key) DO NOTHING;
