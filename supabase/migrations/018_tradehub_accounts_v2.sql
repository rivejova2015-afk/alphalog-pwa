-- 018_tradehub_accounts_v2.sql
-- Ajustes TradeHub Accounts/Categories/Trades
-- - account_categories: description, permitir duplicados (sin unique), mantener name_lower para orden A-Z
-- - accounts: currency y status (Activa/Archivada)
-- - trades: tags[] para tabla de Trades en modal (lectura)

-- account_categories: agregar description
alter table if exists public.account_categories
  add column if not exists description text null;

-- account_categories: permitir duplicados -> eliminar unique previo y crear índice no-único
drop index if exists account_categories_user_name_uq;
drop index if exists account_categories_name_lower_uq;
create index if not exists account_categories_user_name_idx
  on public.account_categories(user_id, name_lower)
  where deleted_at is null;

-- accounts: currency y status
alter table if exists public.accounts
  add column if not exists currency text not null default 'USD';

alter table if exists public.accounts
  add column if not exists status text not null default 'active';

-- Normalizar datos existentes
update public.accounts set currency = 'USD' where currency is null;
update public.accounts set status = 'active' where status is null;

-- trades: tags[] para vista de Trades en modal Detalles
alter table if exists public.trades
  add column if not exists tags text[] not null default '{}';

-- Índice para exit_date (orden DESC en modal)
create index if not exists trades_user_exit_date_idx
  on public.trades(user_id, exit_date desc)
  where deleted_at is null;
