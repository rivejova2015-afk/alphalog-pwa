-- Ops alert history: centraliza eventos de los 7+ cron jobs en /api/ops/cron/*
-- y /api/cron/* para que un dashboard pueda mostrar resumen "salud del cron"
-- de las últimas N horas. Insert con service_role; lectura sólo por el dueño.

CREATE TABLE IF NOT EXISTS ops_alert_history (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name    text        NOT NULL,
  severity    text        NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  message     text        NOT NULL,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_alert_history_job_created
  ON ops_alert_history (job_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_alert_history_created
  ON ops_alert_history (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ops_alert_history_severity
  ON ops_alert_history (severity, created_at DESC)
  WHERE severity IN ('error','critical');

ALTER TABLE ops_alert_history ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado puede ver el resumen (es sólo
-- 1 usuario en la app; si fuera multi-tenant se filtraría por user_id).
CREATE POLICY "ops_alert_history_read_authenticated"
  ON ops_alert_history FOR SELECT
  TO authenticated
  USING (true);

-- Insert: sólo service_role (los crons usan SUPABASE_SERVICE_ROLE_KEY).
-- Sin policy de INSERT para 'authenticated' = bloqueado por defecto.
