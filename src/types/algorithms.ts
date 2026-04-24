// ─── Algorithm types ─────────────────────────────────────────────────────────

export type AlgoPlatform = "MT4" | "MT5";
export type AlgoType     = "scalping" | "grid_basket" | "arbitrage";
export type AlgoStatus   = "draft" | "paper" | "approved" | "live" | "paused" | "archived";

// ─── Parameter shapes by type ─────────────────────────────────────────────────

export interface ScalpingParams {
  timeframe:           "M1" | "M5" | "M15" | "M30";
  sl_points:           number;  // 10–300
  tp_points:           number;  // 10–600
  max_positions:       number;  // 1–10
  max_spread:          number;  // 0–100 (filter above this)
  sessions:            ("LONDON" | "NY" | "OVERLAP")[];
  momentum_threshold:  number;  // 0.1–1.0
  lot_size:            number;  // 0.01–10
  max_lot_size:        number;
  use_trailing_stop:   boolean;
  trailing_distance:   number;  // points
  min_vol_threshold:   number;  // ATR/price ratio 0.001–0.05
}

export interface GridBasketParams {
  grid_step_points:    number;  // 50–1000
  max_basket_size:     number;  // 2–20
  initial_lot:         number;  // 0.01–2
  lot_multiplier:      number;  // 1.0–3.0
  basket_tp_points:    number;  // 100–5000
  circuit_breaker_pct: number;  // 1–25 (%)
  max_spread:          number;
  sessions:            ("LONDON" | "NY" | "OVERLAP")[];
  direction:           "BUY_ONLY" | "SELL_ONLY" | "BOTH";
  timeframe:           "M1" | "M5" | "M15";
  use_martingale:      boolean;
}

export interface ArbitrageParams {
  instrument_a:        string;  // e.g. XAUUSD
  instrument_b:        string;  // e.g. XAGUSD
  spread_threshold:    number;  // z-score threshold 0.5–5.0
  min_correlation:     number;  // 0.5–1.0
  max_exposure_lots:   number;  // 0.01–5
  lot_size:            number;
  exit_threshold:      number;  // z-score to close 0.1–2.0
  max_hold_minutes:    number;  // 1–1440
  sessions:            ("LONDON" | "NY" | "OVERLAP")[];
  hedge_ratio:         number;  // 0.1–5.0
}

export type AlgoParameters = ScalpingParams | GridBasketParams | ArbitrageParams;

// ─── DB row types ─────────────────────────────────────────────────────────────

export interface TradingAlgorithm {
  id:           string;
  user_id:      string;
  platform:     AlgoPlatform;
  name:         string;
  description:  string | null;
  algo_type:    AlgoType;
  status:       AlgoStatus;
  parameters:   AlgoParameters;
  slot_number:  number;
  sort_index:   number;
  created_at:   string;
  updated_at:   string;
  deleted_at:   string | null;
  // Joined
  deployments?: AlgorithmDeployment[];
  backtest?:    AlgorithmBacktestResult | null;
  paper_stats?: PaperStats | null;
}

export interface AlgorithmDeployment {
  id:             string;
  user_id:        string;
  algorithm_id:   string;
  bot_account_id: string;
  status:         "active" | "paused" | "stopped";
  deployed_at:    string;
  stopped_at:     string | null;
  notes:          string | null;
  created_at:     string;
  updated_at:     string;
  // Joined
  bot_accounts?:  { label: string; account_id: string } | null;
}

export interface AlgorithmBacktestResult {
  id:              string;
  algorithm_id:    string;
  platform:        AlgoPlatform;
  period_start:    string | null;
  period_end:      string | null;
  total_trades:    number | null;
  win_rate:        number | null;
  profit_factor:   number | null;
  max_drawdown:    number | null;
  net_profit:      number | null;
  sharpe_ratio:    number | null;
  recovery_factor: number | null;
  raw_data:        Record<string, unknown>;
  created_at:      string;
}

export interface PaperStats {
  total_trades:  number;
  win_rate:      number;
  total_pnl:     number;
  avg_pnl:       number;
}

// ─── API payloads ─────────────────────────────────────────────────────────────

export interface CreateAlgorithmPayload {
  platform:     AlgoPlatform;
  name:         string;
  description?: string;
  algo_type:    AlgoType;
  parameters:   AlgoParameters;
  slot_number:  number;
}

export interface UpdateAlgorithmPayload extends Partial<CreateAlgorithmPayload> {
  status?: AlgoStatus;
  sort_index?: number;
}

export interface DeployAlgorithmPayload {
  bot_account_ids: string[];
  notes?: string;
}

export interface ImportBacktestPayload {
  platform:        AlgoPlatform;
  period_start?:   string;
  period_end?:     string;
  total_trades?:   number;
  win_rate?:       number;
  profit_factor?:  number;
  max_drawdown?:   number;
  net_profit?:     number;
  sharpe_ratio?:   number;
  recovery_factor?: number;
  raw_data?:       Record<string, unknown>;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export const ALGO_TYPE_LABELS: Record<AlgoType, string> = {
  scalping:     "Scalping",
  grid_basket:  "Grid / Basket",
  arbitrage:    "Arbitraje",
};

export const ALGO_STATUS_LABELS: Record<AlgoStatus, string> = {
  draft:    "Borrador",
  paper:    "Paper Test",
  approved: "Aprobado",
  live:     "Live",
  paused:   "Pausado",
  archived: "Archivado",
};

export const ALGO_STATUS_COLORS: Record<AlgoStatus, string> = {
  draft:    "text-slate-400 bg-slate-800 border-slate-700",
  paper:    "text-yellow-400 bg-yellow-950 border-yellow-800",
  approved: "text-blue-400 bg-blue-950 border-blue-800",
  live:     "text-emerald-400 bg-emerald-950 border-emerald-800",
  paused:   "text-orange-400 bg-orange-950 border-orange-800",
  archived: "text-slate-600 bg-slate-900 border-slate-800",
};

export const ALGO_TYPE_COLORS: Record<AlgoType, string> = {
  scalping:    "text-violet-400 bg-violet-950 border-violet-800",
  grid_basket: "text-cyan-400 bg-cyan-950 border-cyan-800",
  arbitrage:   "text-amber-400 bg-amber-950 border-amber-800",
};

export const MAX_ALGORITHMS_PER_PLATFORM = 50;

export const DEFAULT_SCALPING_PARAMS: ScalpingParams = {
  timeframe: "M1", sl_points: 50, tp_points: 150, max_positions: 3,
  max_spread: 30, sessions: ["LONDON", "NY"], momentum_threshold: 0.6,
  lot_size: 0.01, max_lot_size: 1.0, use_trailing_stop: false,
  trailing_distance: 30, min_vol_threshold: 0.005,
};

export const DEFAULT_GRID_PARAMS: GridBasketParams = {
  grid_step_points: 200, max_basket_size: 8, initial_lot: 0.01,
  lot_multiplier: 1.5, basket_tp_points: 500, circuit_breaker_pct: 5,
  max_spread: 50, sessions: ["LONDON", "NY", "OVERLAP"],
  direction: "BOTH", timeframe: "M1", use_martingale: false,
};

export const DEFAULT_ARBITRAGE_PARAMS: ArbitrageParams = {
  instrument_a: "XAUUSD", instrument_b: "XAGUSD", spread_threshold: 2.0,
  min_correlation: 0.8, max_exposure_lots: 0.5, lot_size: 0.01,
  exit_threshold: 0.5, max_hold_minutes: 60,
  sessions: ["LONDON", "NY"], hedge_ratio: 1.0,
};
