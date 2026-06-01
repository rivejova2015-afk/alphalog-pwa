-- Migration 115: engine_backtest_runs.advanced (jsonb)
--
-- Espejo de 114 sobre la tabla del pipeline sincrónico. Cuando el usuario
-- activa useMl / useMultiTf / usePortfolio en `EngineBacktestPanel`, el
-- endpoint `/api/algorithms/[id]/engine-backtest` corre `runAdvancedPipeline`
-- sobre los bars del TF principal y persiste el resultado acá para que la
-- pestaña de historial pueda re-render del bloque "Pipeline avanzado".
--
-- NULL cuando ningún flag está activo (mismo contrato que backtest_results).

ALTER TABLE public.engine_backtest_runs
  ADD COLUMN IF NOT EXISTS advanced JSONB;

NOTIFY pgrst, 'reload schema';
