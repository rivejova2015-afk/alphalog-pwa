-- 040_security_rls_audit_relkind_hotfix.sql
-- Fixes false missing_table results for relations detected by regclass lookup.

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
      to_regclass(format('public.%I', req.table_name)) as relid
    from requested req
  ),
  relmeta as (
    select
      rels.table_name,
      rels.relid,
      cls.relrowsecurity,
      cls.relkind
    from rels
    left join pg_class cls on cls.oid = rels.relid
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
    relmeta.table_name,
    relmeta.relid is not null as table_exists,
    coalesce(relmeta.relrowsecurity, false) as rls_enabled,
    coalesce(policies.policy_count, 0) as policy_count,
    case
      when relmeta.relid is null then 'missing_table'
      when coalesce(relmeta.relkind, '') not in ('r', 'p', 'f') then 'non_table_relation'
      when coalesce(relmeta.relrowsecurity, false) = false then 'rls_disabled'
      when coalesce(policies.policy_count, 0) = 0 then 'missing_policy'
      else 'ok'
    end as status
  from relmeta
  left join policies using (table_name)
  order by relmeta.table_name;
$$;

grant execute on function public.security_rls_audit(text[]) to authenticated;
grant execute on function public.security_rls_audit(text[]) to service_role;
