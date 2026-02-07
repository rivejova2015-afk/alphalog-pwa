-- 022_bot_control.sql
-- EA + Control Panel (GoldRangeBasketR)
-- Creates bot tables, telemetry, commands, settings, and RLS policies

create extension if not exists pgcrypto;

-- updated_at helper (idempotent)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- =========================
-- BOTS
-- =========================
create table if not exists public.bots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bots enable row level security;

create policy bots_select_own on public.bots for select
  using (auth.uid() = user_id);

create policy bots_insert_own on public.bots for insert
  with check (auth.uid() = user_id);

create policy bots_update_own on public.bots for update
  using (auth.uid() = user_id);

create policy bots_delete_own on public.bots for delete
  using (auth.uid() = user_id);

drop trigger if exists bots_set_updated_at on public.bots;
create trigger bots_set_updated_at
before update on public.bots
for each row
execute function public.set_updated_at();

-- =========================
-- BOT ACCOUNTS
-- =========================
create table if not exists public.bot_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  account_id text not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bot_accounts_user_account_uq
on public.bot_accounts (user_id, account_id);

alter table public.bot_accounts enable row level security;

create policy bot_accounts_select_own on public.bot_accounts for select
  using (auth.uid() = user_id);

create policy bot_accounts_insert_own on public.bot_accounts for insert
  with check (auth.uid() = user_id);

create policy bot_accounts_update_own on public.bot_accounts for update
  using (auth.uid() = user_id);

create policy bot_accounts_delete_own on public.bot_accounts for delete
  using (auth.uid() = user_id);

drop trigger if exists bot_accounts_set_updated_at on public.bot_accounts;
create trigger bot_accounts_set_updated_at
before update on public.bot_accounts
for each row
execute function public.set_updated_at();

