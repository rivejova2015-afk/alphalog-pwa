-- 007_tradehub_reports.sql
-- Sprint 4.5: Weekly Reports for TradeHub with Versioning
-- Decisiones:
-- - Versionado explícito: si existe reporte para semana, crear version+1 (no sobrescribir)
-- - Soft-delete con deleted_at
-- - RLS owner-only
-- - Métricas agregadas: total_trades, total_pnl, win_rate

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLA: weekly_reports (Reportes semanales con versionado)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  version int NOT NULL DEFAULT 1,
  title text NOT NULL,
  content_md text NOT NULL,
  total_trades int NOT NULL DEFAULT 0,
  total_pnl numeric,
  win_rate numeric,
  sort_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  
  constraint weekly_reports_version_check check (version > 0),
  constraint weekly_reports_title_not_empty check (length(trim(title)) > 0),
  constraint weekly_reports_dates_check check (week_start <= week_end)
);

comment on table public.weekly_reports is 'Reportes semanales de trading con versionado (soft-delete)';
comment on column public.weekly_reports.version is 'Número de versión para la misma semana (1, 2, 3, ...)';
comment on column public.weekly_reports.title is 'Título del reporte (ej: "AlphaBrief - Semana 2025-01-15")';
comment on column public.weekly_reports.content_md is 'Contenido en markdown con métricas y análisis';

-- Unique parcial: (user_id, week_start, week_end, version) - permite múltiples versiones
CREATE UNIQUE INDEX idx_reports_uq
  ON public.weekly_reports(user_id, week_start, week_end, version)
  WHERE deleted_at IS NULL;

-- Índices para búsquedas
CREATE INDEX idx_reports_user_date
  ON public.weekly_reports(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_reports_user_week_range
  ON public.weekly_reports(user_id, week_start, week_end)
  WHERE deleted_at IS NULL;

-- Trigger: auto-update updated_at
CREATE TRIGGER weekly_reports_updated_at
  BEFORE UPDATE ON public.weekly_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS: Enable row-level security
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: SELECT - owner only, non-deleted
CREATE POLICY weekly_reports_select_policy
  ON public.weekly_reports FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- RLS Policy: INSERT - owner only
CREATE POLICY weekly_reports_insert_policy
  ON public.weekly_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: UPDATE - owner only
CREATE POLICY weekly_reports_update_policy
  ON public.weekly_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: DELETE - owner only (soft-delete)
CREATE POLICY weekly_reports_delete_policy
  ON public.weekly_reports FOR DELETE
  USING (auth.uid() = user_id);
