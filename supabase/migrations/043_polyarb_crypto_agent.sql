-- Migration 043: PolyArb Crypto Latency Agent
-- Autonomous trading agent for Polymarket crypto milestone markets
-- Tables: agents, positions, trades, telemetry, circuit_breaker_events, compliance_audit

-- ─── polyarb_agents ──────────────────────────────────────────────────────────
CREATE TABLE public.polyarb_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'PolyArb-v1',
  status text NOT NULL DEFAULT 'STOPPED'
    CHECK (status IN ('RUNNING','STOPPED','PAUSED','ERROR')),
  wallet_address text,
  api_key_encrypted text,
  api_secret_encrypted text,
  api_passphrase_encrypted text,
  config jsonb NOT NULL DEFAULT '{
    "loop_interval_ms": 250,
    "min_edge_percent": 0.005,
    "max_kelly_fraction": 0.50,
    "max_leverage": 3.0,
    "daily_drawdown_limit": -0.35,
    "hourly_drawdown_limit": -0.20,
    "consecutive_loss_limit": 7,
    "max_slippage": 0.015,
    "max_latency_ms": 100,
    "min_risk_reward": 1.2,
    "win_streak_bonus": 1.5,
    "price_history_window_ms": 60000,
    "acceleration_threshold": 0.00005,
    "jerk_reversal_threshold": -0.0001
  }'::jsonb,
  starting_capital_usd numeric(18,6) DEFAULT 50.0,
  fly_instance_id text,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX idx_polyarb_agents_user
  ON polyarb_agents(user_id) WHERE deleted_at IS NULL;

ALTER TABLE polyarb_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select" ON polyarb_agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON polyarb_agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update" ON polyarb_agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner_delete" ON polyarb_agents FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_polyarb_agents_updated_at
  BEFORE UPDATE ON polyarb_agents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── polyarb_positions ───────────────────────────────────────────────────────
