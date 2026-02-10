-- 027_api_rate_limits.sql
-- Simple API rate limiting (per key + time window)

create table if not exists public.api_rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint api_rate_limits_hits_check check (hits >= 1)
);

create unique index if not exists api_rate_limits_key_window_uq
  on public.api_rate_limits(key, window_start);

create trigger api_rate_limits_updated_at
  before update on public.api_rate_limits
  for each row
  execute function public.set_updated_at();

alter table public.api_rate_limits enable row level security;

create policy api_rate_limits_select
  on public.api_rate_limits for select
  using (auth.uid() is not null);

create policy api_rate_limits_insert
  on public.api_rate_limits for insert
  with check (auth.uid() is not null);

create policy api_rate_limits_update
  on public.api_rate_limits for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Atomic increment function (service role bypasses RLS)
create or replace function public.increment_api_rate_limit(
  p_key text,
  p_window_start timestamptz
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  next_hits int;
begin
  insert into public.api_rate_limits (key, window_start, hits)
  values (p_key, p_window_start, 1)
  on conflict (key, window_start)
  do update set hits = public.api_rate_limits.hits + 1, updated_at = now()
  returning hits into next_hits;

  return next_hits;
end;
$$;
