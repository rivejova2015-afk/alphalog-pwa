-- 001_init_schema.sql
-- Sprint 1: schema inicial (RLS OFF por ahora)
-- Decisiones:
-- - accounts.category_id OBLIGATORIO (para métricas por categoría)
-- - journal_entries: mood obligatorio + tags obligatorio con mínimo 1 tag
-- - sort_index
-- - updated_at por trigger automático
-- - soft-delete con deleted_at (sin is_deleted)
-- - direction texto libre; numeric genérico/flexible
-- - account_categories sin duplicados (solo filas activas)
-- - seed opcional comentado al final

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- account_categories
create table if not exists public.account_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_set_updated_at_account_categories on public.account_categories;
create trigger trg_set_updated_at_account_categories
before update on public.account_categories
for each row execute function public.set_updated_at();

create unique index if not exists ux_account_categories_name_active
  on public.account_categories (user_id, name)
  where deleted_at is null;

-- accounts
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  category_id uuid not null references public.account_categories(id),
  name text not null,

  account_size numeric null,
  current_balance numeric null,

  phase_status text null,
  role text null,
  operation_state text null,
  withdrawals_enabled boolean not null default true,

  sort_index int null,

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_set_updated_at_accounts on public.accounts;
create trigger trg_set_updated_at_accounts
before update on public.accounts
for each row execute function public.set_updated_at();

-- setup_library
create table if not exists public.setup_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,

  name text not null,
  short_name text null,
  description text null,

  market_conditions text null,
  entry_model text null,
  invalidations text null,

  timeframes text[] not null default '{}',
  tags text[] not null default '{}',

  statistics_enabled boolean not null default false,

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_set_updated_at_setup_library on public.setup_library;
create trigger trg_set_updated_at_setup_library
before update on public.setup_library
for each row execute function public.set_updated_at();

-- trades
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,

  account_id uuid null references public.accounts(id) on delete set null,
  setup_id uuid null references public.setup_library(id) on delete set null,

  symbol text null,
  direction text null,
  status text null,

  entry_date date null,
  exit_date date null,

  entry_price numeric null,
  exit_price numeric null,
  quantity numeric null,
  fees numeric null,
  pnl numeric null,

  notes text null,

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_set_updated_at_trades on public.trades;
create trigger trg_set_updated_at_trades
before update on public.trades
for each row execute function public.set_updated_at();

-- journal_entries
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,

  date date null,
  title text null,
  content text null,

  mood text not null,
  tags text[] not null,

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_journal_mood_nonempty check (char_length(trim(mood)) > 0),
  constraint chk_journal_tags_min1 check (array_length(tags, 1) > 0)
);

drop trigger if exists trg_set_updated_at_journal_entries on public.journal_entries;
create trigger trg_set_updated_at_journal_entries
before update on public.journal_entries
for each row execute function public.set_updated_at();

-- goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,

  account_id uuid null references public.accounts(id) on delete set null,

  title text null,
  year int null,
  active_quarter text null,

  q1_start_date date null,
  q1_end_date date null,
  q1_start_balance numeric null,
  q1_target_balance numeric null,

  q2_start_date date null,
  q2_end_date date null,
  q2_start_balance numeric null,
  q2_target_balance numeric null,

  q3_start_date date null,
  q3_end_date date null,
  q3_start_balance numeric null,
  q3_target_balance numeric null,

  q4_start_date date null,
  q4_end_date date null,
  q4_start_balance numeric null,
  q4_target_balance numeric null,

  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_set_updated_at_goals on public.goals;
create trigger trg_set_updated_at_goals
before update on public.goals
for each row execute function public.set_updated_at();

-- active indexes
create index if not exists idx_accounts_user_active
  on public.accounts(user_id) where deleted_at is null;

create index if not exists idx_accounts_category_active
  on public.accounts(category_id) where deleted_at is null;

create index if not exists idx_setups_user_active
  on public.setup_library(user_id) where deleted_at is null;

create index if not exists idx_trades_user_active
  on public.trades(user_id) where deleted_at is null;

create index if not exists idx_trades_account_active
  on public.trades(account_id) where deleted_at is null;

create index if not exists idx_trades_setup_active
  on public.trades(setup_id) where deleted_at is null;

create index if not exists idx_journal_user_active
  on public.journal_entries(user_id) where deleted_at is null;

create index if not exists idx_goals_user_active
  on public.goals(user_id) where deleted_at is null;

create index if not exists idx_goals_account_active
  on public.goals(account_id) where deleted_at is null;

-- =========================================================
-- SEED OPCIONAL (NO se ejecuta porque está comentado)
-- Para usarlo: descomenta y ejecútalo manualmente en Supabase SQL Editor.
-- =========================================================
-- insert into public.account_categories (name)
-- values
--   ('Propfirm Forex'),
--   ('Propfirm Futuros'),
--   ('Forex Real'),
--   ('Futuros Real'),
--   ('Opciones')
-- on conflict do nothing;
