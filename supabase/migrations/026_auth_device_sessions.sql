-- 026_auth_device_sessions.sql
-- Device session tracking for step-up authentication

create table if not exists public.auth_device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint_hash text not null,
  ip_hint text null,
  user_agent text null,
  trusted boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint auth_device_sessions_hash_check check (char_length(fingerprint_hash) >= 16)
);

create unique index if not exists auth_device_sessions_user_fingerprint_uq
  on public.auth_device_sessions(user_id, fingerprint_hash);

create trigger auth_device_sessions_updated_at
  before update on public.auth_device_sessions
  for each row
  execute function public.set_updated_at();

alter table public.auth_device_sessions enable row level security;

create policy auth_device_sessions_select
  on public.auth_device_sessions for select
  using (auth.uid() = user_id);

create policy auth_device_sessions_insert
  on public.auth_device_sessions for insert
  with check (auth.uid() = user_id);

create policy auth_device_sessions_update
  on public.auth_device_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy auth_device_sessions_delete
  on public.auth_device_sessions for delete
  using (auth.uid() = user_id);
