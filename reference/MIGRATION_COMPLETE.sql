-- MIGRATION: Complete AlphaLog Schema Setup
-- Purpose: Execute all required migrations for Sprint 4 completion
-- Date: 2026-01-17
-- Instructions:
-- 1. Copy this entire file
-- 2. Open Supabase Dashboard → SQL Editor
-- 3. Create new query and paste the contents
-- 4. Click "Run" to execute all migrations
-- 5. Verify all tables are created without errors

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ============================================================================
-- Utilities: set_updated_at trigger function
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- TABLE: account_categories
-- ============================================================================
create table if not exists public.account_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_lower text generated always as (lower(name)) stored,
  sort_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.account_categories is 'Categorías de cuentas de trading por usuario';
create unique index if not exists account_categories_user_name_uq 
  on public.account_categories(user_id, name_lower) 
  where deleted_at is null;
create index if not exists account_categories_user_id_idx 
  on public.account_categories(user_id) 
  where deleted_at is null;

drop trigger if exists account_categories_updated_at on public.account_categories;
create trigger account_categories_updated_at
  before update on public.account_categories
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.account_categories enable row level security;
drop policy if exists "Users can view/edit own categories" on public.account_categories;
create policy "Users can view/edit own categories" on public.account_categories
  for all using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: accounts
-- ============================================================================
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.account_categories(id) on delete restrict,
  name text not null,
  account_size numeric,
  current_balance numeric,
  operation_state text,
  phase_status text,
  role text,
  withdrawals_enabled boolean default true,
  sort_index int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.accounts is 'Trading accounts managed by users';
create index if not exists accounts_user_id_idx 
  on public.accounts(user_id) 
  where deleted_at is null;
create index if not exists accounts_category_id_idx 
  on public.accounts(category_id) 
  where deleted_at is null;

drop trigger if exists accounts_updated_at on public.accounts;
create trigger accounts_updated_at
  before update on public.accounts
  for each row
  execute function public.set_updated_at();

alter table public.accounts enable row level security;
drop policy if exists "Users can view/edit own accounts" on public.accounts;
create policy "Users can view/edit own accounts" on public.accounts
  for all using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: setups
-- ============================================================================
create table if not exists public.setups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  rules jsonb,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.setups is 'Trading setups / playbooks by user';
create index if not exists setups_user_id_idx 
  on public.setups(user_id) 
  where deleted_at is null;

drop trigger if exists setups_updated_at on public.setups;
create trigger setups_updated_at
  before update on public.setups
  for each row
  execute function public.set_updated_at();

alter table public.setups enable row level security;
drop policy if exists "Users can view/edit own setups" on public.setups;
create policy "Users can view/edit own setups" on public.setups
  for all using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: trades
-- ============================================================================
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  setup_id uuid references public.setups(id) on delete set null,
  symbol text not null,
  side text,
  entry_price numeric,
  exit_price numeric,
  entry_date date,
  exit_date date,
  quantity numeric,
  pnl numeric,
  r_ratio numeric,
  notes text,
  screenshot_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.trades is 'Individual trades logged by users';
create index if not exists trades_user_id_idx 
  on public.trades(user_id) 
  where deleted_at is null;
create index if not exists trades_account_id_idx 
  on public.trades(account_id) 
  where deleted_at is null;
create index if not exists trades_exit_date_idx 
  on public.trades(exit_date) 
  where deleted_at is null;

drop trigger if exists trades_updated_at on public.trades;
create trigger trades_updated_at
  before update on public.trades
  for each row
  execute function public.set_updated_at();

alter table public.trades enable row level security;
drop policy if exists "Users can view/edit own trades" on public.trades;
create policy "Users can view/edit own trades" on public.trades
  for all using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: instruments (Terminal)
