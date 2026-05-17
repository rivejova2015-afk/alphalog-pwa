-- 109_map_hot_schema.sql
-- Módulo Map Hot: goals con timeframes libres, milestones trimestrales,
-- y tabla puente para linkar goals con algorithms.
--
-- Decisiones:
-- - 3 tablas independientes (no toca tradermap_* legacy, que sigue activo).
-- - Soft-delete en map_hot_goals y map_hot_milestones (papelera + restore).
-- - map_hot_goal_links es tabla puente: hard-delete (no soft).
-- - status almacenado como cache (la app lo recomputa desde current/target).
-- - RLS owner-only (patrón canónico auth.uid() = user_id en las 3).
-- - FK ON DELETE CASCADE en auth.users y en map_hot_goals (link huérfano = no útil).
-- - Anti-duplicados de milestone por (user_id, year, quarter) ignorando soft-delete.

create extension if not exists pgcrypto;

begin;

-- ============================================================================
-- TABLA: map_hot_goals
-- Objetivos del trader con timeframes libres (annual/quarterly/monthly/weekly).
-- ============================================================================
create table if not exists public.map_hot_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  timeframe text not null,
  target_value numeric(14, 2) not null,
  current_value numeric(14, 2) not null default 0,
  unit text not null default '$',
  status text not null default 'BELOW_PACE',
  due_date date,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint map_hot_goals_name_not_empty check (length(trim(name)) > 0),
  constraint map_hot_goals_target_positive check (target_value > 0),
  constraint map_hot_goals_current_nonneg check (current_value >= 0),
  constraint map_hot_goals_timeframe_valid
    check (timeframe in ('annual', 'quarterly', 'monthly', 'weekly')),
  constraint map_hot_goals_status_valid
    check (status in ('ON_TRACK', 'BELOW_PACE', 'EXCEEDED', 'WARNING'))
);

comment on table public.map_hot_goals is 'Goals del trader con timeframes libres (módulo Map Hot, soft-delete)';
comment on column public.map_hot_goals.status is 'Cache: la app recomputa desde current_value/target_value en cada update';
comment on column public.map_hot_goals.due_date is 'Opcional: fecha límite para calcular daysLeft en UI';

create index if not exists map_hot_goals_user_id_idx
  on public.map_hot_goals(user_id)
  where deleted_at is null;

create index if not exists map_hot_goals_user_timeframe_idx
  on public.map_hot_goals(user_id, timeframe)
  where deleted_at is null;

create index if not exists map_hot_goals_user_sort_idx
  on public.map_hot_goals(user_id, sort_index)
  where deleted_at is null;

drop trigger if exists map_hot_goals_updated_at on public.map_hot_goals;
create trigger map_hot_goals_updated_at
  before update on public.map_hot_goals
  for each row
  execute function public.set_updated_at();

alter table public.map_hot_goals enable row level security;

drop policy if exists "map_hot_goals_owner_select" on public.map_hot_goals;
create policy "map_hot_goals_owner_select"
  on public.map_hot_goals for select
  using (auth.uid() = user_id);

drop policy if exists "map_hot_goals_owner_insert" on public.map_hot_goals;
create policy "map_hot_goals_owner_insert"
  on public.map_hot_goals for insert
  with check (auth.uid() = user_id);

drop policy if exists "map_hot_goals_owner_update" on public.map_hot_goals;
create policy "map_hot_goals_owner_update"
  on public.map_hot_goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "map_hot_goals_owner_delete" on public.map_hot_goals;
create policy "map_hot_goals_owner_delete"
  on public.map_hot_goals for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TABLA: map_hot_goal_links
-- Puente N:N entre map_hot_goals y algorithms (no soft-delete: hard-delete OK).
-- ============================================================================
create table if not exists public.map_hot_goal_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.map_hot_goals(id) on delete cascade,
  algorithm_id uuid not null references public.algorithms(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint map_hot_goal_links_unique unique (goal_id, algorithm_id)
);

comment on table public.map_hot_goal_links is 'Tabla puente N:N: goals ↔ algorithms (hard-delete)';

create index if not exists map_hot_goal_links_user_idx
  on public.map_hot_goal_links(user_id);

create index if not exists map_hot_goal_links_goal_idx
  on public.map_hot_goal_links(goal_id);

create index if not exists map_hot_goal_links_algo_idx
  on public.map_hot_goal_links(algorithm_id);

alter table public.map_hot_goal_links enable row level security;

drop policy if exists "map_hot_goal_links_owner_select" on public.map_hot_goal_links;
create policy "map_hot_goal_links_owner_select"
  on public.map_hot_goal_links for select
  using (auth.uid() = user_id);

drop policy if exists "map_hot_goal_links_owner_insert" on public.map_hot_goal_links;
create policy "map_hot_goal_links_owner_insert"
  on public.map_hot_goal_links for insert
  with check (auth.uid() = user_id);

drop policy if exists "map_hot_goal_links_owner_delete" on public.map_hot_goal_links;
create policy "map_hot_goal_links_owner_delete"
  on public.map_hot_goal_links for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TABLA: map_hot_milestones
-- Milestones trimestrales para /map-hot/planning (Annual Vision + Q1-Q4).
-- ============================================================================
create table if not exists public.map_hot_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year int not null,
  quarter text not null,
  label text not null,
  target_amount numeric(14, 2) not null,
  description text,
  status text not null default 'upcoming',
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint map_hot_milestones_label_not_empty check (length(trim(label)) > 0),
  constraint map_hot_milestones_year_range check (year between 2020 and 2100),
  constraint map_hot_milestones_quarter_valid
    check (quarter in ('Q1', 'Q2', 'Q3', 'Q4')),
  constraint map_hot_milestones_status_valid
    check (status in ('completed', 'active', 'upcoming')),
  constraint map_hot_milestones_target_positive check (target_amount > 0)
);

comment on table public.map_hot_milestones is 'Milestones trimestrales para Annual Vision (módulo Map Hot, soft-delete)';

-- Unique: 1 milestone por (user, year, quarter) — el quarter ya identifica la celda
create unique index if not exists map_hot_milestones_user_year_quarter_uq
  on public.map_hot_milestones(user_id, year, quarter)
  where deleted_at is null;

create index if not exists map_hot_milestones_user_year_idx
  on public.map_hot_milestones(user_id, year)
  where deleted_at is null;

drop trigger if exists map_hot_milestones_updated_at on public.map_hot_milestones;
create trigger map_hot_milestones_updated_at
  before update on public.map_hot_milestones
  for each row
  execute function public.set_updated_at();

alter table public.map_hot_milestones enable row level security;

drop policy if exists "map_hot_milestones_owner_select" on public.map_hot_milestones;
create policy "map_hot_milestones_owner_select"
  on public.map_hot_milestones for select
  using (auth.uid() = user_id);

drop policy if exists "map_hot_milestones_owner_insert" on public.map_hot_milestones;
create policy "map_hot_milestones_owner_insert"
  on public.map_hot_milestones for insert
  with check (auth.uid() = user_id);

drop policy if exists "map_hot_milestones_owner_update" on public.map_hot_milestones;
create policy "map_hot_milestones_owner_update"
  on public.map_hot_milestones for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "map_hot_milestones_owner_delete" on public.map_hot_milestones;
create policy "map_hot_milestones_owner_delete"
  on public.map_hot_milestones for delete
  using (auth.uid() = user_id);

commit;

-- ============================================================================
-- ROLLBACK NOTE
-- ============================================================================
-- drop table if exists public.map_hot_goal_links cascade;
-- drop table if exists public.map_hot_milestones cascade;
-- drop table if exists public.map_hot_goals cascade;
