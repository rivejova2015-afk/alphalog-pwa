-- 004_terminal.sql
-- Sprint 4.2: Terminal with News, Calendar, Evidence Reports
-- Decisiones:
-- - instruments: global read-only (seed: US500, XAUUSD)
-- - terminal_news/events: requieren instrument_id (obligatorio)
-- - terminal_evidence_reports: instrument_id opcional
-- - Evidence attachments: mismo bucket privado existente
-- - RLS owner-only en tablas user-owned
-- - Anti-duplicados via name_lower + sort_index

-- ============================================================================
-- TABLA: instruments (GLOBAL, read-only)
-- Instrumentos financieros disponibles (US500, XAUUSD, etc.)
-- ============================================================================
create table if not exists public.instruments (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  display_name text not null,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint instruments_symbol_not_empty check (length(trim(symbol)) > 0),
  constraint instruments_display_name_not_empty check (length(trim(display_name)) > 0)
);

comment on table public.instruments is 'Instrumentos financieros globales (read-only)';
comment on column public.instruments.symbol is 'Símbolo único (ej: US500, XAUUSD)';
comment on column public.instruments.display_name is 'Nombre para mostrar (ej: "US500 (S&P500)")';
comment on column public.instruments.sort_index is 'Ordenamiento flexible';

-- RLS: SELECT only para authenticated users (no insert/update/delete)
alter table public.instruments enable row level security;

create policy instruments_select_authenticated on public.instruments
  for select
  using (auth.role() = 'authenticated');

-- Seed idempotente: US500 + XAUUSD
insert into public.instruments (symbol, display_name, sort_index)
values 
  ('US500', 'US500 (S&P500)', 1),
  ('XAUUSD', 'XAUUSD (Gold)', 2)
on conflict (symbol) do nothing;

-- ============================================================================
-- TABLA: terminal_news (user-owned)
-- Noticias por instrumento
-- ============================================================================
create table if not exists public.terminal_news (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  title text not null,
  url text,
  source text,
  relevancy_score int,
  impact_label text,
  timestamp_utc timestamptz not null default now(),
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint terminal_news_title_not_empty check (length(trim(title)) > 0)
);

comment on table public.terminal_news is 'Noticias financieras por usuario e instrumento (soft-delete)';
comment on column public.terminal_news.instrument_id is 'Referencia obligatoria al instrumento';
comment on column public.terminal_news.relevancy_score is 'Puntuación de relevancia (0-100)';
comment on column public.terminal_news.impact_label is 'Etiqueta de impacto (ej: "High", "Medium", "Low")';

create index terminal_news_user_instrument_timestamp on public.terminal_news(user_id, instrument_id, timestamp_utc desc)
  where deleted_at is null;

-- RLS: owner-only (auth.uid()=user_id)
alter table public.terminal_news enable row level security;

create policy terminal_news_select on public.terminal_news
  for select
  using (auth.uid() = user_id and deleted_at is null);

create policy terminal_news_insert on public.terminal_news
  for insert
  with check (auth.uid() = user_id);

create policy terminal_news_update on public.terminal_news
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy terminal_news_delete on public.terminal_news
  for delete
  using (auth.uid() = user_id);

-- Trigger: auto updated_at
create trigger terminal_news_updated_at
  before update on public.terminal_news
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- TABLA: terminal_events (user-owned)
-- Eventos de calendario (ej: earnings, economic data, etc.)
-- ============================================================================
create table if not exists public.terminal_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  name text not null,
  impact text,
  timestamp_utc timestamptz not null,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint terminal_events_name_not_empty check (length(trim(name)) > 0)
);

comment on table public.terminal_events is 'Eventos de calendario por usuario e instrumento (soft-delete)';
comment on column public.terminal_events.instrument_id is 'Referencia obligatoria al instrumento';
comment on column public.terminal_events.impact is 'Impacto esperado (ej: "High", "Medium", "Low")';
comment on column public.terminal_events.timestamp_utc is 'Fecha/hora del evento';

create index terminal_events_user_instrument_timestamp on public.terminal_events(user_id, instrument_id, timestamp_utc asc)
  where deleted_at is null;

