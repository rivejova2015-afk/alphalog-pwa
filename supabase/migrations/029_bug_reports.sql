-- 029_bug_reports.sql
-- Auto bug recorder storage for server-side errors

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  request_id text,
  method text,
  path text,
  status int,
  error_message text,
  error_stack text,
  payload_hash text,
  ip_hint text,
  user_agent_hash text,
  created_at timestamptz not null default now(),

  constraint bug_reports_status_check check (status is null or (status >= 400 and status < 600))
);

create index if not exists bug_reports_user_id_idx
  on public.bug_reports(user_id, created_at desc);

create index if not exists bug_reports_path_idx
  on public.bug_reports(path, created_at desc);

create index if not exists bug_reports_request_id_idx
  on public.bug_reports(request_id);

alter table public.bug_reports enable row level security;

create policy bug_reports_select_own
  on public.bug_reports for select
  using (auth.uid() = user_id);

-- Insert via security definer function (service role)
create policy bug_reports_insert
  on public.bug_reports for insert
  with check (true);

create or replace function public.log_bug_report(
  p_user_id uuid,
  p_request_id text,
  p_method text,
  p_path text,
  p_status int,
  p_error_message text,
  p_error_stack text,
  p_payload_hash text,
  p_ip_hint text,
  p_user_agent_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  bug_id uuid;
begin
  insert into public.bug_reports (
    user_id,
    request_id,
    method,
    path,
    status,
    error_message,
    error_stack,
    payload_hash,
    ip_hint,
    user_agent_hash
  )
  values (
    p_user_id,
    p_request_id,
    p_method,
    p_path,
    p_status,
    p_error_message,
    p_error_stack,
    p_payload_hash,
    p_ip_hint,
    p_user_agent_hash
  )
  returning id into bug_id;

  return bug_id;
end;
$$;
