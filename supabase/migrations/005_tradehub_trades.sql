-- 005_tradehub_trades.sql
-- Sprint 4.3: TradeHub Trades (New Trades Log) with setups and trades tables
-- Decisiones:
-- - setups: estrategias/configuraciones de trading por usuario (reutilizable)
-- - trades: operaciones individuales con referencia a account y setup opcional
-- - direction/status: texto libre con sugerencias (Long/Short/Buy/Sell, Open/Closed)
-- - quantity: numeric flexible
-- - screenshot_path: opcional, se guarda en storage bucket privado (signed URLs)
-- - Soft-delete con deleted_at (papelera + restore)
-- - RLS owner-only en ambas tablas
-- - Anti-duplicados: setups con nombre único por usuario

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLA: setups (Estrategias de Trading)
-- ============================================================================
create table if not exists public.setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_lower text generated always as (lower(name)) stored,
  description text,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint setups_name_not_empty check (length(trim(name)) > 0)
);

comment on table public.setups is 'Estrategias/setups de trading por usuario (soft-delete)';
comment on column public.setups.name_lower is 'Generado: lower(name) para búsquedas case-insensitive';
comment on column public.setups.sort_index is 'Ordenamiento flexible (0-basado)';

-- Anti-duplicados: user_id + name_lower, ignorando soft-delete
create unique index setups_user_name_uq 
  on public.setups(user_id, name_lower) 
  where deleted_at is null;

-- Index para búsquedas rápidas
create index setups_user_id_idx 
  on public.setups(user_id) 
  where deleted_at is null;

-- Trigger para updated_at (reutiliza función de 002_logs_schema.sql)
create trigger setups_updated_at
  before update on public.setups
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- TABLA: trades (Operaciones de Trading - New Trades Log)
-- ============================================================================
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  
  -- Campos obligatorios para trading
  symbol text not null,
  direction text not null,
  status text not null,
  entry_date date not null,
  entry_price numeric not null,
  exit_price numeric not null,
  stop_loss_price numeric not null,
  take_profit_price numeric not null,
  lots numeric not null,
  pnl numeric not null,
  pnl_percent numeric not null,
  
  -- Campos opcionales
  exit_date date null,
  notes text null,
  setup_id uuid references public.setups(id) on delete set null,
  screenshot_path text null,
  is_featured_in_report boolean not null default false,
  sort_index int not null default 0,
  
  -- Auditoría
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint trades_symbol_not_empty check (length(trim(symbol)) > 0),
  constraint trades_direction_not_empty check (length(trim(direction)) > 0),
  constraint trades_status_not_empty check (length(trim(status)) > 0),
  constraint trades_lots_positive check (lots > 0),
  constraint trades_prices_reasonable check (entry_price >= 0 AND exit_price >= 0 AND stop_loss_price >= 0 AND take_profit_price >= 0)
);

comment on table public.trades is 'Operaciones de trading (New Trades Log) con campos obligatorios completos (soft-delete)';
comment on column public.trades.symbol is 'Símbolo del activo (ej: EURUSD, ES, BTC/USD)';
comment on column public.trades.direction is 'Dirección: Long/Short/Buy/Sell (texto libre con UI sugiere)';
comment on column public.trades.status is 'Estado: Planning/Active/Closed (texto libre con UI sugiere)';
comment on column public.trades.lots is 'Cantidad/tamaño de la operación (obligatorio, >0)';
comment on column public.trades.entry_date is 'Fecha de entrada de la operación (obligatorio)';
comment on column public.trades.entry_price is 'Precio de entrada (obligatorio, >=0)';
comment on column public.trades.exit_price is 'Precio de salida (obligatorio, >=0)';
comment on column public.trades.stop_loss_price is 'Precio de stop loss (obligatorio, >=0)';
comment on column public.trades.take_profit_price is 'Precio de take profit (obligatorio, >=0)';
comment on column public.trades.pnl is 'Ganancia/pérdida (obligatorio)';
comment on column public.trades.pnl_percent is 'Ganancia/pérdida en % (obligatorio)';
comment on column public.trades.exit_date is 'Fecha de salida de la operación (opcional, null si abierto)';
comment on column public.trades.screenshot_path is 'Ruta en storage bucket privado (opcional)';
comment on column public.trades.is_featured_in_report is 'Si esta operación debe aparecer en reportes';
comment on column public.trades.sort_index is 'Ordenamiento flexible (0-basado)';

-- Índices para búsquedas y filtros
create index trades_user_id_created_at_idx 
  on public.trades(user_id, created_at desc) 
  where deleted_at is null;

create index trades_user_account_id_idx 
  on public.trades(user_id, account_id) 
  where deleted_at is null;

create index trades_user_setup_id_idx 
  on public.trades(user_id, setup_id) 
  where deleted_at is null;

create index trades_user_status_idx 
  on public.trades(user_id, status) 
  where deleted_at is null;

-- Trigger para updated_at
create trigger trades_updated_at
  before update on public.trades
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- RLS POLICIES: setups
-- ============================================================================

-- SELECT: Solo ver propios setups
create policy "users_can_select_own_setups" on public.setups
  for select
  using (auth.uid() = user_id);

-- INSERT: Solo crear propios setups
create policy "users_can_insert_own_setups" on public.setups
  for insert
  with check (auth.uid() = user_id);

-- UPDATE: Solo actualizar propios setups
create policy "users_can_update_own_setups" on public.setups
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: Solo borrar propios setups
create policy "users_can_delete_own_setups" on public.setups
  for delete
  using (auth.uid() = user_id);

-- Habilitar RLS
alter table public.setups enable row level security;

-- ============================================================================
-- RLS POLICIES: trades
-- ============================================================================

-- SELECT: Solo ver propias operaciones
create policy "users_can_select_own_trades" on public.trades
  for select
  using (auth.uid() = user_id);

-- INSERT: Solo crear propias operaciones
create policy "users_can_insert_own_trades" on public.trades
  for insert
  with check (auth.uid() = user_id);

-- UPDATE: Solo actualizar propias operaciones
create policy "users_can_update_own_trades" on public.trades
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- DELETE: Solo borrar propias operaciones
create policy "users_can_delete_own_trades" on public.trades
  for delete
  using (auth.uid() = user_id);

-- Habilitar RLS
alter table public.trades enable row level security;
