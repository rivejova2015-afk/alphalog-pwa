-- 006_tradehub_evidence_playbook.sql
-- Sprint 4.4: TradeHub Evidence Vault + Playbook
-- Decisiones:
-- - trade_evidence: tabla de evidencia con reporte de texto + archivo
-- - tv_analysis_evidence: tabla legacy de capturas (mantenida para compatibilidad)
-- - validation_status: texto (needs_review, valid, invalid) - editable desde UI
-- - trade_id y account_id: FK opcionales para linkar a operaciones y cuentas
-- - Soft-delete con deleted_at
-- - RLS owner-only
-- - file_path: ruta en storage bucket privado (signed URLs)

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLA: trade_evidence (Evidencia de Análisis + Archivo)
-- Nuevo formato: reporte_text + file_path (imagen/pdf)
-- ============================================================================
create table if not exists public.trade_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id uuid null references public.trades(id) on delete set null,
  account_id uuid null references public.accounts(id) on delete set null,
  
  -- Contenido
  title text not null,
  report_text text not null,
  file_path text null,
  mime_type text null,
  size_bytes bigint null,
  
  -- Validación
  validation_status text not null default 'needs_review',
  sort_index int not null default 0,
  
  -- Auditoría
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint trade_evidence_title_not_empty check (length(trim(title)) > 0),
  constraint trade_evidence_report_not_empty check (length(trim(report_text)) > 0),
  constraint trade_evidence_status_check check (validation_status in ('needs_review', 'valid', 'invalid')),
  constraint trade_evidence_size_check check (size_bytes is null or size_bytes >= 0)
);

comment on table public.trade_evidence is 'Evidencia de análisis de trading: reporte en texto + archivo opcional (soft-delete)';
comment on column public.trade_evidence.title is 'Título de la evidencia (obligatorio)';
comment on column public.trade_evidence.report_text is 'Reporte en texto libre o markdown (obligatorio)';
comment on column public.trade_evidence.file_path is 'Ruta a archivo en storage (imagen/pdf, opcional)';
comment on column public.trade_evidence.mime_type is 'MIME type del archivo (ej: image/png, application/pdf)';
comment on column public.trade_evidence.size_bytes is 'Tamaño del archivo en bytes';
comment on column public.trade_evidence.validation_status is 'needs_review, valid, o invalid - editable desde UI';

-- Índices
create index trade_evidence_user_created_at_idx 
  on public.trade_evidence(user_id, created_at desc) 
  where deleted_at is null;

create index trade_evidence_user_account_id_idx 
  on public.trade_evidence(user_id, account_id) 
  where deleted_at is null;

create index trade_evidence_user_trade_id_idx 
  on public.trade_evidence(user_id, trade_id) 
  where deleted_at is null;

-- Trigger
create trigger trade_evidence_updated_at
  before update on public.trade_evidence
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.trade_evidence enable row level security;

create policy trade_evidence_select_policy
  on public.trade_evidence for select
  using (auth.uid() = user_id);

create policy trade_evidence_insert_policy
  on public.trade_evidence for insert
  with check (auth.uid() = user_id);

create policy trade_evidence_update_policy
  on public.trade_evidence for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy trade_evidence_delete_policy
  on public.trade_evidence for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TABLA: tv_analysis_evidence (Legacy: Trading View Analysis Evidence)
-- Capturas de pantalla y evidencia de trading (papelería/análisis) - LEGACY
-- ============================================================================
create table if not exists public.tv_analysis_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  captured_at timestamptz not null default now(),
  user_notes text,
  trade_id uuid references public.trades(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  validation_status text not null default 'needs_review',
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint tv_analysis_evidence_status_check 
    check (validation_status in ('needs_review', 'valid', 'invalid'))
);

comment on table public.tv_analysis_evidence is 'Capturas de pantalla y evidencia de análisis de trading - LEGACY (soft-delete)';
comment on column public.tv_analysis_evidence.image_path is 'Ruta en storage bucket privado';
comment on column public.tv_analysis_evidence.validation_status is 'needs_review, valid, o invalid - editable desde UI';
comment on column public.tv_analysis_evidence.captured_at is 'Timestamp cuando se capturó la evidencia';
comment on column public.tv_analysis_evidence.sort_index is 'Ordenamiento flexible (0-basado)';

-- Índices
create index tv_analysis_evidence_user_captured_at_idx 
  on public.tv_analysis_evidence(user_id, captured_at desc) 
  where deleted_at is null;

