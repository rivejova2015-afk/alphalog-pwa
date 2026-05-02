// Universal Tier-1 Quality Gates — shared types

export type GateCategory = 'edge' | 'capital' | 'micro' | 'ops';
export type GateSeverity = 'must' | 'should';
export type GateThresholdOp = '>=' | '<=' | '<' | '>' | '==';

export interface GateDefinition {
  gate_key:        string;
  name:            string;
  category:        GateCategory;
  severity:        GateSeverity;
  threshold_op:    GateThresholdOp;
  threshold_value: number;
  unit:            string | null;
  description:     string;
  source_field:    string;
  sort_index:      number;
  is_active:       boolean;
}

export interface GateResult {
  gate_key:        string;
  passed:          boolean;
  value_observed:  number | null;
  reason:          string | null;
}

export interface GateRow extends GateResult {
  id?:             string;
  algorithm_id:    string;
  user_id:         string;
  computed_at?:    string;
}

export interface GateScore {
  algorithm_id:     string;
  gates_total:      number;
  gates_passed:     number;
  must_failed:      number;
  should_failed:    number;
  last_computed_at: string | null;
  tier:             'TIER_1' | 'TIER_2' | 'NOT_READY';
}

// ─── Context que reciben los checks ───────────────────────────────────────

export interface AlgorithmRow {
  id:                    string;
  user_id:               string;
  name:                  string;
  status:                string;
  risk_percent:          number | null;
  max_drawdown_pct:      number | null;
  linked_bot_account_id: string | null;
  parameters:            Record<string, unknown>;
  scan_config:           Record<string, unknown> | null;
}

export interface BacktestSnapshot {
  job_id:         string;
  config:         Record<string, unknown>;
  metrics:        Record<string, unknown>;
  walk_forward:   Record<string, unknown> | null;
  stress_tests:   Record<string, unknown> | null;
  created_at:     string;
}

export interface TelemetrySnapshot {
  last_heartbeat_ts:    string | null;
  execution_latency_p99_ms: number | null;
}

export interface OpsSnapshot {
  last_kill_ack_ms:     number | null;
  paper_trades_30d:     number;
  audit_trail_complete: boolean;
}

export interface CheckContext {
  algorithm:    AlgorithmRow;
  backtest:     BacktestSnapshot | null;
  telemetry:    TelemetrySnapshot;
  ops:          OpsSnapshot;
}

export type CheckFn = (ctx: CheckContext) => GateResult;
