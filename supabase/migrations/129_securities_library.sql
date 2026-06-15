-- Biblioteca de CyberSec Academy: PDFs subidos por el usuario (su propia copia).
-- El catálogo curado de recursos gratuitos vive en código (lib/.../library.ts);
-- esta tabla guarda SOLO la metadata de los archivos que el dueño sube a Storage
-- (bucket log_attachments, prefijo <user_id>/library/...). RLS owner-only +
-- soft-delete, alineado al patrón del proyecto. Aditiva e idempotente.

create table if not exists public.securities_library_uploads (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users on delete cascade,
  title         text        not null,
  author        text,
  category      text,
  level         text        not null default 'all',
  storage_path  text        not null,
  mime_type     text,
  size_bytes    bigint,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

alter table public.securities_library_uploads enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'securities_library_uploads'
      and policyname = 'users_own_securities_library_uploads'
  ) then
    create policy "users_own_securities_library_uploads"
      on public.securities_library_uploads for all
      using      (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create index if not exists idx_securities_library_uploads_user
  on public.securities_library_uploads (user_id, deleted_at, created_at desc);

-- CHECK de level idempotente.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'securities_library_uploads_level_chk'
  ) then
    alter table public.securities_library_uploads
      add constraint securities_library_uploads_level_chk
      check (level in ('b','i','a','all'));
  end if;
end $$;