-- ============================================================================
create table if not exists public.instruments (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  display_name text not null,
  sort_index int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.instruments is 'Global list of trading instruments (public read-only)';
create index if not exists instruments_symbol_idx on public.instruments(symbol);

drop trigger if exists instruments_updated_at on public.instruments;
create trigger instruments_updated_at
  before update on public.instruments
  for each row
  execute function public.set_updated_at();

-- NOTE: instruments is public-readable, no RLS needed for SELECT

-- ============================================================================
-- TABLE: terminal_news
-- ============================================================================
create table if not exists public.terminal_news (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text,
  source text,
  relevancy_score int,
  impact_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.terminal_news is 'News items per instrument by user';
create index if not exists terminal_news_user_id_idx 
  on public.terminal_news(user_id) 
  where deleted_at is null;
create index if not exists terminal_news_instrument_id_idx 
  on public.terminal_news(instrument_id) 
  where deleted_at is null;

drop trigger if exists terminal_news_updated_at on public.terminal_news;
create trigger terminal_news_updated_at
  before update on public.terminal_news
  for each row
  execute function public.set_updated_at();

alter table public.terminal_news enable row level security;
drop policy if exists "Users can view/edit own news" on public.terminal_news;
create policy "Users can view/edit own news" on public.terminal_news
  for all using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: terminal_events (Calendar)
-- ============================================================================
create table if not exists public.terminal_events (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  event_date date not null,
  importance text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.terminal_events is 'Calendar events per instrument by user';
create index if not exists terminal_events_user_id_idx 
  on public.terminal_events(user_id) 
  where deleted_at is null;
create index if not exists terminal_events_instrument_id_idx 
  on public.terminal_events(instrument_id) 
  where deleted_at is null;

drop trigger if exists terminal_events_updated_at on public.terminal_events;
create trigger terminal_events_updated_at
  before update on public.terminal_events
  for each row
  execute function public.set_updated_at();

alter table public.terminal_events enable row level security;
drop policy if exists "Users can view/edit own events" on public.terminal_events;
create policy "Users can view/edit own events" on public.terminal_events
  for all using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: tv_analysis_evidence (Evidence Vault)
-- ============================================================================
create table if not exists public.tv_analysis_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id uuid references public.trades(id) on delete set null,
  title text,
  description text,
  file_url text,
  file_key text,
  status text default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.tv_analysis_evidence is 'Trading evidence/screenshots by user';
create index if not exists tv_analysis_evidence_user_id_idx 
  on public.tv_analysis_evidence(user_id) 
  where deleted_at is null;
create index if not exists tv_analysis_evidence_trade_id_idx 
  on public.tv_analysis_evidence(trade_id) 
  where deleted_at is null;

drop trigger if exists tv_analysis_evidence_updated_at on public.tv_analysis_evidence;
create trigger tv_analysis_evidence_updated_at
  before update on public.tv_analysis_evidence
  for each row
  execute function public.set_updated_at();

alter table public.tv_analysis_evidence enable row level security;
drop policy if exists "Users can view/edit own evidence" on public.tv_analysis_evidence;
create policy "Users can view/edit own evidence" on public.tv_analysis_evidence
  for all using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: weekly_reports
-- ============================================================================
create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  content_md text,
  total_trades int default 0,
  total_pnl numeric default 0,
  win_rate numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  
  constraint weekly_reports_unique_week unique (user_id, week_start, week_end)
);

comment on table public.weekly_reports is 'Weekly AlphaBrief reports by user';
create index if not exists weekly_reports_user_id_idx 
  on public.weekly_reports(user_id) 
  where deleted_at is null;
create index if not exists weekly_reports_week_start_idx 
  on public.weekly_reports(week_start) 
  where deleted_at is null;

drop trigger if exists weekly_reports_updated_at on public.weekly_reports;
create trigger weekly_reports_updated_at
  before update on public.weekly_reports
  for each row
  execute function public.set_updated_at();

alter table public.weekly_reports enable row level security;
drop policy if exists "Users can view/edit own reports" on public.weekly_reports;
create policy "Users can view/edit own reports" on public.weekly_reports
  for all using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: categories (Logs)
-- ============================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_lower text generated always as (lower(name)) stored,
  color text,
  sort_index int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.categories is 'Log categories by user';
create unique index if not exists categories_user_name_uq 
  on public.categories(user_id, name_lower) 
  where deleted_at is null;
create index if not exists categories_user_id_idx 
  on public.categories(user_id) 
  where deleted_at is null;

drop trigger if exists categories_updated_at on public.categories;
create trigger categories_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

alter table public.categories enable row level security;
drop policy if exists "Users can view/edit own categories" on public.categories;
create policy "Users can view/edit own categories" on public.categories
  for all using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: tags (Logs)
-- ============================================================================
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  name_lower text generated always as (lower(name)) stored,
  sort_index int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.tags is 'Log tags by user';
create unique index if not exists tags_user_name_uq 
  on public.tags(user_id, name_lower) 
  where deleted_at is null;
create index if not exists tags_user_id_idx 
  on public.tags(user_id) 
  where deleted_at is null;

drop trigger if exists tags_updated_at on public.tags;
create trigger tags_updated_at
  before update on public.tags
  for each row
  execute function public.set_updated_at();

alter table public.tags enable row level security;
drop policy if exists "Users can view/edit own tags" on public.tags;
create policy "Users can view/edit own tags" on public.tags
  for all using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: logs (Journal PT)
-- ============================================================================
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  type text,
  category_id uuid not null references public.categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.logs is 'Trading journal logs by user';
create index if not exists logs_user_id_idx 
  on public.logs(user_id) 
  where deleted_at is null;
create index if not exists logs_category_id_idx 
  on public.logs(category_id) 
  where deleted_at is null;
create index if not exists logs_created_at_idx 
  on public.logs(created_at desc) 
  where deleted_at is null;

drop trigger if exists logs_updated_at on public.logs;
create trigger logs_updated_at
  before update on public.logs
  for each row
  execute function public.set_updated_at();

alter table public.logs enable row level security;
drop policy if exists "Users can view/edit own logs" on public.logs;
create policy "Users can view/edit own logs" on public.logs
  for all using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: log_tags (Junction: logs ↔ tags)
-- ============================================================================
create table if not exists public.log_tags (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.logs(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  
  constraint log_tags_unique unique (log_id, tag_id)
);

comment on table public.log_tags is 'Junction table for logs and tags';
create index if not exists log_tags_log_id_idx on public.log_tags(log_id);
create index if not exists log_tags_tag_id_idx on public.log_tags(tag_id);

alter table public.log_tags enable row level security;
drop policy if exists "Users can view/edit own log_tags" on public.log_tags;
create policy "Users can view/edit own log_tags" on public.log_tags
  as (
    select exists (
      select 1 from public.logs where logs.id = log_tags.log_id and logs.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TABLE: attachments (General file storage metadata)
-- ============================================================================
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_size int not null,
  mime_type text,
  storage_path text not null,
  related_type text,
  related_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.attachments is 'Metadata for user-uploaded files';
create index if not exists attachments_user_id_idx 
  on public.attachments(user_id) 
  where deleted_at is null;
create index if not exists attachments_related_type_id_idx 
  on public.attachments(related_type, related_id) 
  where deleted_at is null;

drop trigger if exists attachments_updated_at on public.attachments;
create trigger attachments_updated_at
  before update on public.attachments
  for each row
  execute function public.set_updated_at();

alter table public.attachments enable row level security;
drop policy if exists "Users can view/edit own attachments" on public.attachments;
create policy "Users can view/edit own attachments" on public.attachments
  for all using (auth.uid() = user_id);

-- ============================================================================
-- SEED DATA: Global instruments (for Terminal)
-- ============================================================================
insert into public.instruments (symbol, display_name, sort_index)
values
  ('EURUSD', 'EUR / USD', 1),
  ('GBPUSD', 'GBP / USD', 2),
  ('USDJPY', 'USD / JPY', 3),
  ('AUDUSD', 'AUD / USD', 4),
  ('USDCAD', 'USD / CAD', 5),
  ('NZDUSD', 'NZD / USD', 6),
  ('USDCHF', 'USD / CHF', 7),
  ('XAUUSD', 'Gold (XAU / USD)', 8),
  ('XAGUSD', 'Silver (XAG / USD)', 9),
  ('SPX500', 'S&P 500 (SPX)', 10),
  ('NAS100', 'NASDAQ-100 (NAS)', 11),
  ('GER40', 'DAX (GER)', 12),
  ('UK100', 'FTSE 100 (UK)', 13),
  ('JPN225', 'Nikkei 225 (JPN)', 14)
on conflict (symbol) do nothing;

-- Done!
-- ============================================================================
-- Verification:
-- Run these queries to verify tables were created:
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT * FROM public.instruments LIMIT 5;
