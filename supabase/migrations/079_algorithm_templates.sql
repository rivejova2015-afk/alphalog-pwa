-- Migration 079: algorithm_templates
-- Sistema de plantillas de EA preconfigurados, seleccionables desde NewStrategyWizard.
-- Seed inicial: GoldRangeBasketR (MQL5, MT5, XAUUSD).
-- Crea también un bot + bot_account placeholder por usuario existente para
-- vincular la primera estrategia creada desde el template.

BEGIN;

-- =========================
-- TABLE: algorithm_templates
-- =========================
CREATE TABLE IF NOT EXISTS public.algorithm_templates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key         TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  description          TEXT,
  market_type          TEXT NOT NULL CHECK (market_type IN ('forex', 'futures', 'options')),
  algo_type            TEXT NOT NULL CHECK (algo_type IN ('scalping', 'grid_basket', 'arbitrage')),
  default_instrument   TEXT NOT NULL,
  default_direction    TEXT NOT NULL DEFAULT 'both' CHECK (default_direction IN ('long', 'short', 'both')),
  default_lot_size     NUMERIC(10,4) NOT NULL DEFAULT 0.01,
  default_max_trades   INTEGER NOT NULL DEFAULT 5,
  default_risk_percent NUMERIC(5,2) NOT NULL DEFAULT 1.0,
  parameters           JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_path          TEXT,
  magic_number         INTEGER,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  sort_index           INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS algorithm_templates_market_active_idx
  ON public.algorithm_templates(market_type, is_active, sort_index)
  WHERE is_active = true;

ALTER TABLE public.algorithm_templates ENABLE ROW LEVEL SECURITY;

-- Templates son globales (no por user). Cualquier autenticado puede leerlos.
CREATE POLICY algorithm_templates_select_all ON public.algorithm_templates
  FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE solo service_role (gestión vía migrations).

DROP TRIGGER IF EXISTS algorithm_templates_set_updated_at ON public.algorithm_templates;
CREATE TRIGGER algorithm_templates_set_updated_at
  BEFORE UPDATE ON public.algorithm_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- SEED: GoldRangeBasketR
-- =========================
-- Inputs MQL5 extraídos de bots/GoldRangeBasketR/MQL5/Experts/GoldRangeBasketR/GoldRangeBasketR.mq5:13-51
-- + basket R tiers hardcodeados en el EA (lines ~129-131).
INSERT INTO public.algorithm_templates (
  template_key, name, description,
  market_type, algo_type,
  default_instrument, default_direction,
  default_lot_size, default_max_trades, default_risk_percent,
  magic_number, source_path, sort_index, parameters
) VALUES (
  'goldrangebasketr',
  'GoldRangeBasketR',
  'EA MT5 Smart Money Concepts (SMC) sobre XAUUSD: detecta sweep de pools (SessionHigh/Low, PDH/PDL, Weekly High/Low) + Break of Structure, entra en Order Block o Fair Value Gap fresca, gestiona basket por tiers de R (30%@1.0R, 30%@1.5R, 30%@2.0R, 10%@2.5R) y cierra todo si el precio cruza SessionMid. Sesiones Asia/NY con 45min de warmup y daily target lock opcional.',
  'forex', 'grid_basket',
  'XAUUSD', 'both',
  0.01, 50, 1.0,
  250206,
  'bots/GoldRangeBasketR/MQL5/Experts/GoldRangeBasketR/GoldRangeBasketR.mq5',
  0,
  jsonb_build_object(
    'lots_fixed',              0.01,
    'max_positions_total',     50,
    'max_entries_per_bar',     15,
    'atr_period',              14,
    'atr_k',                   1.0,
    'asia_prime_start_gmt',    '00:30',
    'asia_prime_end_gmt',      '03:30',
    'ny_prime_start_gmt',      '13:30',
    'ny_prime_end_gmt',        '17:00',
    'warmup_minutes',          45,
    'range_gate_enabled',      false,
    'range_gate_min_points',   0,
    'range_gate_max_points',   0,
    'range_gate_mode',         'RANGE_POINTS',
    'range_gate_min_atr',      0.0,
    'range_gate_max_atr',      0.0,
    'order_flow_enabled',      false,
    'news_enabled',            false,
    'news_lot_multiplier',     0.70,
    'decision_engine_enabled', false,
    'decision_score_min',      60,
    'decision_base_start',     60,
    'sweep_lookback_bars',     10,
    'max_retest',              1,
    'ob_buffer_points',        50,
    'eq_tolerance_points',     20,
    'target_enabled',          false,
    'target_pct',              1.0,
    'magic_number',            250206,
    'trade_symbol',            'XAUUSD',
    'remote_enabled',          true,
    'poll_interval_seconds',   10,
    'analysis_timeframe',      'M1',
    'bias_timeframe',          'H1',
    'bias_indicators',         jsonb_build_array('EMA50_H1', 'EMA200_H1'),
    'basket_r_tiers',          jsonb_build_array(
      jsonb_build_object('r', 1.0, 'close_pct', 30),
      jsonb_build_object('r', 1.5, 'close_pct', 30),
      jsonb_build_object('r', 2.0, 'close_pct', 30),
      jsonb_build_object('r', 2.5, 'close_pct', 10)
    ),
    'kill_on_session_mid_cross', true,
    'entry_order_type',        'MARKET',
    'sl_logic',                'zone_low_minus_ob_buffer (BUY) / zone_high_plus_ob_buffer (SELL)'
  )
)
ON CONFLICT (template_key) DO NOTHING;

-- =========================
-- BOT + BOT_ACCOUNT placeholder (idempotente)
-- =========================
-- Crea para cada usuario existente una entrada bots('GoldRangeBasketR') y un
-- bot_accounts placeholder (account_id='PENDING-GOLDRANGE') que el wizard
-- puede usar como linked_bot_account_id por defecto. El user lo reemplaza
-- después por una cuenta MT5 real desde el wizard inline.
DO $$
DECLARE
  u_id UUID;
  bot_uuid UUID;
BEGIN
  FOR u_id IN SELECT id FROM auth.users LOOP
    -- Crear bot si no existe
    SELECT id INTO bot_uuid
      FROM public.bots
      WHERE user_id = u_id AND name = 'GoldRangeBasketR'
      LIMIT 1;

    IF bot_uuid IS NULL THEN
      INSERT INTO public.bots (user_id, name)
        VALUES (u_id, 'GoldRangeBasketR')
        RETURNING id INTO bot_uuid;
    END IF;

    -- Crear bot_account placeholder si no existe (unique por user_id+account_id)
    INSERT INTO public.bot_accounts (user_id, bot_id, account_id, label)
      VALUES (
        u_id,
        bot_uuid,
        'PENDING-GOLDRANGE',
        'GoldRangeBasketR — pendiente vinculación MT5'
      )
      ON CONFLICT (user_id, account_id) DO NOTHING;
  END LOOP;
END $$;

COMMIT;
