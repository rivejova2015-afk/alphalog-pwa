-- 002_add_user_id_to_categories.sql
-- Agregar user_id a account_categories para hacerlas user-scoped
-- RLS: cada usuario solo ve/edita sus propias categorías

-- Agregar columna user_id nullable (para migracion)
alter table if exists public.account_categories
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Actualizar constraint unique_index para incluir user_id
drop index if exists ux_account_categories_name_active;
create unique index if not exists ux_account_categories_name_active
  on public.account_categories (user_id, name)
  where deleted_at is null;

-- Habilitar RLS
alter table public.account_categories enable row level security;

-- RLS: select propias categorías
drop policy if exists "Users can view own categories" on public.account_categories;
create policy "Users can view own categories"
  on public.account_categories for select
  using (auth.uid() = user_id);

-- RLS: insert propias categorías
drop policy if exists "Users can create own categories" on public.account_categories;
create policy "Users can create own categories"
  on public.account_categories for insert
  with check (auth.uid() = user_id);

-- RLS: update propias categorías
drop policy if exists "Users can update own categories" on public.account_categories;
create policy "Users can update own categories"
  on public.account_categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- RLS: delete (soft) propias categorías
drop policy if exists "Users can delete own categories" on public.account_categories;
create policy "Users can delete own categories"
  on public.account_categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