-- RLS: owner-only
alter table public.terminal_events enable row level security;

create policy terminal_events_select on public.terminal_events
  for select
  using (auth.uid() = user_id and deleted_at is null);

create policy terminal_events_insert on public.terminal_events
  for insert
  with check (auth.uid() = user_id);

create policy terminal_events_update on public.terminal_events
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy terminal_events_delete on public.terminal_events
  for delete
  using (auth.uid() = user_id);

-- Trigger: auto updated_at
create trigger terminal_events_updated_at
  before update on public.terminal_events
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- TABLA: terminal_evidence_reports (user-owned)
-- Reportes de evidencia/análisis (IA stub)
-- ============================================================================
create table if not exists public.terminal_evidence_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  instrument_id uuid,
  title text not null,
  content text not null,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint terminal_evidence_reports_title_not_empty check (length(trim(title)) > 0),
  constraint terminal_evidence_reports_content_not_empty check (length(trim(content)) > 0)
);

comment on table public.terminal_evidence_reports is 'Reportes de evidencia/análisis por usuario (soft-delete, instrument_id opcional)';
comment on column public.terminal_evidence_reports.instrument_id is 'Referencia opcional al instrumento';
comment on column public.terminal_evidence_reports.title is 'Título del reporte';
comment on column public.terminal_evidence_reports.content is 'Contenido del reporte (IA generado o manual)';

create index terminal_evidence_reports_user_created on public.terminal_evidence_reports(user_id, created_at desc)
  where deleted_at is null;

-- RLS: owner-only
alter table public.terminal_evidence_reports enable row level security;

create policy terminal_evidence_reports_select on public.terminal_evidence_reports
  for select
  using (auth.uid() = user_id and deleted_at is null);

create policy terminal_evidence_reports_insert on public.terminal_evidence_reports
  for insert
  with check (auth.uid() = user_id);

create policy terminal_evidence_reports_update on public.terminal_evidence_reports
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy terminal_evidence_reports_delete on public.terminal_evidence_reports
  for delete
  using (auth.uid() = user_id);

-- Trigger: auto updated_at
create trigger terminal_evidence_reports_updated_at
  before update on public.terminal_evidence_reports
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- TABLA: terminal_evidence_attachments (user-owned)
-- Adjuntos múltiples para reportes de evidencia
-- Usa bucket privado existente (log_attachments o similar)
-- Path: ${userId}/terminal/evidence/${reportId}/${uuid}_${filename}
-- ============================================================================
create table if not exists public.terminal_evidence_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_id uuid not null references public.terminal_evidence_reports(id) on delete cascade,
  path text not null,
  filename text not null,
  mime_type text,
  size_bytes int not null,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint terminal_evidence_attachments_filename_not_empty check (length(trim(filename)) > 0),
  constraint terminal_evidence_attachments_mime_type_not_empty check (length(trim(mime_type)) > 0)
);

comment on table public.terminal_evidence_attachments is 'Adjuntos para reportes de evidencia (soft-delete)';
comment on column public.terminal_evidence_attachments.path is 'Path en storage bucket: ${userId}/terminal/evidence/${reportId}/${uuid}_${filename}';
comment on column public.terminal_evidence_attachments.report_id is 'Referencia al reporte (cascada delete)';

create index terminal_evidence_attachments_user_report_created on public.terminal_evidence_attachments(user_id, report_id, created_at desc)
  where deleted_at is null;

-- RLS: owner-only
alter table public.terminal_evidence_attachments enable row level security;

create policy terminal_evidence_attachments_select on public.terminal_evidence_attachments
  for select
  using (auth.uid() = user_id and deleted_at is null);

create policy terminal_evidence_attachments_insert on public.terminal_evidence_attachments
  for insert
  with check (auth.uid() = user_id);

create policy terminal_evidence_attachments_update on public.terminal_evidence_attachments
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy terminal_evidence_attachments_delete on public.terminal_evidence_attachments
  for delete
  using (auth.uid() = user_id);

-- Trigger: auto updated_at
create trigger terminal_evidence_attachments_updated_at
  before update on public.terminal_evidence_attachments
  for each row
  execute function public.set_updated_at();
