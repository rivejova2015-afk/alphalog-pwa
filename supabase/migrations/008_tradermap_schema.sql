-- 008_tradermap_schema.sql
-- Sprint 5: TraderMap Goals, Progress & Level System
-- Decisiones:
-- - Goals trimestrales con cálculos automáticos de progreso
-- - Progress events para tracking de actividad (trades, evidencia, reportes, etc)
-- - User level state para seguimiento de XP y streak
-- - RLS owner-only en todas las tablas
-- - Soft-delete con deleted_at

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLA: tradermap_goals (Metas anuales de trader)
-- ============================================================================
create table if not exists public.tradermap_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  year int not null,
  title text not null,
  active_quarter text not null default 'Q1',
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint tradermap_goals_year_check check (year >= 2020 AND year <= 2100),
  constraint tradermap_goals_quarter_check check (active_quarter in ('Q1', 'Q2', 'Q3', 'Q4')),
  constraint tradermap_goals_title_not_empty check (length(trim(title)) > 0)
);

comment on table public.tradermap_goals is 'Metas anuales de trader por cuenta (soft-delete)';
comment on column public.tradermap_goals.active_quarter is 'Trimestre actual (Q1-Q4) para la UI';
comment on column public.tradermap_goals.year is 'Año de la meta (ej: 2025)';
comment on column public.tradermap_goals.title is 'Título de la meta anual (ej: "Alcanzar $100k")';

-- Anti-duplicados: user_id + account_id + year + title_lower
create unique index tradermap_goals_uq
  on public.tradermap_goals(user_id, account_id, year, lower(title))
  where deleted_at is null;

-- Índices para búsquedas rápidas
create index tradermap_goals_user_year_idx
  on public.tradermap_goals(user_id, year)
  where deleted_at is null;

create index tradermap_goals_user_account_idx
  on public.tradermap_goals(user_id, account_id)
  where deleted_at is null;

-- Trigger para updated_at
create trigger tradermap_goals_updated_at
  before update on public.tradermap_goals
  for each row
  execute function public.set_updated_at();

-- RLS: owner-only
alter table public.tradermap_goals enable row level security;

create policy tradermap_goals_select_policy
  on public.tradermap_goals for select
  using (auth.uid() = user_id AND deleted_at is null);

create policy tradermap_goals_insert_policy
  on public.tradermap_goals for insert
  with check (auth.uid() = user_id);

create policy tradermap_goals_update_policy
  on public.tradermap_goals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy tradermap_goals_delete_policy
  on public.tradermap_goals for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TABLA: tradermap_goal_quarters (Detalles de cada trimestre)
-- ============================================================================
create table if not exists public.tradermap_goal_quarters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.tradermap_goals(id) on delete cascade,
  quarter text not null,
  start_date date not null,
  end_date date not null,
  start_balance numeric not null,
  target_balance numeric not null,
  completed_at timestamptz null,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint tradermap_goal_quarters_quarter_check check (quarter in ('Q1', 'Q2', 'Q3', 'Q4')),
  constraint tradermap_goal_quarters_dates_check check (start_date <= end_date),
  constraint tradermap_goal_quarters_balance_check check (start_balance >= 0 AND target_balance > 0)
);

comment on table public.tradermap_goal_quarters is 'Detalles de meta por trimestre (Q1-Q4)';
comment on column public.tradermap_goal_quarters.start_balance is 'Balance inicial del trimestre';
comment on column public.tradermap_goal_quarters.target_balance is 'Target de balance a fin del trimestre';
comment on column public.tradermap_goal_quarters.completed_at is 'Timestamp cuando se completó el trimestre (null si no completado)';

-- Unique parcial: un quarter por goal
create unique index tradermap_goal_quarters_uq
  on public.tradermap_goal_quarters(goal_id, quarter)
  where deleted_at is null;

-- Índices
create index tradermap_goal_quarters_user_goal_idx
  on public.tradermap_goal_quarters(user_id, goal_id)
  where deleted_at is null;

create index tradermap_goal_quarters_completed_idx
  on public.tradermap_goal_quarters(user_id, completed_at)
  where completed_at is not null and deleted_at is null;

-- Trigger
create trigger tradermap_goal_quarters_updated_at
  before update on public.tradermap_goal_quarters
  for each row
  execute function public.set_updated_at();

