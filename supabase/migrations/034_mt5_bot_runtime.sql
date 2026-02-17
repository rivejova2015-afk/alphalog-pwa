-- 034_mt5_bot_runtime.sql
-- MT5 Bot runtime completeness:
-- - Adds live_market_data table used by receive-mt5-data edge function
-- - Adds bot-control indexes for MT5 workload paths

create extension if not exists pgcrypto;

create table if not exists public.live_market_data (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  bid numeric(18,8) not null,
  ask numeric(18,8) not null,
  last numeric(18,8) not null,
  token_ok boolean not null default false,
  source text not null default 'mt5',
  raw_payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_market_data_symbol_not_empty check (length(trim(symbol)) > 0),
  constraint live_market_data_bid_positive check (bid > 0),
  constraint live_market_data_ask_positive check (ask > 0),
  constraint live_market_data_last_positive check (last > 0)
);

create unique index if not exists live_market_data_symbol_uq
on public.live_market_data (symbol);

create index if not exists live_market_data_received_at_idx
on public.live_market_data (received_at desc);

comment on table public.live_market_data is
  'Latest MT5 live market snapshot by symbol (upsert by symbol).';
comment on column public.live_market_data.raw_payload is
  'Raw MT5 payload stored for traceability.';
comment on column public.live_market_data.token_ok is
  'Optional token validation flag from MT5 upstream payload.';

alter table public.live_market_data enable row level security;

drop policy if exists live_market_data_select_authenticated on public.live_market_data;
create policy live_market_data_select_authenticated
on public.live_market_data
for select
using (auth.role() = 'authenticated');

drop policy if exists live_market_data_insert_service on public.live_market_data;
create policy live_market_data_insert_service
on public.live_market_data
for insert
with check (auth.role() = 'service_role');

drop policy if exists live_market_data_update_service on public.live_market_data;
create policy live_market_data_update_service
on public.live_market_data
for update
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop trigger if exists live_market_data_set_updated_at on public.live_market_data;
create trigger live_market_data_set_updated_at
before update on public.live_market_data
for each row
execute function public.set_updated_at();

-- Realtime stream for terminal/live consumers
do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_market_data'
  ) then
    execute 'alter publication supabase_realtime add table public.live_market_data';
  end if;
exception
  when undefined_object then
    raise notice 'Publication supabase_realtime not found, skipping publication update.';
  when insufficient_privilege then
    raise notice 'Insufficient privilege to alter publication supabase_realtime.';
end;
$$;

-- MT5/Bot query-path hardening indexes
create index if not exists bot_accounts_bot_id_idx
on public.bot_accounts (bot_id);

create index if not exists bot_accounts_user_bot_id_idx
on public.bot_accounts (user_id, bot_id);

create index if not exists bot_commands_created_at_idx
on public.bot_commands (created_at desc);

create index if not exists bot_command_status_created_at_idx
on public.bot_command_status (created_at desc);

create index if not exists bot_telemetry_heartbeat_ts_idx
on public.bot_telemetry (last_heartbeat_ts desc);
