export interface TickData {
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: string;
}

export interface Complex {
  re: number;
  im: number;
}

export interface HestonParams {
  kappa: number;
  theta: number;
  sigma: number;
  rho: number;
  v0: number;
}

export interface QuantumState {
  psi: Complex[];
  energy: number;
  wavefunction: number[];
}

export interface WalkResult {
  probabilityDistribution: number[];
  expectedMove: number;
  variance: number;
  bullBias: number;
}

export interface AmplitudeResult {
  signal: "BUY" | "SELL" | "NEUTRAL";
  confidence: number;
  amplitudes: {
    bull: number;
    bear: number;
    neutral: number;
  };
}

export interface CombinedSignal {
  action: "BUY" | "SELL" | "SKIP";
  confidence: number;
  expectedMove: number;
  signalId: string;
}

export type RegimeCode =
  | "BULL_TREND_STRONG"
  | "BULL_TREND_WEAK"
  | "BEAR_TREND_STRONG"
  | "BEAR_TREND_WEAK"
  | "SIDEWAYS_LOW_VOL"
  | "SIDEWAYS_HIGH_VOL"
  | "BREAKOUT_IMMINENT";

export interface RecentTrade {
  pnl: number;
  entry_price: number;
  exit_price: number;
  stop_loss_price: number;
  take_profit_price: number;
  direction: "BUY" | "SELL";
}

export interface SizerParams {
  currentEquity: number;
  sessionBaseEquity: number;
  dailyPnlPct: number;
  signal: CombinedSignal;
  recentTrades: RecentTrade[];
  currentVol15m: number;
  volTarget: number;
  stopLossPips?: number;
}

export interface PositionResult {
  lots: number;
  blocked: boolean;
  reason?: string;
  kellyFraction: number;
  volScalar: number;
  riskPct: number;
}

export interface SessionStatus {
  active: boolean;
  session: "NY" | "LONDON" | "OVERLAP" | "CLOSED";
  minutesUntilClose: number;
}
