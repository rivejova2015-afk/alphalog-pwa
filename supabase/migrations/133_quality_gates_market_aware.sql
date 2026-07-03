-- Migration 133: quality gates market-aware (TIER_1 relativo, no hardcodeado a 20)
--
-- Migration 089 definió TIER_1 como `gates_passed >= 20` (literal hardcodeado).
-- Eso asume que las 20 gate definitions SIEMPRE se insertan para todo
-- algoritmo. Con el fix de app-layer que marca heartbeat_active/latency_p99
-- como "no aplicable" para mercados sin telemetría wireada (CME, y latency
-- para crypto), esos algoritmos nunca insertan esas filas — su gates_total
-- real es < 20, y el `>= 20` hardcodeado los deja permanentemente en
-- NOT_READY/TIER_2 sin importar qué tan bien operen.
--
-- Fix: TIER_1 = "0 must-gates fallados Y todos los gates aplicables (los que
-- SÍ se insertaron) pasaron" — relativo a gates_total, no a un literal fijo.

BEGIN;

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
      AND COUNT(*) FILTER (WHERE l.passed) = COUNT(*)
      THEN 'TIER_1'
    WHEN COUNT(*) FILTER (WHERE NOT l.passed AND d.severity='must') = 0
      THEN 'TIER_2'
    ELSE 'NOT_READY'
  END AS tier
FROM latest l
JOIN public.algorithm_quality_gate_definitions d USING (gate_key)
GROUP BY l.algorithm_id, l.user_id;

ALTER VIEW public.algorithm_quality_score SET (security_invoker = true);

COMMIT;

NOTIFY pgrst, 'reload schema';