-- RLS: owner-only
alter table public.tradermap_goal_quarters enable row level security;

create policy tradermap_goal_quarters_select_policy
  on public.tradermap_goal_quarters for select
  using (auth.uid() = user_id AND deleted_at is null);

create policy tradermap_goal_quarters_insert_policy
  on public.tradermap_goal_quarters for insert
  with check (auth.uid() = user_id);

create policy tradermap_goal_quarters_update_policy
  on public.tradermap_goal_quarters for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy tradermap_goal_quarters_delete_policy
  on public.tradermap_goal_quarters for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TABLA: progress_events (Eventos de progreso: trades, evidencia, reportes, etc)
-- ============================================================================
create table if not exists public.progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  ref_table text null,
  ref_id uuid null,
  xp_delta int not null default 0,
  metadata jsonb null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint progress_events_event_type_check check (
    event_type in ('trade', 'evidence', 'report', 'goal_complete', 'manual')
  )
);

comment on table public.progress_events is 'Eventos de progreso para sistema de XP/level (inmutable, no soft-delete)';
comment on column public.progress_events.event_type is 'Tipo de evento: trade, evidence, report, goal_complete, manual';
comment on column public.progress_events.ref_table is 'Tabla referenciada (ej: trades, tv_analysis_evidence, weekly_reports)';
comment on column public.progress_events.ref_id is 'ID del registro en tabla referenciada';
comment on column public.progress_events.xp_delta is 'Puntos XP ganados por este evento (default 0 si no definido)';
comment on column public.progress_events.metadata is 'JSON adicional (ej: {tradeStatus: "Closed", pnl: 150.25})';
comment on column public.progress_events.occurred_at is 'Timestamp cuando ocurrió el evento (puede ser antes de registrarse)';

-- Índices
create index progress_events_user_occurred_at_idx
  on public.progress_events(user_id, occurred_at desc);

create index progress_events_user_event_type_idx
  on public.progress_events(user_id, event_type);

create index progress_events_ref_idx
  on public.progress_events(ref_table, ref_id);

-- RLS: owner-only (solo leer propios eventos)
alter table public.progress_events enable row level security;

create policy progress_events_select_policy
  on public.progress_events for select
  using (auth.uid() = user_id);

create policy progress_events_insert_policy
  on public.progress_events for insert
  with check (auth.uid() = user_id);

-- DELETE NO PERMITIDO (inmutable)

-- ============================================================================
-- TABLA: user_level_state (Estado de level/XP/streak por usuario)
-- ============================================================================
create table if not exists public.user_level_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  level int not null default 1,
  xp_total int not null default 0,
  streak_days int not null default 0,
  last_activity_date date null,
  updated_at timestamptz not null default now(),

  constraint user_level_state_level_check check (level >= 1 AND level <= 100),
  constraint user_level_state_xp_check check (xp_total >= 0),
  constraint user_level_state_streak_check check (streak_days >= 0)
);

comment on table public.user_level_state is 'Estado de level, XP total y streak del usuario';
comment on column public.user_level_state.level is 'Nivel actual (1-100)';
comment on column public.user_level_state.xp_total is 'XP total acumulado';
comment on column public.user_level_state.streak_days is 'Días consecutivos con actividad';
comment on column public.user_level_state.last_activity_date is 'Última fecha con actividad registrada';

-- Trigger para updated_at
create trigger user_level_state_updated_at
  before update on public.user_level_state
  for each row
  execute function public.set_updated_at();

-- RLS: owner-only
alter table public.user_level_state enable row level security;

create policy user_level_state_select_policy
  on public.user_level_state for select
  using (auth.uid() = user_id);

create policy user_level_state_update_policy
  on public.user_level_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- INSERT manejado por server (no via RLS directa)
-- DELETE NO PERMITIDO

-- ============================================================================
-- FUNCIÓN HELPER: upsert_user_level_state
-- ============================================================================
create or replace function public.upsert_user_level_state(p_user_id uuid)
returns void
language sql
security definer
as $$
  insert into public.user_level_state (user_id, level, xp_total, streak_days, last_activity_date)
  values (p_user_id, 1, 0, 0, null)
  on conflict (user_id) do nothing;
$$;

comment on function public.upsert_user_level_state is 'Crea registro de level state si no existe';
