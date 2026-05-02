-- Migration 089: Universal Tier-1 Quality Gates
-- Sistema universal de quality gates: 20 criterios (15 must + 5 should) que cada
-- algorithm debe pasar antes de promover a 'live'. Basado en standards de
-- prop trading institucional (edge, capital, microstructure, ops).

BEGIN;

-- =========================================================================
-- TABLE: algorithm_quality_gate_definitions (seed global, 20 filas)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.algorithm_quality_gate_definitions (
  gate_key        TEXT        PRIMARY KEY,
  name            TEXT        NOT NULL,
  category        TEXT        NOT NULL CHECK (category IN ('edge','capital','micro','ops')),
  severity        TEXT        NOT NULL CHECK (severity IN ('must','should')),
  threshold_op    TEXT        NOT NULL CHECK (threshold_op IN ('>=','<=','<','>','==')),
  threshold_value NUMERIC     NOT NULL,
  unit            TEXT,
  description     TEXT        NOT NULL,
  source_field    TEXT        NOT NULL,
  sort_index      INTEGER     NOT NULL,
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.algorithm_quality_gate_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY quality_gate_definitions_select_all
  ON public.algorithm_quality_gate_definitions
  FOR SELECT TO authenticated USING (true);

-- =========================================================================
-- TABLE: algorithm_quality_gate_results (per-algorithm, recomputado on-demand)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.algorithm_quality_gate_results (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  algorithm_id   UUID        NOT NULL REFERENCES public.algorithms(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gate_key       TEXT        NOT NULL REFERENCES public.algorithm_quality_gate_definitions(gate_key),
  passed         BOOLEAN     NOT NULL,
  value_observed NUMERIC,
  reason         TEXT,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_gate_results_algo_computed
  ON public.algorithm_quality_gate_results (algorithm_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_quality_gate_results_user
  ON public.algorithm_quality_gate_results (user_id, computed_at DESC);

ALTER TABLE public.algorithm_quality_gate_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY quality_gate_results_own
  ON public.algorithm_quality_gate_results FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY quality_gate_results_service
  ON public.algorithm_quality_gate_results FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- =========================================================================
-- VIEW: algorithm_quality_score (último score por algorithm)
-- =========================================================================
CREATE OR REPLACE VIEW public.algorithm_quality_score AS
WITH latest AS (
  SELECT DISTINCT ON (algorithm_id, gate_key)
    algorithm_id, user_id, gate_key, passed, value_observed, reason, computed_at
  FROM public.algorithm_quality_gate_results
  ORDER BY algorithm_id, gate_key, computed_at DESC
)
SELECT
  l.algorithm_id,
  l.user_id,
  COUNT(*)                                                AS gates_total,
  COUNT(*) FILTER (WHERE l.passed)                        AS gates_passed,
  COUNT(*) FILTER (WHERE NOT l.passed AND d.severity='must')   AS must_failed,
  COUNT(*) FILTER (WHERE NOT l.passed AND d.severity='should') AS should_failed,
  MAX(l.computed_at)                                      AS last_computed_at,
  CASE
    WHEN COUNT(*) FILTER (WHERE NOT l.passed AND d.severity='must') = 0
      AND COUNT(*) FILTER (WHERE l.passed) >= 20
      THEN 'TIER_1'
    WHEN COUNT(*) FILTER (WHERE NOT l.passed AND d.severity='must') = 0
      THEN 'TIER_2'
    ELSE 'NOT_READY'
  END AS tier
FROM latest l
JOIN public.algorithm_quality_gate_definitions d USING (gate_key)
GROUP BY l.algorithm_id, l.user_id;

ALTER VIEW public.algorithm_quality_score SET (security_invoker = true);

-- =========================================================================
-- SEED: 20 quality gates definitions
-- =========================================================================
INSERT INTO public.algorithm_quality_gate_definitions
  (gate_key, name, category, severity, threshold_op, threshold_value, unit, description, source_field, sort_index)
VALUES
  -- ── EDGE (1-6) ──────────────────────────────────────────────────────────
  ('sharpe_oos',         'Sharpe OOS ≥ 1.5',           'edge',    'must',   '>=', 1.5,  'ratio', 'Sharpe ratio out-of-sample del walk-forward debe ser ≥ 1.5',                                          'walk_forward.oos.sharpe',           1),
  ('sample_size',        'Sample size ≥ 500 trades',   'edge',    'must',   '>=', 500,  'count', 'Backtest debe tener al menos 500 trades para inferencia estadística válida',                          'metrics.totalTrades',               2),
  ('walk_forward_eff',   'Walk-forward efficiency ≥ 0.5','edge',  'must',   '>=', 0.5,  'ratio', 'OOS Sharpe / IS Sharpe ≥ 0.5 — el edge persiste fuera de muestra',                                    'walk_forward.efficiency',           3),
  ('oos_pct',            'OOS coverage ≥ 30%',          'edge',   'must',   '>=', 30,   '%',     'Al menos 30% de las barras del backtest fueron evaluadas out-of-sample',                              'walk_forward.oos_pct',              4),
  ('profit_factor',      'Profit factor ≥ 1.4',         'edge',   'must',   '>=', 1.4,  'ratio', 'Suma ganancias / suma pérdidas ≥ 1.4',                                                                'metrics.profitFactor',              5),
  ('regime_consistency', 'Regime CV ≤ 0.3',             'edge',   'should', '<=', 0.3,  'ratio', 'Coefficient of variation del Sharpe entre regímenes ≤ 0.3 (consistencia cross-regime)',              'stress_tests.regime_cv',            6),

  -- ── CAPITAL (7-11) ─────────────────────────────────────────────────────
  ('risk_per_trade',     'Riesgo por trade ≤ 1%',      'capital', 'must',   '<=', 1.0,  '%',     'risk_percent del algorithm ≤ 1% del equity por trade',                                                'parameters.risk_percent',           7),
  ('kelly_fraction',     'Kelly fraction ≤ 0.25',       'capital','must',   '<=', 0.25, 'ratio', 'Fracción de Kelly aplicada ≤ ¼ Kelly (full Kelly es ruina con error en estimación)',                  'metrics.kelly_fraction',            8),
  ('max_drawdown',       'Max drawdown < 20%',          'capital','must',   '<',  20,   '%',     'Drawdown máximo del backtest < 20% del equity',                                                       'metrics.maxDrawdown',               9),
  ('correlation_cap',    'Correlación cross-strategy ≤ 0.7','capital','should','<=',0.7,'ratio','Correlación con otros algos en cartera ≤ 0.7',                                                          'parameters.max_correlation',       10),
  ('dd_limits_set',      'Daily DD limit configurado',   'capital','must',   '==', 1,    'bool',  'parameters.daily_dd_limit definido (kill-switch diario)',                                              'parameters.daily_dd_limit',        11),

  -- ── MICRO (12-15) ──────────────────────────────────────────────────────
  ('slippage_realistic', 'Slippage modelado por liquidez','micro','should',  '==', 1,    'bool',  'Backtest config.slippage_model = liquidity_bucket (no constante)',                                    'config.slippage_model',            12),
  ('costs_included',     'Spread + comisión + swap incluidos','micro','must','==', 1,    'bool',  'Config tiene los 3 costos modelados (no solo spread)',                                                 'config.costs_complete',            13),
  ('latency_p99',        'Latencia ejecución p99 ≤ 250ms','micro','should',  '<=', 250,  'ms',    'p99 de execution_latency_ms en bot_telemetry ≤ 250ms',                                                'bot_telemetry.execution_p99',      14),
  ('survivorship_clean', 'Datos sin survivorship bias',  'micro','should',   '==', 1,    'bool',  'config.include_delisted = true (incluye instrumentos delisted/expirados)',                            'config.include_delisted',          15),

  -- ── OPS (16-20) ────────────────────────────────────────────────────────
  ('heartbeat_active',   'Heartbeat reciente ≤ 120s',    'ops',   'must',   '<=', 120,  'sec',   'Última heartbeat del bot account ≤ 120s atrás',                                                       'bot_telemetry.heartbeat_age_sec', 16),
  ('kill_switch_wired',  'Kill switch ack < 2s',         'ops',   'must',   '==', 1,    'bool',  'Último comando KILL fue ack-eado en <2s (verificable en bot_command_status)',                         'bot_commands.kill_ack_ms',        17),
  ('audit_trail',        'Audit trail completo',         'ops',   'must',   '==', 1,    'bool',  'Cada trade tiene signal_payload + fill_payload registrados',                                            'audit_completeness',              18),
  ('version_pinned',     'Engine version + seed pineados','ops',  'must',   '==', 1,    'bool',  'parameters.engine_version + parameters.seed presentes (reproducibilidad)',                              'parameters.engine_version',       19),
  ('forward_paper_30d',  'Forward paper ≥ 100 trades últimos 30d','ops','must','>=',100,'count','Al menos 100 trades en algo_paper_trades en los últimos 30 días',                                       'algo_paper_trades.recent_count',  20)
ON CONFLICT (gate_key) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  severity = EXCLUDED.severity,
  threshold_op = EXCLUDED.threshold_op,
  threshold_value = EXCLUDED.threshold_value,
  unit = EXCLUDED.unit,
  description = EXCLUDED.description,
  source_field = EXCLUDED.source_field,
  sort_index = EXCLUDED.sort_index;

COMMIT;

NOTIFY pgrst, 'reload schema';
