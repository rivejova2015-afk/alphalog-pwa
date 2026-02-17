-- 036_intelligence_capital_accounts.sql
-- Capital Levels: manual capital accounts (independent by account) + link target -> capital account

create extension if not exists pgcrypto;

create table if not exists public.intelligence_capital_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('real', 'propfirm')),
  account_name text not null,
  current_capital numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint intelligence_capital_accounts_name_not_empty check (length(trim(account_name)) > 0),
  constraint intelligence_capital_accounts_current_capital_positive check (current_capital > 0)
);

create index if not exists intelligence_capital_accounts_user_idx
  on public.intelligence_capital_accounts(user_id, created_at desc)
  where deleted_at is null;

create index if not exists intelligence_capital_accounts_type_idx
  on public.intelligence_capital_accounts(user_id, account_type, created_at desc)
  where deleted_at is null;

drop trigger if exists intelligence_capital_accounts_updated_at on public.intelligence_capital_accounts;
create trigger intelligence_capital_accounts_updated_at
  before update on public.intelligence_capital_accounts
  for each row
  execute function public.set_updated_at();

alter table public.intelligence_capital_accounts enable row level security;

drop policy if exists "intelligence_capital_accounts_owner_select" on public.intelligence_capital_accounts;
create policy "intelligence_capital_accounts_owner_select"
  on public.intelligence_capital_accounts for select
  using (auth.uid() = user_id and deleted_at is null);

drop policy if exists "intelligence_capital_accounts_owner_insert" on public.intelligence_capital_accounts;
create policy "intelligence_capital_accounts_owner_insert"
  on public.intelligence_capital_accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "intelligence_capital_accounts_owner_update" on public.intelligence_capital_accounts;
create policy "intelligence_capital_accounts_owner_update"
  on public.intelligence_capital_accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "intelligence_capital_accounts_owner_delete" on public.intelligence_capital_accounts;
create policy "intelligence_capital_accounts_owner_delete"
  on public.intelligence_capital_accounts for delete
  using (auth.uid() = user_id);

alter table if exists public.intelligence_capital_targets
  add column if not exists capital_account_id uuid references public.intelligence_capital_accounts(id) on delete set null;

create index if not exists intelligence_capital_targets_capital_account_idx
  on public.intelligence_capital_targets(capital_account_id)
  where deleted_at is null and capital_account_id is not null;

drop policy if exists "intelligence_capital_targets_owner_insert" on public.intelligence_capital_targets;
create policy "intelligence_capital_targets_owner_insert"
  on public.intelligence_capital_targets for insert
  with check (
    auth.uid() = user_id
    and (
      capital_account_id is null
      or exists (
        select 1
        from public.intelligence_capital_accounts ca
        where ca.id = capital_account_id
          and ca.user_id = auth.uid()
          and ca.deleted_at is null
          and ca.account_type = account_type
      )
    )
  );

drop policy if exists "intelligence_capital_targets_owner_update" on public.intelligence_capital_targets;
create policy "intelligence_capital_targets_owner_update"
  on public.intelligence_capital_targets for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      capital_account_id is null
      or exists (
        select 1
        from public.intelligence_capital_accounts ca
        where ca.id = capital_account_id
          and ca.user_id = auth.uid()
          and ca.deleted_at is null
          and ca.account_type = account_type
      )
    )
  );
