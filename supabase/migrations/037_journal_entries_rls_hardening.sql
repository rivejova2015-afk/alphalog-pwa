-- 037_journal_entries_rls_hardening.sql
-- Ensure owner-only RLS policies exist for journal_entries.

alter table public.journal_entries enable row level security;

drop policy if exists journal_entries_select_own on public.journal_entries;
create policy journal_entries_select_own
  on public.journal_entries
  for select
  using (auth.uid() = user_id);

drop policy if exists journal_entries_insert_own on public.journal_entries;
create policy journal_entries_insert_own
  on public.journal_entries
  for insert
  with check (auth.uid() = user_id);

drop policy if exists journal_entries_update_own on public.journal_entries;
create policy journal_entries_update_own
  on public.journal_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists journal_entries_delete_own on public.journal_entries;
create policy journal_entries_delete_own
  on public.journal_entries
  for delete
  using (auth.uid() = user_id);

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'auto_set_user_id'
      and pg_function_is_visible(oid)
  ) then
    execute 'drop trigger if exists journal_entries_auto_user_id on public.journal_entries';
    execute 'create trigger journal_entries_auto_user_id
             before insert on public.journal_entries
             for each row
             execute function public.auto_set_user_id()';
  end if;
end $$;
