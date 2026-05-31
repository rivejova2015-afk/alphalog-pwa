-- Migration 113: ops_alert_history → service_role only
--
-- Razón: la tabla guarda alertas del sistema (cron failures, SLO breaches,
-- bot recovery events). La política original de migration 111 permitía a
-- cualquier usuario autenticado leerlas (asumiendo single-tenant), pero
-- prepararse para multi-tenant requiere que sea service_role-only ahora.
--
-- La UI consume vía /api/ops/alert-summary, que se autentica con el usuario
-- pero hace la query con service_role internamente (ver route.ts actualizada).
--
-- Insert ya era service_role-only por defecto (no había política INSERT).
-- Sólo cambia el SELECT.

BEGIN;

DROP POLICY IF EXISTS "ops_alert_history_read_authenticated" ON public.ops_alert_history;

CREATE POLICY "ops_alert_history_service"
  ON public.ops_alert_history
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMIT;

NOTIFY pgrst, 'reload schema';
