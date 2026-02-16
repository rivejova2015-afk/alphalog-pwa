-- 033_intelligence_manual_simulation_fields.sql
-- Agrega campos de simulacion manual dentro del objetivo de capital

alter table if exists public.intelligence_capital_targets
  add column if not exists manual_monthly_pct numeric,
  add column if not exists manual_quarterly_pct numeric,
  add column if not exists manual_semiannual_pct numeric,
  add column if not exists manual_annual_pct numeric,
  add column if not exists manual_updated_at timestamptz;

create index if not exists intelligence_capital_targets_manual_updated_idx
  on public.intelligence_capital_targets(user_id, manual_updated_at desc)
  where deleted_at is null and manual_updated_at is not null;
