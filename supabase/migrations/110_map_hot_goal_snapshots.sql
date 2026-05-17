-- 110_map_hot_goal_snapshots.sql
-- Map Hot Fase 8: serie temporal de current_value por goal.
-- Cron diario (/api/cron/map-hot/snapshot) inserta una fila por goal activo
-- para alimentar line charts en /map-hot/progress.
--
-- Decisiones:
-- - 1 snapshot por (goal, fecha) — unique constraint sobre (goal_id, recorded_at).
--   Si el cron corre 2x el mismo día, el segundo INSERT falla silenciosamente (UPSERT en app).
-- - recorded_at es DATE (no timestamptz) — el chart muestra por día, no por minuto.
-- - Sin soft-delete: snapshots son inmutables, cuando el goal se borra,
--   ON DELETE CASCADE los limpia.
-- - RLS solo SELECT para el owner. INSERT/UPDATE/DELETE solo via service role
--   (cron). El usuario no manipula snapshots manualmente.

create extension if not exists pgcrypto;

begin;

create table if not exists public.map_hot_goal_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.map_hot_goals(id) on delete cascade,
  recorded_at date not null default current_date,
  current_value numeric(14, 2) not null,
  created_at timestamptz not null default now(),

  constraint map_hot_goal_snapshots_unique unique (goal_id, recorded_at)
);

comment on table public.map_hot_goal_snapshots is 'Serie temporal de current_value por goal (snapshot diario, modulo Map Hot)';
comment on column public.map_hot_goal_snapshots.recorded_at is 'Fecha del snapshot (UTC). 1 snapshot por dia por goal.';

create index if not exists map_hot_goal_snapshots_user_goal_date_idx
  on public.map_hot_goal_snapshots(user_id, goal_id, recorded_at desc);

create index if not exists map_hot_goal_snapshots_recorded_at_idx
  on public.map_hot_goal_snapshots(recorded_at desc);

alter table public.map_hot_goal_snapshots enable row level security;

-- Owner-only SELECT. INSERT/UPDATE/DELETE solo via service role (sin policy).
drop policy if exists "map_hot_goal_snapshots_owner_select" on public.map_hot_goal_snapshots;
create policy "map_hot_goal_snapshots_owner_select"
  on public.map_hot_goal_snapshots for select
  using (auth.uid() = user_id);

commit;

-- ============================================================================
-- ROLLBACK NOTE
-- ============================================================================
-- drop table if exists public.map_hot_goal_snapshots cascade;
