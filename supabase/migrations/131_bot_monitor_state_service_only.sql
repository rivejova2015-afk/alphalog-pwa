-- Migration 131: bot_monitor_state → service_role only
--
-- Razón (audit 2026-06, Área 2 — RLS): la política creada en migration 064 se
-- llamaba "Service role only" pero era `FOR ALL USING(true) WITH CHECK(true)`
-- SIN cláusula TO, por lo que aplicaba a PUBLIC — cualquier usuario autenticado
-- podía leer y escribir el estado de monitoreo de los bots (is_down, down_since,
-- last_alerted_at, recovery_cmd_id).
--
-- El único consumidor de esta tabla es el cron /api/ops/cron/bot-heartbeat-monitor,
-- que usa SUPABASE_SERVICE_ROLE_KEY (bypassa RLS por completo). Restringir la
-- política a service_role no afecta al cron y cierra el acceso de usuarios.
--
-- Mismo patrón que migration 117 (ops_alert_history_service_only).

BEGIN;

DROP POLICY IF EXISTS "Service role only" ON public.bot_monitor_state;
DROP POLICY IF EXISTS "bot_monitor_state_service" ON public.bot_monitor_state;

CREATE POLICY "bot_monitor_state_service"
  ON public.bot_monitor_state
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;

NOTIFY pgrst, 'reload schema';
