-- Migration 121: engine_backtest_runs.advanced (jsonb)
--
-- Originally numbered 115 but renumbered to 121 in 2026-06 to remove a
-- version collision with 115_copy_group_nodes_sort_index.sql. In production
-- Supabase this migration was applied via MCP and shows up with a timestamp
-- name (20260603132836_engine_backtest_runs_advanced); the IF NOT EXISTS
-- below makes re-applying a no-op in any environment.
--
-- Espejo de 114/118 (backtest_results.advanced) sobre la tabla del pipeline
-- sincrónico. Cuando el usuario activa useMl / useMultiTf / usePortfolio en
-- `EngineBacktestPanel`, el endpoint `/api/algorithms/[id]/engine-backtest`
-- corre `runAdvancedPipeline` sobre los bars del TF principal y persiste el
-- resultado acá para que la pestaña de historial pueda re-render del bloque
-- "Pipeline avanzado".
--
-- NULL cuando ningún flag está activo (mismo contrato que backtest_results).

ALTER TABLE public.engine_backtest_runs
  ADD COLUMN IF NOT EXISTS advanced JSONB;

NOTIFY pgrst, 'reload schema';
