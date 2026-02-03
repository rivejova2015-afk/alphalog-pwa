-- 021_logs_schema.sql
-- Sprint 3.1: Logs with categories, tags, attachments, RLS, anti-duplicados
-- Decisiones:
-- - category_id NOT NULL (logs SIEMPRE tienen categoría)
-- - tags normalizados en tabla separada (N:M)
-- - log_attachments para múltiples archivos por log
-- - RLS owner-only en todas las tablas
-- - Anti-duplicados: 
--   * Categories/tags (case-insensitive, ignora soft-delete)
--   * Logs (mismo título mismo día UTC, ignora soft-delete)
-- - Storage bucket privado `log_attachments` con owner-only policies
-- - sort_index para ordenamiento flexible

-- pgcrypto ya existe de 001_init_schema.sql pero puede ser idempotente
create extension if not exists pgcrypto;

-- ============================================================================
-- HELPER: Updated At Trigger (reusable, si no existe)
-- ============================================================================
-- (Ya existe de 001_init_schema.sql, pero es idempotente)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- TABLA: categories
-- Categorías de logs (ej: Trading, Personal, Notes, etc.)
-- ============================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_lower text generated always as (lower(name)) stored,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint categories_name_not_empty check (length(trim(name)) > 0)
);

comment on table public.categories is 'Categorías de logs por usuario (soft-delete)';
comment on column public.categories.name_lower is 'Generado: lower(name) para búsquedas case-insensitive';
comment on column public.categories.sort_index is 'Ordenamiento flexible (0-basado)';

-- Anti-duplicados: user_id + name_lower, ignorando soft-delete
create unique index if not exists categories_user_name_uq 
on public.categories (user_id, name_lower) 
where deleted_at is null;

-- Query optimization
create index if not exists categories_user_sort_idx 
on public.categories (user_id, sort_index);

-- RLS para categories
alter table public.categories enable row level security;

create policy categories_select_own on public.categories for select
  using (auth.uid() = user_id and deleted_at is null);

create policy categories_insert_own on public.categories for insert
  with check (auth.uid() = user_id);

create policy categories_update_own on public.categories for update
  using (auth.uid() = user_id);

create policy categories_delete_own on public.categories for delete
  using (auth.uid() = user_id);

-- Trigger: updated_at automático
drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

-- ============================================================================
-- TABLA: tags
-- Tags reutilizables asociados a logs (N:M vía log_tags)
-- ============================================================================
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_lower text generated always as (lower(name)) stored,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint tags_name_not_empty check (length(trim(name)) > 0)
);

comment on table public.tags is 'Tags reutilizables para logs (soft-delete)';
comment on column public.tags.name_lower is 'Generado: lower(name) para búsquedas case-insensitive';

-- Anti-duplicados: user_id + name_lower, ignorando soft-delete
create unique index if not exists tags_user_name_uq 
on public.tags (user_id, name_lower) 
where deleted_at is null;

-- Query optimization
create index if not exists tags_user_sort_idx 
on public.tags (user_id, sort_index);

-- RLS para tags
alter table public.tags enable row level security;

create policy tags_select_own on public.tags for select
  using (auth.uid() = user_id and deleted_at is null);

create policy tags_insert_own on public.tags for insert
  with check (auth.uid() = user_id);

create policy tags_update_own on public.tags for update
  using (auth.uid() = user_id);

create policy tags_delete_own on public.tags for delete
  using (auth.uid() = user_id);

-- Trigger: updated_at automático
drop trigger if exists tags_set_updated_at on public.tags;
create trigger tags_set_updated_at
before update on public.tags
for each row
execute function public.set_updated_at();

-- ============================================================================
-- TABLA: logs
-- Logs de usuario con título, notas, categoría, adjuntos, tags
-- ============================================================================
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  title_lower text generated always as (lower(title)) stored,
  notes text not null,
  type text,
  category_id uuid not null references public.categories(id) on delete restrict,
  created_day_utc date generated always as ((created_at at time zone 'utc')::date) stored,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint logs_title_not_empty check (length(trim(title)) > 0),
  constraint logs_notes_not_empty check (length(trim(notes)) > 0)
);

comment on table public.logs is 'Logs de usuario (trading notes, personal notes, etc.)';
comment on column public.logs.category_id is 'Categoría OBLIGATORIA - referencias a categories(id)';
comment on column public.logs.title_lower is 'Generado: lower(title) para búsquedas case-insensitive';
comment on column public.logs.created_day_utc is 'Generado: fecha UTC del log (sin hora)';
comment on column public.logs.sort_index is 'Ordenamiento flexible dentro del mismo día';

-- Anti-duplicados: mismo user_id, título (case-insensitive), mismo día UTC
-- Bloquea logs duplicados el mismo día
create unique index if not exists logs_user_title_day_uq 
on public.logs (user_id, title_lower, created_day_utc) 
where deleted_at is null;

-- Query optimization
create index if not exists logs_user_sort_idx 
on public.logs (user_id, sort_index);

create index if not exists logs_user_created_idx 
on public.logs (user_id, created_at desc);

create index if not exists logs_user_category_idx 
on public.logs (user_id, category_id);

-- RLS para logs
alter table public.logs enable row level security;

