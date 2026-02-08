-- 025_progress_map.sql
-- Sprint UPDATE_10: TraderMap Progress Map (ecosystem + levels + thresholds)

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLE: progress_ecosystem_config
-- ============================================================================
create table if not exists public.progress_ecosystem_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  core_account_id uuid null references public.accounts(id) on delete set null,
  satellite_account_ids jsonb not null default '[]'::jsonb,
  applied_at timestamptz not null default now(),
  version_int int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint progress_ecosystem_config_version_check check (version_int >= 1)
);

create unique index if not exists progress_ecosystem_config_user_uq
  on public.progress_ecosystem_config(user_id);

create trigger progress_ecosystem_config_updated_at
  before update on public.progress_ecosystem_config
  for each row
  execute function public.set_updated_at();

alter table public.progress_ecosystem_config enable row level security;

create policy progress_ecosystem_config_select
  on public.progress_ecosystem_config for select
  using (auth.uid() = user_id);

create policy progress_ecosystem_config_insert
  on public.progress_ecosystem_config for insert
  with check (auth.uid() = user_id);

create policy progress_ecosystem_config_update
  on public.progress_ecosystem_config for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy progress_ecosystem_config_delete
  on public.progress_ecosystem_config for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: progress_ecosystem_versions
-- ============================================================================
create table if not exists public.progress_ecosystem_versions (
  id uuid primary key default gen_random_uuid(),
  config_id uuid not null references public.progress_ecosystem_config(id) on delete cascade,
  version_int int not null,
  snapshot_json jsonb not null,
  created_at timestamptz not null default now(),

  constraint progress_ecosystem_versions_version_check check (version_int >= 1)
);

create unique index if not exists progress_ecosystem_versions_uq
  on public.progress_ecosystem_versions(config_id, version_int);

alter table public.progress_ecosystem_versions enable row level security;

create policy progress_ecosystem_versions_select
  on public.progress_ecosystem_versions for select
  using (
    exists (
      select 1 from public.progress_ecosystem_config cfg
      where cfg.id = config_id and cfg.user_id = auth.uid()
    )
  );

create policy progress_ecosystem_versions_insert
  on public.progress_ecosystem_versions for insert
  with check (
    exists (
      select 1 from public.progress_ecosystem_config cfg
      where cfg.id = config_id and cfg.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TABLE: progress_map_state
-- ============================================================================
create table if not exists public.progress_map_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config_version_int int not null,
  current_level int not null default 1,
  xp_total int not null default 0,
  map_heat_state text null,
  fail_safe_active boolean not null default false,
  rebuild_active boolean not null default false,
  updated_at timestamptz not null default now(),

  constraint progress_map_state_level_check check (current_level >= 1 and current_level <= 15),
  constraint progress_map_state_xp_check check (xp_total >= 0)
);

create trigger progress_map_state_updated_at
  before update on public.progress_map_state
  for each row
  execute function public.set_updated_at();

alter table public.progress_map_state enable row level security;

create policy progress_map_state_select
  on public.progress_map_state for select
  using (auth.uid() = user_id);

create policy progress_map_state_insert
  on public.progress_map_state for insert
  with check (auth.uid() = user_id);

create policy progress_map_state_update
  on public.progress_map_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- TABLE: progress_level_state
-- ============================================================================
create table if not exists public.progress_level_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  config_version_int int not null,
  level int not null,
  status text not null default 'locked',
  progress_pct numeric(5,2) not null default 0,
  milestones_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),

  constraint progress_level_state_level_check check (level >= 1 and level <= 15),
  constraint progress_level_state_status_check check (status in ('locked', 'active', 'completed', 'fail_safe', 'rebuild')),
  constraint progress_level_state_progress_check check (progress_pct >= 0 and progress_pct <= 100)
);

create unique index if not exists progress_level_state_uq
  on public.progress_level_state(user_id, config_version_int, level);

create trigger progress_level_state_updated_at
  before update on public.progress_level_state
  for each row
  execute function public.set_updated_at();

alter table public.progress_level_state enable row level security;

create policy progress_level_state_select
  on public.progress_level_state for select
  using (auth.uid() = user_id);

create policy progress_level_state_insert
  on public.progress_level_state for insert
  with check (auth.uid() = user_id);

create policy progress_level_state_update
  on public.progress_level_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- TABLE: progress_map_thresholds (no defaults)
-- ============================================================================
create table if not exists public.progress_map_thresholds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value_numeric numeric null,
  value_json jsonb null,
  updated_at timestamptz not null default now()
);

create unique index if not exists progress_map_thresholds_uq
  on public.progress_map_thresholds(user_id, key);

