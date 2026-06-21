-- Coinarb multi-strategy — Fase 1 (PR #33)
--
-- Adds `strategy_id` column to every coinarb table so a single bot instance
-- can attribute decisions, positions, trades, and telemetry to parallel
-- strategies (e.g. 'A' = current SMC pipeline, 'B' = aggressive variant).
--
-- This migration is BACKWARD-COMPATIBLE: default 'A' means all existing rows
-- are tagged as the conservative SMC strategy. No code change is required for
-- the bot to keep behaving as it does today. Subsequent PRs introduce the
-- StrategyRunner refactor and the actual second strategy.

-- ---------------------------------------------------------------------------
-- 1. Add strategy_id columns
-- ---------------------------------------------------------------------------

alter table coinarb_positions
  add column if not exists strategy_id text not null default 'A';

alter table coinarb_trades
  add column if not exists strategy_id text not null default 'A';

alter table coinarb_decisions
  add column if not exists strategy_id text not null default 'A';

alter table coinarb_telemetry
  add column if not exists strategy_id text not null default 'A';

alter table coinarb_daily_stats
  add column if not exists strategy_id text not null default 'A';

alter table coinarb_phase_log
  add column if not exists strategy_id text not null default 'A';

alter table coinarb_smc_signals
  add column if not exists strategy_id text not null default 'A';

-- ---------------------------------------------------------------------------
-- 2. Symbol-level mutex index — fast lookup for "is X-USD already open by any strategy?"
-- ---------------------------------------------------------------------------

create index if not exists idx_coinarb_positions_symbol_open
  on coinarb_positions (symbol)
  where status = 'OPEN';

-- ---------------------------------------------------------------------------
-- 3. UNIQUE constraints — telemetry and daily_stats now keyed by strategy too
-- ---------------------------------------------------------------------------

-- coinarb_telemetry: was (agent_id) UNIQUE → now (agent_id, strategy_id)
alter table coinarb_telemetry
  drop constraint if exists coinarb_telemetry_agent_id_key;

alter table coinarb_telemetry
  add constraint coinarb_telemetry_agent_strategy_key
  unique (agent_id, strategy_id);

-- coinarb_daily_stats: was (agent_id, day_utc) UNIQUE → now (agent_id, strategy_id, day_utc)
alter table coinarb_daily_stats
  drop constraint if exists coinarb_daily_stats_agent_id_day_utc_key;

alter table coinarb_daily_stats
  add constraint coinarb_daily_stats_agent_strategy_day_key
  unique (agent_id, strategy_id, day_utc);

-- ---------------------------------------------------------------------------
-- 4. bot_commands target_strategy — allows pause/resume/update_parameters per strategy
-- ---------------------------------------------------------------------------

alter table bot_commands
  add column if not exists target_strategy text not null default 'all';

-- Optional check: known scopes only. 'all' applies to every strategy of the bot.
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'bot_commands' and constraint_name = 'bot_commands_target_strategy_check'
  ) then
    alter table bot_commands
      add constraint bot_commands_target_strategy_check
      check (target_strategy in ('all', 'A', 'B'));
  end if;
end $$;
