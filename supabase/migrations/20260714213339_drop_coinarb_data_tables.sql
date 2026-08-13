-- 20260714213339_drop_coinarb_data_tables.sql
-- =========================================================================
-- Coinarb was retired completely 2026-07-13/14: bot code, Fly app,
-- algorithms/bots/bot_accounts rows, crontab entries, the
-- coinarb-heartbeat cron, alert-preferences panel. This migration finishes
-- the retirement by dropping the full historical dataset — 17 coinarb_*
-- tables, including 903 real coinarb_trades rows, 80327 coinarb_decisions,
-- 59299 coinarb_smc_signals, 641 coinarb_calibration rows. The user was
-- shown these counts explicitly and confirmed dropping them anyway rather
-- than keeping them as a read-only historical archive.
--
-- FK audit (information_schema, 2026-07-14): no table outside this list
-- references INTO any coinarb_* table, and these tables reference nothing
-- outside themselves. Safe to drop standalone.
-- =========================================================================

BEGIN;

DROP TABLE IF EXISTS public.coinarb_trades CASCADE;
DROP TABLE IF EXISTS public.coinarb_circuit_breaker_events CASCADE;
DROP TABLE IF EXISTS public.coinarb_compliance_audit CASCADE;
DROP TABLE IF EXISTS public.coinarb_50x_validation_checkpoints CASCADE;
DROP TABLE IF EXISTS public.coinarb_equity_snapshots CASCADE;
DROP TABLE IF EXISTS public.coinarb_telemetry CASCADE;
DROP TABLE IF EXISTS public.coinarb_positions CASCADE;
DROP TABLE IF EXISTS public.coinarb_agents CASCADE;

DROP TABLE IF EXISTS public.coinarb_calibration CASCADE;
DROP TABLE IF EXISTS public.coinarb_calibration_data CASCADE;
DROP TABLE IF EXISTS public.coinarb_daily_stats CASCADE;
DROP TABLE IF EXISTS public.coinarb_decisions CASCADE;
DROP TABLE IF EXISTS public.coinarb_liquidity_map CASCADE;
DROP TABLE IF EXISTS public.coinarb_phase_log CASCADE;
DROP TABLE IF EXISTS public.coinarb_regime_snapshots CASCADE;
DROP TABLE IF EXISTS public.coinarb_signal_memory CASCADE;
DROP TABLE IF EXISTS public.coinarb_smc_signals CASCADE;

COMMIT;