create trigger progress_map_thresholds_updated_at
  before update on public.progress_map_thresholds
  for each row
  execute function public.set_updated_at();

alter table public.progress_map_thresholds enable row level security;

create policy progress_map_thresholds_select
  on public.progress_map_thresholds for select
  using (auth.uid() = user_id);

create policy progress_map_thresholds_insert
  on public.progress_map_thresholds for insert
  with check (auth.uid() = user_id);

create policy progress_map_thresholds_update
  on public.progress_map_thresholds for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy progress_map_thresholds_delete
  on public.progress_map_thresholds for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- TABLE: progress_pending_sync
-- ============================================================================
create table if not exists public.progress_pending_sync (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid null,
  reason text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists progress_pending_sync_user_idx
  on public.progress_pending_sync(user_id, resolved_at);

alter table public.progress_pending_sync enable row level security;

create policy progress_pending_sync_select
  on public.progress_pending_sync for select
  using (auth.uid() = user_id);

create policy progress_pending_sync_insert
  on public.progress_pending_sync for insert
  with check (auth.uid() = user_id);

create policy progress_pending_sync_update
  on public.progress_pending_sync for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- TABLE: progress_map_levels (declarative definitions)
-- ============================================================================
create table if not exists public.progress_map_levels (
  level int primary key,
  title text not null,
  subtitle text null,
  is_boss boolean not null default false,
  missions_json jsonb not null,
  rewards_json jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger progress_map_levels_updated_at
  before update on public.progress_map_levels
  for each row
  execute function public.set_updated_at();

alter table public.progress_map_levels enable row level security;

create policy progress_map_levels_select
  on public.progress_map_levels for select
  using (auth.role() = 'authenticated');

-- ============================================================================
-- Extend progress_events for Progress Map
-- ============================================================================
alter table public.progress_events
  add column if not exists config_version_int int,
  add column if not exists payload_json jsonb;

alter table public.progress_events
  drop constraint if exists progress_events_event_type_check;

alter table public.progress_events
  add constraint progress_events_event_type_check
  check (event_type in (
    'trade',
    'evidence',
    'report',
    'goal_complete',
    'manual',
    'progress_recompute',
    'progress_milestone',
    'progress_level_complete',
    'progress_fail_safe',
    'progress_rebuild'
  ));

-- ============================================================================
-- Seed levels (15 levels, boss 3/6/9/12/15)
-- ============================================================================
insert into public.progress_map_levels (level, title, subtitle, is_boss, missions_json, rewards_json)
values
  (1, 'Core online', 'L1 tutorial', false,
   '[
      {"id":"l1_core_trades","label":"Primeros trades cerrados","metric":"closed_trades","threshold_key":"l1_closed_trades_min","operator":">="},
      {"id":"l1_consistency","label":"Consistencia base","metric":"consistency_score","threshold_key":"l1_consistency_min","operator":">="}
    ]'::jsonb,
   '{"reward":"signal_boost"}'::jsonb),
  (2, 'Satellite bootcamp', 'L2 satellites', false,
   '[
      {"id":"l2_satellite_trades","label":"Trades en satelites","metric":"satellite_trades","threshold_key":"l2_satellite_trades_min","operator":">="},
      {"id":"l2_winrate","label":"Winrate minimo","metric":"winrate","threshold_key":"l2_winrate_min","operator":">="}
    ]'::jsonb,
   '{"reward":"radar_map"}'::jsonb),
  (3, 'Integrity gate', 'Boss #1', true,
   '[
      {"id":"l3_integrity","label":"Integridad de datos","metric":"integrity_score","threshold_key":"l3_integrity_min","operator":">="},
      {"id":"l3_confidence","label":"Confidence gate","metric":"confidence_score","threshold_key":"l3_confidence_min","operator":">="}
    ]'::jsonb,
   '{"reward":"boss_pass_1"}'::jsonb),
  (4, 'Momentum weave', 'Nivel 4', false,
   '[
      {"id":"l4_trades","label":"Volumen sostenido","metric":"closed_trades","threshold_key":"l4_closed_trades_min","operator":">="},
      {"id":"l4_edge","label":"Edge consistency","metric":"consistency_score","threshold_key":"l4_consistency_min","operator":">="}
    ]'::jsonb,
   '{"reward":"tempo_buff"}'::jsonb),
  (5, 'Drawdown discipline', 'Nivel 5', false,
   '[
      {"id":"l5_drawdown","label":"Drawdown control","metric":"drawdown_score","threshold_key":"l5_drawdown_min","operator":">="},
      {"id":"l5_winrate","label":"Winrate estable","metric":"winrate","threshold_key":"l5_winrate_min","operator":">="}
    ]'::jsonb,
   '{"reward":"shield"}'::jsonb),
  (6, 'Flow checkpoint', 'Boss #2', true,
   '[
      {"id":"l6_flow","label":"Flow score","metric":"flow_score","threshold_key":"l6_flow_min","operator":">="},
      {"id":"l6_confidence","label":"Confidence gate","metric":"confidence_score","threshold_key":"l6_confidence_min","operator":">="}
    ]'::jsonb,
   '{"reward":"boss_pass_2"}'::jsonb),
  (7, 'Precision ladder', 'Nivel 7', false,
   '[
      {"id":"l7_accuracy","label":"Precision","metric":"precision_score","threshold_key":"l7_precision_min","operator":">="},
      {"id":"l7_trades","label":"Cadencia","metric":"closed_trades","threshold_key":"l7_closed_trades_min","operator":">="}
    ]'::jsonb,
   '{"reward":"precision_badge"}'::jsonb),
  (8, 'Streak intelligence', 'Nivel 8', false,
   '[
      {"id":"l8_streak","label":"Racha saludable","metric":"streak_days","threshold_key":"l8_streak_min","operator":">="},
      {"id":"l8_consistency","label":"Consistencia","metric":"consistency_score","threshold_key":"l8_consistency_min","operator":">="}
    ]'::jsonb,
   '{"reward":"streak_charm"}'::jsonb),
  (9, 'Resilience boss', 'Boss #3', true,
   '[
      {"id":"l9_resilience","label":"Resiliencia","metric":"resilience_score","threshold_key":"l9_resilience_min","operator":">="},
      {"id":"l9_confidence","label":"Confidence gate","metric":"confidence_score","threshold_key":"l9_confidence_min","operator":">="}
    ]'::jsonb,
   '{"reward":"boss_pass_3"}'::jsonb),
  (10, 'Capital glide', 'Nivel 10', false,
   '[
      {"id":"l10_capital","label":"Capital lift","metric":"capital_score","threshold_key":"l10_capital_min","operator":">="},
      {"id":"l10_winrate","label":"Winrate","metric":"winrate","threshold_key":"l10_winrate_min","operator":">="}
    ]'::jsonb,
   '{"reward":"glide_badge"}'::jsonb),
  (11, 'Discipline climb', 'Nivel 11', false,
   '[
      {"id":"l11_discipline","label":"Disciplina","metric":"discipline_score","threshold_key":"l11_discipline_min","operator":">="},
      {"id":"l11_consistency","label":"Consistencia","metric":"consistency_score","threshold_key":"l11_consistency_min","operator":">="}
    ]'::jsonb,
   '{"reward":"discipline_badge"}'::jsonb),
  (12, 'Mastery gate', 'Boss #4', true,
   '[
      {"id":"l12_mastery","label":"Mastery","metric":"mastery_score","threshold_key":"l12_mastery_min","operator":">="},
      {"id":"l12_confidence","label":"Confidence gate","metric":"confidence_score","threshold_key":"l12_confidence_min","operator":">="}
    ]'::jsonb,
   '{"reward":"boss_pass_4"}'::jsonb),
  (13, 'Legend stretch', 'Nivel 13', false,
   '[
      {"id":"l13_edge","label":"Edge fuerte","metric":"consistency_score","threshold_key":"l13_consistency_min","operator":">="},
      {"id":"l13_trades","label":"Cadencia alta","metric":"closed_trades","threshold_key":"l13_closed_trades_min","operator":">="}
    ]'::jsonb,
   '{"reward":"legend_mark"}'::jsonb),
  (14, 'Elite sustain', 'Nivel 14', false,
   '[
      {"id":"l14_sustain","label":"Sustain","metric":"sustain_score","threshold_key":"l14_sustain_min","operator":">="},
      {"id":"l14_winrate","label":"Winrate elite","metric":"winrate","threshold_key":"l14_winrate_min","operator":">="}
    ]'::jsonb,
   '{"reward":"elite_emblem"}'::jsonb),
  (15, 'Endgame validation', 'Boss #5', true,
   '[
      {"id":"l15_validation","label":"Validacion final","metric":"validation_score","threshold_key":"l15_validation_min","operator":">="},
      {"id":"l15_confidence","label":"Confidence gate","metric":"confidence_score","threshold_key":"l15_confidence_min","operator":">="}
    ]'::jsonb,
   '{"reward":"boss_pass_5"}'::jsonb)
on conflict (level) do nothing;