create policy logs_select_own on public.logs for select
  using (auth.uid() = user_id and deleted_at is null);

create policy logs_insert_own on public.logs for insert
  with check (auth.uid() = user_id);

create policy logs_update_own on public.logs for update
  using (auth.uid() = user_id);

create policy logs_delete_own on public.logs for delete
  using (auth.uid() = user_id);

-- Trigger: updated_at automático
drop trigger if exists logs_set_updated_at on public.logs;
create trigger logs_set_updated_at
before update on public.logs
for each row
execute function public.set_updated_at();

-- ============================================================================
-- TABLA: log_tags (N:M)
-- Asocia logs con múltiples tags
-- ============================================================================
create table if not exists public.log_tags (
  log_id uuid not null references public.logs(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  
  primary key (log_id, tag_id)
);

comment on table public.log_tags is 'Asociación N:M entre logs y tags';
comment on column public.log_tags.user_id is 'Desnormalizado para facilitar RLS y auditoría';

-- Query optimization
create index if not exists log_tags_user_log_idx 
on public.log_tags (user_id, log_id);

create index if not exists log_tags_tag_idx 
on public.log_tags (tag_id);

-- RLS para log_tags
alter table public.log_tags enable row level security;

create policy log_tags_select_own on public.log_tags for select
  using (auth.uid() = user_id);

create policy log_tags_insert_own on public.log_tags for insert
  with check (auth.uid() = user_id);

create policy log_tags_delete_own on public.log_tags for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TABLA: log_attachments
-- Adjuntos múltiples por log (imágenes, PDFs, etc.)
-- ============================================================================
create table if not exists public.log_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_id uuid not null references public.logs(id) on delete cascade,
  path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint attachments_path_not_empty check (length(trim(path)) > 0),
  constraint attachments_filename_not_empty check (length(trim(filename)) > 0)
);

comment on table public.log_attachments is 'Archivos adjuntos a logs (storage bucket: log_attachments)';
comment on column public.log_attachments.path is 'Ruta en storage: ${user_id}/${log_id}/${uuid}_${filename}';
comment on column public.log_attachments.filename is 'Nombre original del archivo';
comment on column public.log_attachments.mime_type is 'MIME type (ej: image/jpeg, application/pdf)';
comment on column public.log_attachments.size_bytes is 'Tamaño en bytes';

-- Query optimization
create index if not exists log_attachments_user_log_idx 
on public.log_attachments (user_id, log_id, created_at desc);

create index if not exists log_attachments_log_idx 
on public.log_attachments (log_id);

-- RLS para log_attachments
alter table public.log_attachments enable row level security;

create policy log_attachments_select_own on public.log_attachments for select
  using (auth.uid() = user_id and deleted_at is null);

create policy log_attachments_insert_own on public.log_attachments for insert
  with check (auth.uid() = user_id);

create policy log_attachments_update_own on public.log_attachments for update
  using (auth.uid() = user_id);

create policy log_attachments_delete_own on public.log_attachments for delete
  using (auth.uid() = user_id);

-- Trigger: updated_at automático
drop trigger if exists log_attachments_set_updated_at on public.log_attachments;
create trigger log_attachments_set_updated_at
before update on public.log_attachments
for each row
execute function public.set_updated_at();

-- ============================================================================
-- Storage Bucket Policies (log_attachments)
-- ============================================================================
-- NOTA: Estas policies se aplicarían manual o vía Supabase dashboard por ahora
-- Convención de path para facilitar RLS: ${user_id}/${log_id}/${uuid}_${filename}
-- Esto permite split_part(name, '/', 1) = auth.uid()::text para owner-only access

-- Example SQL (comentado - aplicar en dashboard si es necesario):
/*
-- Create bucket if not exists (via dashboard mejor):
-- insert into storage.buckets (id, name, public)
-- values ('log_attachments', 'log_attachments', false);

-- SELECT policy: solo el propietario puede descargar sus archivos
create policy "log_attachments_select_own" on storage.objects for select
  using (
    bucket_id = 'log_attachments'
    and auth.uid()::text = split_part(name, '/', 1)
  );

-- INSERT policy: solo el propietario puede subir archivos
create policy "log_attachments_insert_own" on storage.objects for insert
  with check (
    bucket_id = 'log_attachments'
    and auth.uid()::text = split_part(name, '/', 1)
  );

-- DELETE policy: solo el propietario puede eliminar archivos
create policy "log_attachments_delete_own" on storage.objects for delete
  using (
    bucket_id = 'log_attachments'
    and auth.uid()::text = split_part(name, '/', 1)
  );
*/

-- ============================================================================
-- RESUMEN
-- ============================================================================
-- Tablas creadas: categories, tags, logs, log_tags, log_attachments
-- RLS: habilitado en todas (owner-only: auth.uid() = user_id)
-- Anti-duplicados: 
--   - categories: unique (user_id, name_lower) where deleted_at is null
--   - tags: unique (user_id, name_lower) where deleted_at is null
--   - logs: unique (user_id, title_lower, created_day_utc) where deleted_at is null
-- Soft-delete: deleted_at timestamptz (NULL = activo)
-- Triggers: updated_at automático antes de UPDATE
-- Storage: bucket 'log_attachments' (privado) con path convention: ${user_id}/${log_id}/${uuid}_${filename}
