-- 039_security_rls_audit_function.sql
-- Adds a reusable audit function for RLS coverage on critical tables.

create or replace function public.security_rls_audit(
  target_tables text[] default array[
    'account_categories',
    'accounts',
    'setups',
    'trades',
    'categories',
    'tags',
    'logs',
    'terminal_news',
    'terminal_events',
    'terminal_evidence_reports',
    'terminal_evidence_attachments',
    'copy_groups',
    'copy_group_nodes',
    'copy_group_links',
    'copy_group_versions',
    'copy_group_snapshots',
    'copy_group_events',
    'trade_replication_map',
    'slave_trade_links',
    'copy_group_experiments',
    'replication_jobs',
    'bot_accounts',
    'bot_instances',
    'bot_commands',
    'bot_command_status',
    'bot_telemetry'
  ]
)
returns table (
  table_name text,
  table_exists boolean,
  rls_enabled boolean,
  policy_count integer,
  status text
)
language sql
security definer
set search_path = public, pg_catalog
as $$
  with requested as (
    select unnest(target_tables) as table_name
  ),
  rels as (
    select
      req.table_name,
      cls.oid,
      cls.relrowsecurity
    from requested req
    left join pg_class cls
      on cls.relname = req.table_name
      and cls.relnamespace = 'public'::regnamespace
      and cls.relkind = 'r'
  ),
  policies as (
    select
      tablename as table_name,
      count(*)::integer as policy_count
    from pg_policies
    where schemaname = 'public'
    group by tablename
  )
  select
    rels.table_name,
    rels.oid is not null as table_exists,
    coalesce(rels.relrowsecurity, false) as rls_enabled,
    coalesce(policies.policy_count, 0) as policy_count,
    case
      when rels.oid is null then 'missing_table'
      when coalesce(rels.relrowsecurity, false) = false then 'rls_disabled'
      when coalesce(policies.policy_count, 0) = 0 then 'missing_policy'
      else 'ok'
    end as status
  from rels
  left join policies using (table_name)
  order by rels.table_name;
$$;

grant execute on function public.security_rls_audit(text[]) to authenticated;
grant execute on function public.security_rls_audit(text[]) to service_role;
