-- Drop tablas legacy sin consumidores en código ni data en prod.
-- Verificación previa (post-migration 113):
--   * Todas las tablas listadas: 0 rows en prod (al 2026-05-31).
--   * Grep en src/ + coinarb/ + polyarb/ + scripts/: 0 referencias activas.
-- SKIPPED del drop:
--   * cme_* (5 tablas) — usadas por src/app/api/cme/* endpoints.
--   * paper_trades — usada por src/lib/bot/skills/skill-manager.ts.
--   * replication_jobs, slave_trade_links, trade_replication_map — usadas
--     por src/lib/copygroups/mirroring.ts (Copy Groups feature recién resucitada).
--   * terminal_report_state (1 row vivo) — fuente de truth para terminal/reports.

-- goals: predecesora de tradermap_goals (también dropeada en mig 113) → safe.
DROP TABLE IF EXISTS public.goals CASCADE;

-- Playbook setup tracking (versionado de setups) — feature sin uso actual.
DROP TABLE IF EXISTS public.playbook_setup_current   CASCADE;
DROP TABLE IF EXISTS public.playbook_setup_versions  CASCADE;
DROP TABLE IF EXISTS public.playbook_setup_groups    CASCADE;

-- Portfolio backtest results — feature reemplazada por backtest_results table.
DROP TABLE IF EXISTS public.portfolio_results CASCADE;

-- Setup library (catálogo de setups predefinidos) — feature no implementada.
DROP TABLE IF EXISTS public.setup_library CASCADE;
