-- 032_intelligence_capital_targets.sql
-- Capital goals por tipo de cuenta en Intelligence > Capital Levels

create extension if not exists pgcrypto;

create table if not exists public.intelligence_capital_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('real', 'propfirm')),
  target_name text not null,
  target_capital numeric not null check (target_capital > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists intelligence_capital_targets_user_idx
  on public.intelligence_capital_targets(user_id, created_at desc)
  where deleted_at is null;

create index if not exists intelligence_capital_targets_type_idx
  on public.intelligence_capital_targets(user_id, account_type, created_at desc)
  where deleted_at is null;

drop trigger if exists intelligence_capital_targets_updated_at on public.intelligence_capital_targets;
create trigger intelligence_capital_targets_updated_at
  before update on public.intelligence_capital_targets
  for each row
  execute function public.set_updated_at();

alter table public.intelligence_capital_targets enable row level security;

drop policy if exists "intelligence_capital_targets_owner_select" on public.intelligence_capital_targets;
create policy "intelligence_capital_targets_owner_select"
  on public.intelligence_capital_targets for select
  using (auth.uid() = user_id and deleted_at is null);

drop policy if exists "intelligence_capital_targets_owner_insert" on public.intelligence_capital_targets;
create policy "intelligence_capital_targets_owner_insert"
  on public.intelligence_capital_targets for insert
  with check (auth.uid() = user_id);

drop policy if exists "intelligence_capital_targets_owner_update" on public.intelligence_capital_targets;
create policy "intelligence_capital_targets_owner_update"
  on public.intelligence_capital_targets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "intelligence_capital_targets_owner_delete" on public.intelligence_capital_targets;
create policy "intelligence_capital_targets_owner_delete"
  on public.intelligence_capital_targets for delete
  using (auth.uid() = user_id);
