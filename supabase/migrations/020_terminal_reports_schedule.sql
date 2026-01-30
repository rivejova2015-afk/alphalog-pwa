-- 020_terminal_reports_schedule.sql
-- Sprint Update 07: Terminal reports scheduling + state tracking

-- ============================================================================
-- TABLA: terminal_report_jobs (user-owned)
-- Jobs programados para reportes Terminal (one-off via QStash)
-- ============================================================================
create table if not exists public.terminal_report_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null,
  scheduled_for timestamptz not null,
  status text not null default 'pending',
  outcome text,
  qstash_schedule_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint terminal_report_jobs_asset_check check (asset in ('US500', 'XAUUSD', 'BOTH')),
  constraint terminal_report_jobs_status_check check (status in ('pending', 'done', 'done_no_changes', 'failed', 'cancelled'))
);

comment on table public.terminal_report_jobs is 'Jobs programados para reportes del Terminal (one-off, QStash)';
comment on column public.terminal_report_jobs.asset is 'Activo: US500, XAUUSD, BOTH';
comment on column public.terminal_report_jobs.scheduled_for is 'Ejecucion programada en UTC';
comment on column public.terminal_report_jobs.status is 'pending | done | done_no_changes | failed | cancelled';
comment on column public.terminal_report_jobs.qstash_schedule_id is 'ID de schedule en QStash';

create index terminal_report_jobs_user_scheduled_idx
  on public.terminal_report_jobs(user_id, scheduled_for desc);

alter table public.terminal_report_jobs enable row level security;

create policy terminal_report_jobs_select on public.terminal_report_jobs
  for select
  using (auth.uid() = user_id);

create policy terminal_report_jobs_insert on public.terminal_report_jobs
  for insert
  with check (auth.uid() = user_id);

create policy terminal_report_jobs_update on public.terminal_report_jobs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy terminal_report_jobs_delete on public.terminal_report_jobs
  for delete
  using (auth.uid() = user_id);

create trigger terminal_report_jobs_updated_at
  before update on public.terminal_report_jobs
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- TABLA: terminal_report_state (user-owned)
-- Guarda ultimo hash/ids por activo para detectar cambios relevantes
-- ============================================================================
create table if not exists public.terminal_report_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset text not null,
  last_item_ids jsonb,
  last_hash text,
  last_report_at timestamptz,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint terminal_report_state_asset_check check (asset in ('US500', 'XAUUSD'))
);

comment on table public.terminal_report_state is 'Estado por usuario/activo para detectar cambios relevantes';
comment on column public.terminal_report_state.last_item_ids is 'Lista de ids de items medio/alto del ultimo reporte';

create unique index terminal_report_state_user_asset_idx
  on public.terminal_report_state(user_id, asset);

alter table public.terminal_report_state enable row level security;

create policy terminal_report_state_select on public.terminal_report_state
  for select
  using (auth.uid() = user_id);

create policy terminal_report_state_insert on public.terminal_report_state
  for insert
  with check (auth.uid() = user_id);

create policy terminal_report_state_update on public.terminal_report_state
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy terminal_report_state_delete on public.terminal_report_state
  for delete
  using (auth.uid() = user_id);

create trigger terminal_report_state_updated_at
  before update on public.terminal_report_state
  for each row
  execute function public.set_updated_at();
