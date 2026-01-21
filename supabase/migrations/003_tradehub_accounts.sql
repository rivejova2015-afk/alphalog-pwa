-- 003_tradehub_accounts.sql
-- Sprint 4.1: TradeHub Accounts with categories, RLS, soft-delete, papelera
-- Decisiones:
-- - account_categories separada de accounts (reutilizable)
-- - category_id NOT NULL (cuentas siempre tienen categoría)
-- - Soft-delete con deleted_at (papelera + restore)
-- - RLS owner-only en ambas tablas
-- - Anti-duplicados: category name_lower unique (ignora soft-delete)
-- - Papelera: vista de deleted_at not null
-- - Vaciar papelera: hard delete definitivo

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLA: account_categories
-- Categorías de cuentas (ej: Propfirm Forex, Forex Real, etc.)
-- ============================================================================
create table if not exists public.account_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_lower text generated always as (lower(name)) stored,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint account_categories_name_not_empty check (length(trim(name)) > 0)
);

comment on table public.account_categories is 'Categorías de cuentas de trading por usuario (soft-delete)';
comment on column public.account_categories.name_lower is 'Generado: lower(name) para búsquedas case-insensitive';
comment on column public.account_categories.sort_index is 'Ordenamiento flexible (0-basado)';

-- Anti-duplicados: user_id + name_lower, ignorando soft-delete
create unique index account_categories_user_name_uq 
  on public.account_categories(user_id, name_lower) 
  where deleted_at is null;

-- Index para búsquedas rápidas
create index account_categories_user_id_idx 
  on public.account_categories(user_id) 
  where deleted_at is null;

-- Trigger para updated_at (reutiliza función de 002_logs_schema.sql)
create trigger account_categories_updated_at
  before update on public.account_categories
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.account_categories enable row level security;

create policy "account_categories_owner_select"
  on public.account_categories for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "account_categories_owner_insert"
  on public.account_categories for insert
  with check (auth.uid() = user_id);

create policy "account_categories_owner_update"
  on public.account_categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "account_categories_owner_delete"
  on public.account_categories for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TABLA: accounts
-- Cuentas de trading del usuario (Propfirm, Real, Demo, etc.)
-- ============================================================================
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_id uuid not null references public.account_categories(id) on delete cascade,
  account_size numeric,
  current_balance numeric,
  operation_state text,  -- "Active", "Paused", "Closed", etc.
  phase_status text,     -- "Phase 1", "Phase 2", "Passed", etc. (Propfirm-specific)
  role text,             -- "Demo", "Real", "Propfirm", etc.
  withdrawals_enabled boolean not null default true,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint accounts_name_not_empty check (length(trim(name)) > 0)
);

comment on table public.accounts is 'Cuentas de trading por usuario (soft-delete, papelera)';
comment on column public.accounts.category_id is 'FK a account_categories (obligatorio)';
comment on column public.accounts.account_size is 'Tamaño inicial de la cuenta (ej: 10000)';
comment on column public.accounts.current_balance is 'Balance actual (ej: 9500)';
comment on column public.accounts.operation_state is 'Estado operacional (Active, Paused, Closed, etc.)';
comment on column public.accounts.phase_status is 'Estado de fase (Phase 1, Phase 2, Passed, Failed, etc.) - Propfirm specific';
comment on column public.accounts.role is 'Tipo de cuenta (Demo, Real, Propfirm, Practice, etc.)';
comment on column public.accounts.withdrawals_enabled is 'Si los retiros están habilitados';
comment on column public.accounts.sort_index is 'Ordenamiento flexible (0-basado)';

-- Índices para búsquedas y relaciones
create index accounts_user_id_idx 
  on public.accounts(user_id) 
  where deleted_at is null;

create index accounts_user_sort_idx 
  on public.accounts(user_id, sort_index) 
  where deleted_at is null;

create index accounts_user_created_idx 
  on public.accounts(user_id, created_at desc) 
  where deleted_at is null;

create index accounts_category_id_idx 
  on public.accounts(category_id) 
  where deleted_at is null;

-- Trigger para updated_at
create trigger accounts_updated_at
  before update on public.accounts
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.accounts enable row level security;

create policy "accounts_owner_select"
  on public.accounts for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "accounts_owner_insert"
  on public.accounts for insert
  with check (auth.uid() = user_id);

create policy "accounts_owner_update"
  on public.accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "accounts_owner_delete"
  on public.accounts for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- ROLLBACK NOTE
-- ============================================================================
-- Para revertir esta migración, ejecutar:
-- DROP TABLE IF EXISTS public.accounts CASCADE;
-- DROP TABLE IF EXISTS public.account_categories CASCADE;
-- DROP TRIGGER IF EXISTS accounts_updated_at ON public.accounts;
-- DROP TRIGGER IF EXISTS account_categories_updated_at ON public.account_categories;
