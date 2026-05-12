-- 099_coinarb_as_algorithm.sql
-- =========================================================================
-- Bring coinarb into the canonical `algorithms` framework.
--
-- Fase A of the unification plan: schema bridge + read-only mirror.
-- - Extend `algorithms.market_type` to allow 'crypto' and `algorithms.platform`
--   to allow 'fly' so non-MT bots can live in the same registry.
-- - Create a `bot` + `bot_account` for coinarb so future commands/deployments
--   have a target.
-- - Insert one `algorithms` row mirroring `coinarb_agents.config` into
--   `engine_config`. Runtime still reads Fly secrets; this row is currently
--   cosmetic but becomes load-bearing in Fase B.
--
-- Idempotent: re-running is a no-op.
-- =========================================================================

BEGIN;

-- --------- 1) Extend CHECK constraints to admit crypto/fly ----------------
ALTER TABLE public.algorithms
  DROP CONSTRAINT IF EXISTS algorithms_market_type_check;
ALTER TABLE public.algorithms
  ADD CONSTRAINT algorithms_market_type_check
  CHECK (market_type = ANY (ARRAY['forex','futures','options','crypto']));

ALTER TABLE public.algorithms
  DROP CONSTRAINT IF EXISTS algorithms_platform_check;
ALTER TABLE public.algorithms
  ADD CONSTRAINT algorithms_platform_check
  CHECK (platform = ANY (ARRAY['MT4','MT5','fly']));

-- --------- 2) Create bot + bot_account for coinarb (idempotent) -----------
INSERT INTO public.bots (id, user_id, name)
VALUES (
  '11111111-c01a-4b00-9001-000000000001'::uuid,  -- deterministic bot id for coinarb-50x
  '304a1a34-36a9-4a75-ae52-3023409932f0',
  'coinarb-50x'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.bot_accounts (id, user_id, bot_id, account_id, label)
VALUES (
  '22222222-c01a-4b00-9002-000000000001'::uuid,  -- deterministic bot_account id
  '304a1a34-36a9-4a75-ae52-3023409932f0',
  '11111111-c01a-4b00-9001-000000000001'::uuid,
  'coinarb-50x',                                  -- text account_id (Fly app name)
  'Coinarb Fly singapore'
)
ON CONFLICT (id) DO NOTHING;

-- --------- 3) Insert the canonical algorithms row -------------------------
-- Use the existing COINARB_AGENT_ID so coinarb writers/readers keep working
-- without rewiring identifiers. engine_config mirrors coinarb_agents.config
-- (kind='coinarb'); parameters carries the tunable thresholds that Fase B
-- will start reading instead of Fly secrets.
INSERT INTO public.algorithms (
  id, user_id, name, instrument, status, market_type, direction, platform,
  linked_bot_account_id, lot_size, max_trades, risk_percent,
  parameters, engine_config
)
VALUES (
  'a667d400-065f-4415-9609-373c3749e5fd'::uuid,
  '304a1a34-36a9-4a75-ae52-3023409932f0',
  'Coinarb 50x',
  ARRAY['BTC-USD','ETH-USD','SOL-USD']::text[],
  'live',
  'crypto',
  'both',
  'fly',
  '22222222-c01a-4b00-9002-000000000001'::uuid,
  0, 100, 1,
  -- parameters: tunable thresholds (Fase B will start reading these)
  jsonb_build_object(
    'mtf_confidence_min',    0.30,
    'pd_macro_band',         0.005,
    'pd_micro_band',         0.005,
    'sweep_confirm_body_ratio', 0.40,
    'arb_gap_min',           jsonb_build_object(
      'BTC-USD', 0.00050,
      'ETH-USD', 0.00080,
      'SOL-USD', 0.00100
    )
  ),
  -- engine_config: full snapshot of what the bot is running (cosmetic in A,
  -- source-of-truth in B). kind discriminator lets EngineConfigSchema route.
  jsonb_build_object(
    'kind',                  'coinarb',
    'venue',                 'coinbase_spot',
    'tick_ms',               15000,
    'spot_pairs',            jsonb_build_array('BTC-USD','ETH-USD','SOL-USD'),
    'paper_mode_default',    false,
    'phases',                11,
    'starting_capital_usd',  100,
    'rr_min',                2,
    'mtf_weights',           jsonb_build_object(
      '1D','0.15','4H','0.15','1H','0.15','30M','0.15','15M','0.15','5M','0.15','1M','0.10'
    ),
    'pd_macro_days',         3,
    'daily_trade_cap_total', 100,
    'daily_trade_cap_per_symbol', 33,
    'consecutive_loss_limit', 6,
    'circuit_pause_ms',      10800000,
    'historical_ttl_h',      4,
    'historical_reload_strategy', 'background_after_first_load',
    'parallel_symbol_eval',  true
  )
)
ON CONFLICT (id) DO UPDATE SET
  -- Keep the row in sync on re-run, but never clobber pnl/trade aggregates.
  name           = EXCLUDED.name,
  instrument     = EXCLUDED.instrument,
  status         = EXCLUDED.status,
  market_type    = EXCLUDED.market_type,
  direction      = EXCLUDED.direction,
  platform       = EXCLUDED.platform,
  linked_bot_account_id = EXCLUDED.linked_bot_account_id,
  parameters     = EXCLUDED.parameters,
  engine_config  = EXCLUDED.engine_config,
  updated_at     = now();

COMMIT;