-- =========================
-- BOT INSTANCES (EA identity)
-- =========================
create table if not exists public.bot_instances (
  id uuid primary key default gen_random_uuid(),
  bot_account_id uuid not null references public.bot_accounts(id) on delete cascade,
  instance_id text not null unique,
  instance_secret text not null,
  status text not null default 'ACTIVE',
  last_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bot_instances enable row level security;

create policy bot_instances_select_own on public.bot_instances for select
  using (exists (
    select 1 from public.bot_accounts a
    where a.id = bot_account_id and a.user_id = auth.uid()
  ));

create policy bot_instances_insert_own on public.bot_instances for insert
  with check (exists (
    select 1 from public.bot_accounts a
    where a.id = bot_account_id and a.user_id = auth.uid()
  ));

create policy bot_instances_update_own on public.bot_instances for update
  using (exists (
    select 1 from public.bot_accounts a
    where a.id = bot_account_id and a.user_id = auth.uid()
  ));

create policy bot_instances_delete_own on public.bot_instances for delete
  using (exists (
    select 1 from public.bot_accounts a
    where a.id = bot_account_id and a.user_id = auth.uid()
  ));

drop trigger if exists bot_instances_set_updated_at on public.bot_instances;
create trigger bot_instances_set_updated_at
before update on public.bot_instances
for each row
execute function public.set_updated_at();

-- =========================
-- SETTINGS (GLOBAL / OVERRIDE)
-- =========================
create table if not exists public.bot_settings_global (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bot_settings_global_bot_uq
on public.bot_settings_global (bot_id);

alter table public.bot_settings_global enable row level security;

create policy bot_settings_global_select_own on public.bot_settings_global for select
  using (exists (
    select 1 from public.bots b
    where b.id = bot_id and b.user_id = auth.uid()
  ));

create policy bot_settings_global_insert_own on public.bot_settings_global for insert
  with check (exists (
    select 1 from public.bots b
    where b.id = bot_id and b.user_id = auth.uid()
  ));

create policy bot_settings_global_update_own on public.bot_settings_global for update
  using (exists (
    select 1 from public.bots b
    where b.id = bot_id and b.user_id = auth.uid()
  ));

drop trigger if exists bot_settings_global_set_updated_at on public.bot_settings_global;
create trigger bot_settings_global_set_updated_at
before update on public.bot_settings_global
for each row
execute function public.set_updated_at();

create table if not exists public.bot_settings_override (
  id uuid primary key default gen_random_uuid(),
  bot_account_id uuid not null references public.bot_accounts(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bot_settings_override_account_uq
on public.bot_settings_override (bot_account_id);

alter table public.bot_settings_override enable row level security;

create policy bot_settings_override_select_own on public.bot_settings_override for select
  using (exists (
    select 1 from public.bot_accounts a
    where a.id = bot_account_id and a.user_id = auth.uid()
  ));

create policy bot_settings_override_insert_own on public.bot_settings_override for insert
  with check (exists (
    select 1 from public.bot_accounts a
    where a.id = bot_account_id and a.user_id = auth.uid()
  ));

create policy bot_settings_override_update_own on public.bot_settings_override for update
  using (exists (
    select 1 from public.bot_accounts a
    where a.id = bot_account_id and a.user_id = auth.uid()
  ));

drop trigger if exists bot_settings_override_set_updated_at on public.bot_settings_override;
create trigger bot_settings_override_set_updated_at
before update on public.bot_settings_override
for each row
execute function public.set_updated_at();

-- =========================
-- COMMANDS + STATUS
-- =========================
create table if not exists public.bot_commands (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  command_type text not null,
  payload jsonb not null default '{}'::jsonb,
  target_scope text not null default 'all',
  created_by uuid references auth.users(id) on delete set null,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bot_commands enable row level security;

create policy bot_commands_select_own on public.bot_commands for select
  using (exists (
    select 1 from public.bots b
    where b.id = bot_id and b.user_id = auth.uid()
  ));

create policy bot_commands_insert_own on public.bot_commands for insert
  with check (exists (
    select 1 from public.bots b
    where b.id = bot_id and b.user_id = auth.uid()
  ));

create policy bot_commands_update_own on public.bot_commands for update
  using (exists (
    select 1 from public.bots b
    where b.id = bot_id and b.user_id = auth.uid()
  ));

drop trigger if exists bot_commands_set_updated_at on public.bot_commands;
create trigger bot_commands_set_updated_at
before update on public.bot_commands
for each row
execute function public.set_updated_at();

create table if not exists public.bot_command_status (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.bot_commands(id) on delete cascade,
  bot_account_id uuid not null references public.bot_accounts(id) on delete cascade,
  status text not null default 'PENDING',
  acked_at timestamptz,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bot_command_status_uq
on public.bot_command_status (command_id, bot_account_id);

alter table public.bot_command_status enable row level security;

create policy bot_command_status_select_own on public.bot_command_status for select
  using (exists (
    select 1 from public.bot_accounts a
    where a.id = bot_account_id and a.user_id = auth.uid()
  ));

create policy bot_command_status_insert_own on public.bot_command_status for insert
  with check (exists (
    select 1 from public.bot_accounts a
    where a.id = bot_account_id and a.user_id = auth.uid()
  ));

create policy bot_command_status_update_own on public.bot_command_status for update
  using (exists (
    select 1 from public.bot_accounts a
    where a.id = bot_account_id and a.user_id = auth.uid()
  ));

drop trigger if exists bot_command_status_set_updated_at on public.bot_command_status;
create trigger bot_command_status_set_updated_at
before update on public.bot_command_status
for each row
execute function public.set_updated_at();

-- =========================
-- TELEMETRY
-- =========================
create table if not exists public.bot_telemetry (
  id uuid primary key default gen_random_uuid(),
  bot_account_id uuid not null references public.bot_accounts(id) on delete cascade,
  instance_id text not null,
  equity numeric,
  balance numeric,
  positions_total int,
  positions_buy int,
  positions_sell int,
  basket_r numeric,
  tier text,
  last_signal_text text,
  last_signal_ts timestamptz,
  last_heartbeat_ts timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bot_telemetry_account_uq
on public.bot_telemetry (bot_account_id);

alter table public.bot_telemetry enable row level security;

create policy bot_telemetry_select_own on public.bot_telemetry for select
  using (exists (
    select 1 from public.bot_accounts a
    where a.id = bot_account_id and a.user_id = auth.uid()
  ));

-- no insert/update policies for users (service role only)

drop trigger if exists bot_telemetry_set_updated_at on public.bot_telemetry;
create trigger bot_telemetry_set_updated_at
before update on public.bot_telemetry
for each row
execute function public.set_updated_at();

-- =========================
-- EVENTS
-- =========================
create table if not exists public.bot_events (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  bot_account_id uuid references public.bot_accounts(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.bot_events enable row level security;

create policy bot_events_select_own on public.bot_events for select
  using (exists (
    select 1 from public.bots b
    where b.id = bot_id and b.user_id = auth.uid()
  ));

create policy bot_events_insert_own on public.bot_events for insert
  with check (exists (
    select 1 from public.bots b
    where b.id = bot_id and b.user_id = auth.uid()
  ));
