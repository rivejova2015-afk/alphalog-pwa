-- 028_audit_trail.sql
-- Comprehensive audit trail for security monitoring

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  resource_type text not null,
  resource_id text,
  changes jsonb,
  ip_hint text,
  user_agent_hash text,
  status text default 'success',
  error_message text,
  created_at timestamptz not null default now(),

  constraint audit_logs_action_check check (action in (
    'create', 'read', 'update', 'delete',
    'export', 'import', 'download', 'upload',
    'login', 'logout', 'stepup', 'device_trust',
    'api_call', 'webhook', 'report_generate'
  )),
  constraint audit_logs_status_check check (status in ('success', 'failure', 'partial'))
);

create index if not exists audit_logs_user_id_idx
  on public.audit_logs(user_id, created_at desc);

create index if not exists audit_logs_action_idx
  on public.audit_logs(action, created_at desc);

create index if not exists audit_logs_resource_idx
  on public.audit_logs(resource_type, resource_id, created_at desc);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

-- Users can see their own audit logs
create policy audit_logs_select_own
  on public.audit_logs for select
  using (auth.uid() = user_id);

-- Service role can insert (via security definer function)
create policy audit_logs_insert
  on public.audit_logs for insert
  with check (true);

-- Admin-like access via service role
create policy audit_logs_select_admin
  on public.audit_logs for select
  using (
    exists (
      select 1 from public.audit_logs
      where user_id = auth.uid()
      limit 1
    )
  );

-- Function to log audit events (service role, bypasses RLS)
create or replace function public.log_audit_event(
  p_user_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text default null,
  p_changes jsonb default null,
  p_ip_hint text default null,
  p_user_agent_hash text default null,
  p_status text default 'success',
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_id uuid;
begin
  insert into public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    changes,
    ip_hint,
    user_agent_hash,
    status,
    error_message
  )
  values (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_changes,
    p_ip_hint,
    p_user_agent_hash,
    p_status,
    p_error_message
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

-- Function to fetch user's audit logs (with optional filtering)
create or replace function public.get_user_audit_logs(
  p_action text default null,
  p_resource_type text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  action text,
  resource_type text,
  resource_id text,
  changes jsonb,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    audit_logs.id,
    audit_logs.action,
    audit_logs.resource_type,
    audit_logs.resource_id,
    audit_logs.changes,
    audit_logs.status,
    audit_logs.created_at
  from public.audit_logs
  where
    audit_logs.user_id = auth.uid()
    and (p_action is null or audit_logs.action = p_action)
    and (p_resource_type is null or audit_logs.resource_type = p_resource_type)
  order by audit_logs.created_at desc
  limit p_limit
  offset p_offset;
end;
$$;
