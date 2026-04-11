-- Migration 044: Agents and Algorithms tables for AlphaLog 2.1
-- Agents = autonomous trading bots (AI-driven, replaces bot-control concept in UI)
-- Algorithms = deterministic EA strategies linked to MT5 accounts

-- ─────────────────────────────────────────────
-- AGENTS
-- ─────────────────────────────────────────────
create table if not exists agents (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  type            text not null default 'trading',          -- 'trading' | 'analysis' | 'polyarb'
  status          text not null default 'stopped',          -- 'running' | 'stopped' | 'paused' | 'error'
  description     text,
  portfolio_usd   numeric(14,2) not null default 0,
  win_rate        numeric(5,2) not null default 0,          -- 0-100
  roi_percent     numeric(8,4) not null default 0,
  sharpe_ratio    numeric(6,4) not null default 0,
  drawdown_pct    numeric(5,2) not null default 0,          -- current drawdown %
  max_drawdown_pct numeric(5,2) not null default 0,
  total_ops       integer not null default 0,
  linked_account_id uuid references accounts(id) on delete set null,
  config          jsonb not null default '{}',
  sort_index      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Agent operations log
create table if not exists agent_operations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  agent_id        uuid not null references agents(id) on delete cascade,
  symbol          text not null,
  direction       text not null,                            -- 'BUY' | 'SELL'
  entry_price     numeric(14,5),
  exit_price      numeric(14,5),
  lots            numeric(10,4),
  pnl             numeric(14,2),
  status          text not null default 'open',             -- 'open' | 'closed'
  confidence      numeric(5,2),                            -- 0-100 AI confidence
  reasoning       text,
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- ALGORITHMS
-- ─────────────────────────────────────────────
create table if not exists algorithms (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  instrument      text not null default 'XAUUSD',
  status          text not null default 'stopped',          -- 'running' | 'stopped' | 'paused'
  pnl_today       numeric(14,2) not null default 0,
  pnl_total       numeric(14,2) not null default 0,
  win_rate        numeric(5,2) not null default 0,
  trade_count     integer not null default 0,
  profit_factor   numeric(8,4) not null default 0,
  drawdown_pct    numeric(5,2) not null default 0,
  max_drawdown_pct numeric(5,2) not null default 0,
  linked_bot_account_id uuid references bot_accounts(id) on delete set null,
  -- ControlPanel parameters
  lot_size        numeric(10,4) not null default 0.1,
  stop_loss_pips  integer not null default 20,
  take_profit_pips integer not null default 40,
  max_trades      integer not null default 5,
  risk_percent    numeric(5,2) not null default 1.0,
  sort_index      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- Algorithm trades log
create table if not exists algorithm_trades (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  algorithm_id    uuid not null references algorithms(id) on delete cascade,
  trade_number    integer,
  direction       text not null,                            -- 'BUY' | 'SELL'
  instrument      text not null,
  entry_price     numeric(14,5),
  exit_price      numeric(14,5),
  lots            numeric(10,4),
  duration_min    integer,
  pnl             numeric(14,2),
  status          text not null default 'open',             -- 'open' | 'closed'
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
alter table agents enable row level security;
alter table agent_operations enable row level security;
alter table algorithms enable row level security;
alter table algorithm_trades enable row level security;

-- agents
create policy "agents_select" on agents for select using (auth.uid() = user_id);
create policy "agents_insert" on agents for insert with check (auth.uid() = user_id);
create policy "agents_update" on agents for update using (auth.uid() = user_id);
create policy "agents_delete" on agents for delete using (auth.uid() = user_id);

-- agent_operations
create policy "agent_ops_select" on agent_operations for select using (auth.uid() = user_id);
create policy "agent_ops_insert" on agent_operations for insert with check (auth.uid() = user_id);
create policy "agent_ops_update" on agent_operations for update using (auth.uid() = user_id);
create policy "agent_ops_delete" on agent_operations for delete using (auth.uid() = user_id);

-- algorithms
create policy "algorithms_select" on algorithms for select using (auth.uid() = user_id);
create policy "algorithms_insert" on algorithms for insert with check (auth.uid() = user_id);
create policy "algorithms_update" on algorithms for update using (auth.uid() = user_id);
create policy "algorithms_delete" on algorithms for delete using (auth.uid() = user_id);

-- algorithm_trades
create policy "algo_trades_select" on algorithm_trades for select using (auth.uid() = user_id);
create policy "algo_trades_insert" on algorithm_trades for insert with check (auth.uid() = user_id);
create policy "algo_trades_update" on algorithm_trades for update using (auth.uid() = user_id);
create policy "algo_trades_delete" on algorithm_trades for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
create index if not exists agents_user_status_idx on agents(user_id, status) where deleted_at is null;
create index if not exists agent_ops_agent_idx on agent_operations(agent_id, opened_at desc);
create index if not exists algorithms_user_status_idx on algorithms(user_id, status) where deleted_at is null;
create index if not exists algo_trades_algo_idx on algorithm_trades(algorithm_id, opened_at desc);

-- ─────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger agents_updated_at before update on agents
  for each row execute function update_updated_at_column();

create trigger algorithms_updated_at before update on algorithms
  for each row execute function update_updated_at_column();
