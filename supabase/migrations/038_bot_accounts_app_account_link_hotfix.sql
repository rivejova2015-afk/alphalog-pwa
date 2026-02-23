-- 038_bot_accounts_app_account_link_hotfix.sql
-- Ensure bot_accounts.app_account_id exists for Bot Control account linking UI/runtime.

alter table public.bot_accounts
  add column if not exists app_account_id uuid references public.accounts(id) on delete set null;

create index if not exists bot_accounts_app_account_id_idx
  on public.bot_accounts (app_account_id);

drop policy if exists bot_accounts_insert_own on public.bot_accounts;
create policy bot_accounts_insert_own
on public.bot_accounts
for insert
with check (
  auth.uid() = user_id
  and (
    app_account_id is null
    or exists (
      select 1
      from public.accounts a
      where a.id = app_account_id
        and a.user_id = auth.uid()
        and a.deleted_at is null
    )
  )
);

drop policy if exists bot_accounts_update_own on public.bot_accounts;
create policy bot_accounts_update_own
on public.bot_accounts
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    app_account_id is null
    or exists (
      select 1
      from public.accounts a
      where a.id = app_account_id
        and a.user_id = auth.uid()
        and a.deleted_at is null
    )
  )
);
