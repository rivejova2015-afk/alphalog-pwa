export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1' | 'MN1';

export interface Bar {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  spread?: number | null;
}

export type Side = 'long' | 'short';
export type Direction = 'long' | 'short' | 'both';

export interface SimulatedTrade {
  id: number;
  side: Side;
  entryTs: string;
  entryPrice: number;
  exitTs: string;
  exitPrice: number;
  lots: number;
  slPrice: number | null;
  tpPrice: number | null;
  pnl: number;
  pnlPct: number;
  bars: number;
  exitReason: 'tp' | 'sl' | 'signal' | 'eod' | 'margin';
}

export interface EquityPoint {
  ts: string;
  equity: number;
  drawdown: number;
}

export interface BacktestConfig {
  algorithmId?: string;
  symbol: string;
  timeframe: Timeframe;
  from: string;
  to: string;
  initialBalance: number;
  contractSize: number;          // 100 for XAUUSD, 100000 for forex majors
  pointValue: number;            // dollars per pip × lot
  spreadPoints: number;
  commissionPerLot: number;
  slippagePoints: number;
  direction: Direction;
  parameters: Record<string, unknown>;
  rules: AlgorithmRules;
  monteCarloIterations?: number;
  walkForwardWindows?: number;
  stressTests?: boolean;
  // Optional advanced execution model. When unset, the engine falls back to
  // the simple `slippagePoints` linear cost.
  slippageMode?: 'fixed' | 'vwap' | 'time_decay' | 'almgren';
  slippageParams?: {
    fixedPoints?: number;
    participation?: number;
    permanentImpactCoef?: number;
    temporaryImpactCoef?: number;
  };
}

export type Operator = '>' | '<' | '>=' | '<=' | '==' | 'cross_above' | 'cross_below';

export interface IndicatorRef {
  type: 'sma' | 'ema' | 'rsi' | 'atr' | 'bb_upper' | 'bb_lower' | 'macd' | 'price';
  period?: number;
  field?: 'open' | 'high' | 'low' | 'close';
  shift?: number;
}

export interface Condition {
  left: IndicatorRef | number;
  op: Operator;
  right: IndicatorRef | number;
}

export interface SizingRule {
  mode: 'fixed_lot' | 'risk_pct' | 'kelly';
  value: number;       // lots, % risk, or kelly fraction
  riskPerTradePct?: number;
}

export interface AlgorithmRules {
  entryLong?: Condition[];
  entryShort?: Condition[];
  exitLong?: Condition[];
  exitShort?: Condition[];
  slPoints?: number;
  tpPoints?: number;
  sizing: SizingRule;
  maxConcurrent?: number;
}

export interface BacktestMetrics {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  totalReturnPct: number;
  profitFactor: number;
  expectancy: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  recoveryFactor: number;
  avgWin: number;
  avgLoss: number;
  avgWinLossRatio: number;
  consecutiveWinsMax: number;
  consecutiveLossesMax: number;
  k_ratio: number;
}

export interface BacktestResult {
  metrics: BacktestMetrics;
  trades: SimulatedTrade[];
  equityCurve: EquityPoint[];
  finalBalance: number;
  durationMs: number;
}
