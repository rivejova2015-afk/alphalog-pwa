-- 035_intelligence_custom_current_capital.sql
-- Capital Levels: custom current capital per target (linked to same objective record)

alter table if exists public.intelligence_capital_targets
  add column if not exists custom_current_capital numeric,
  add column if not exists custom_current_updated_at timestamptz;

alter table if exists public.intelligence_capital_targets
  drop constraint if exists intelligence_capital_targets_custom_current_capital_check;

alter table if exists public.intelligence_capital_targets
  add constraint intelligence_capital_targets_custom_current_capital_check
  check (custom_current_capital is null or custom_current_capital > 0);

create index if not exists intelligence_capital_targets_custom_current_updated_idx
  on public.intelligence_capital_targets(user_id, custom_current_updated_at desc)
  where deleted_at is null and custom_current_updated_at is not null;