create index tv_analysis_evidence_user_account_id_idx 
  on public.tv_analysis_evidence(user_id, account_id) 
  where deleted_at is null;

create index tv_analysis_evidence_user_trade_id_idx 
  on public.tv_analysis_evidence(user_id, trade_id) 
  where deleted_at is null;

-- Trigger
create trigger tv_analysis_evidence_updated_at
  before update on public.tv_analysis_evidence
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.tv_analysis_evidence enable row level security;

create policy tv_analysis_evidence_select_policy
  on public.tv_analysis_evidence for select
  using (auth.uid() = user_id);

create policy tv_analysis_evidence_insert_policy
  on public.tv_analysis_evidence for insert
  with check (auth.uid() = user_id);

create policy tv_analysis_evidence_update_policy
  on public.tv_analysis_evidence for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy tv_analysis_evidence_delete_policy
  on public.tv_analysis_evidence for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TABLA: playbook_setup_groups (Agrupador de setups con versionado)
-- ============================================================================
create table if not exists public.playbook_setup_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_lower text generated always as (lower(name)) stored,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint playbook_setup_groups_name_not_empty check (length(trim(name)) > 0)
);

comment on table public.playbook_setup_groups is 'Agrupador de versiones de setups (soft-delete)';

-- Anti-duplicados
create unique index playbook_setup_groups_uq
  on public.playbook_setup_groups(user_id, name_lower)
  where deleted_at is null;

-- Trigger
create trigger playbook_setup_groups_updated_at
  before update on public.playbook_setup_groups
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.playbook_setup_groups enable row level security;

create policy playbook_setup_groups_select_policy
  on public.playbook_setup_groups for select
  using (auth.uid() = user_id);

create policy playbook_setup_groups_insert_policy
  on public.playbook_setup_groups for insert
  with check (auth.uid() = user_id);

create policy playbook_setup_groups_update_policy
  on public.playbook_setup_groups for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy playbook_setup_groups_delete_policy
  on public.playbook_setup_groups for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TABLA: playbook_setup_versions (Versiones de setups)
-- ============================================================================
create table if not exists public.playbook_setup_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.playbook_setup_groups(id) on delete cascade,
  version int not null,
  description text,
  checklist text,
  created_at timestamptz not null default now(),
  
  constraint playbook_setup_versions_version_check check (version > 0),
  unique (group_id, version)
);

comment on table public.playbook_setup_versions is 'Versiones históricas de setups (inmutable, no soft-delete)';
comment on column public.playbook_setup_versions.version is 'Número de versión (1, 2, 3, ...)';
comment on column public.playbook_setup_versions.checklist is 'Checklist de setup en formato texto (markdown o simple)';

-- Índices
create index playbook_setup_versions_group_id_idx
  on public.playbook_setup_versions(group_id);

-- RLS
alter table public.playbook_setup_versions enable row level security;

create policy playbook_setup_versions_select_policy
  on public.playbook_setup_versions for select
  using (auth.uid() = user_id);

create policy playbook_setup_versions_insert_policy
  on public.playbook_setup_versions for insert
  with check (auth.uid() = user_id);

-- UPDATE/DELETE NO PERMITIDO (inmutable)

-- ============================================================================
-- TABLA: playbook_setup_current (Versión actual por grupo)
-- ============================================================================
create table if not exists public.playbook_setup_current (
  group_id uuid primary key references public.playbook_setup_groups(id) on delete cascade,
  current_version_id uuid not null references public.playbook_setup_versions(id) on delete restrict,
  updated_at timestamptz not null default now()
);

comment on table public.playbook_setup_current is 'Puntero a versión actual de cada grupo de setup';

-- Trigger
create trigger playbook_setup_current_updated_at
  before update on public.playbook_setup_current
  for each row
  execute function public.set_updated_at();

-- RLS (via group_id -> group.user_id)
alter table public.playbook_setup_current enable row level security;

create policy playbook_setup_current_select_policy
  on public.playbook_setup_current for select
  using (exists (
    select 1 from public.playbook_setup_groups g
    where g.id = playbook_setup_current.group_id and g.user_id = auth.uid()
  ));

create policy playbook_setup_current_update_policy
  on public.playbook_setup_current for update
  using (exists (
    select 1 from public.playbook_setup_groups g
    where g.id = playbook_setup_current.group_id and g.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.playbook_setup_groups g
    where g.id = playbook_setup_current.group_id and g.user_id = auth.uid()
  ));