CREATE TABLE public.polyarb_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES polyarb_agents(id) ON DELETE CASCADE,
  market_slug text NOT NULL,
  market_question text,
  condition_id text,
  outcome text NOT NULL CHECK (outcome IN ('YES','NO')),
  side text NOT NULL CHECK (side IN ('BUY','SELL')),
  status text NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','CLOSED','LIQUIDATED')),
  entry_price numeric(18,8),
  exit_price numeric(18,8),
  size_usd numeric(18,6),
  shares numeric(18,8),
  pnl_usd numeric(18,6),
  pnl_percent numeric(8,4),
  leverage_used numeric(4,2) NOT NULL DEFAULT 1.0,
  entry_reason jsonb,
  exit_reason text CHECK (exit_reason IS NULL OR exit_reason IN (
    'take_profit','stop_loss','timeout','circuit_breaker','manual','slippage'
  )),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_polyarb_positions_agent_status
  ON polyarb_positions(agent_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_polyarb_positions_user
  ON polyarb_positions(user_id, created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE polyarb_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select" ON polyarb_positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON polyarb_positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update" ON polyarb_positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner_delete" ON polyarb_positions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_polyarb_positions_updated_at
  BEFORE UPDATE ON polyarb_positions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── polyarb_trades ──────────────────────────────────────────────────────────
CREATE TABLE public.polyarb_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES polyarb_agents(id) ON DELETE CASCADE,
  position_id uuid REFERENCES polyarb_positions(id) ON DELETE SET NULL,
  order_id text,
  side text NOT NULL CHECK (side IN ('BUY','SELL')),
  price numeric(18,8) NOT NULL,
  size numeric(18,8) NOT NULL,
  fee_usd numeric(18,6) DEFAULT 0,
  fee_rate_bps integer DEFAULT 156,
  slippage_bps numeric(8,2),
  execution_latency_ms integer,
  status text NOT NULL DEFAULT 'FILLED'
    CHECK (status IN ('FILLED','PARTIAL','REJECTED','CANCELLED')),
  order_signature text,
  raw_response jsonb,
  executed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_polyarb_trades_position
  ON polyarb_trades(position_id, executed_at);
CREATE INDEX idx_polyarb_trades_agent
  ON polyarb_trades(agent_id, created_at DESC);

ALTER TABLE polyarb_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select" ON polyarb_trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON polyarb_trades FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── polyarb_telemetry ───────────────────────────────────────────────────────
CREATE TABLE public.polyarb_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES polyarb_agents(id) ON DELETE CASCADE,
  equity_usd numeric(18,6),
  available_balance_usd numeric(18,6),
  open_positions_count integer DEFAULT 0,
  total_pnl_usd numeric(18,6) DEFAULT 0,
  win_rate numeric(5,2),
  profit_factor numeric(6,2),
  sharpe_ratio numeric(6,3),
  max_drawdown_pct numeric(6,3),
  loop_latency_ms integer,
  ws_binance_connected boolean DEFAULT false,
  ws_polymarket_connected boolean DEFAULT false,
  btc_spot_price numeric(18,2),
  consecutive_wins integer DEFAULT 0,
  consecutive_losses integer DEFAULT 0,
  last_signal jsonb,
  error_count_1h integer DEFAULT 0,
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_polyarb_telemetry_agent
  ON polyarb_telemetry(agent_id);

ALTER TABLE polyarb_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select" ON polyarb_telemetry FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON polyarb_telemetry FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner_update" ON polyarb_telemetry FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER set_polyarb_telemetry_updated_at
  BEFORE UPDATE ON polyarb_telemetry
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enable Supabase Realtime for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE polyarb_telemetry;

-- ─── polyarb_circuit_breaker_events ──────────────────────────────────────────
-- Immutable audit log — no updated_at, no deleted_at
CREATE TABLE public.polyarb_circuit_breaker_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES polyarb_agents(id) ON DELETE CASCADE,
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'MAX_DAILY_DRAWDOWN','MAX_HOURLY_DRAWDOWN','CONSECUTIVE_LOSSES',
    'LATENCY_OVERRUN','SLIPPAGE_EXCEEDED','WS_DISCONNECT',
    'MANUAL_KILL','ERROR_RATE','HEARTBEAT_STALE'
  )),
  severity text NOT NULL CHECK (severity IN ('S1','S2','S3')),
  detail text,
  equity_at_trigger numeric(18,6),
  action_taken text NOT NULL CHECK (action_taken IN ('PAUSE','STOP','CLOSE_ALL','WARN')),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_polyarb_cb_events_agent
  ON polyarb_circuit_breaker_events(agent_id, created_at DESC);

ALTER TABLE polyarb_circuit_breaker_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select" ON polyarb_circuit_breaker_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON polyarb_circuit_breaker_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── polyarb_compliance_audit ────────────────────────────────────────────────
-- CFTC-ready immutable audit trail
CREATE TABLE public.polyarb_compliance_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES polyarb_agents(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'TRADE_ENTRY','TRADE_EXIT','CONFIG_CHANGE','CIRCUIT_BREAKER',
    'AGENT_START','AGENT_STOP','AGENT_PAUSE','AGENT_RESUME',
    'POSITION_LIQUIDATED','WALLET_FUNDED'
  )),
  entity_id uuid,
  entity_table text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_polyarb_compliance_agent
  ON polyarb_compliance_audit(agent_id, created_at DESC);

ALTER TABLE polyarb_compliance_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select" ON polyarb_compliance_audit FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON polyarb_compliance_audit FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ─── Equity history for chart (separate from upserted telemetry) ─────────────
CREATE TABLE public.polyarb_equity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES polyarb_agents(id) ON DELETE CASCADE,
  equity_usd numeric(18,6) NOT NULL,
  pnl_usd numeric(18,6) NOT NULL DEFAULT 0,
  open_positions integer NOT NULL DEFAULT 0,
  btc_price numeric(18,2),
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_polyarb_equity_agent_time
  ON polyarb_equity_snapshots(agent_id, snapshot_at DESC);

ALTER TABLE polyarb_equity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_select" ON polyarb_equity_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner_insert" ON polyarb_equity_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
