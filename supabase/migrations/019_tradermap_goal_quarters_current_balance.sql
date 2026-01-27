-- 019_tradermap_goal_quarters_current_balance.sql
-- Add optional current_balance to tradermap_goal_quarters

alter table public.tradermap_goal_quarters
  add column if not exists current_balance numeric;

comment on column public.tradermap_goal_quarters.current_balance is
  'Balance actual opcional del trimestre (manual)';
