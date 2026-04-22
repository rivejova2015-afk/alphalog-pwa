export interface SkillState {
  regimeBucket: number;     // 0-6 (7 regimes: BULL_STRONG, BULL_WEAK, BEAR_STRONG, BEAR_WEAK, SIDEWAYS_LOW, SIDEWAYS_HIGH, BREAKOUT)
  confidenceBucket: number; // 0=<0.6, 1=0.6-0.7, 2=0.7-0.85, 3=>0.85
  volBucket: number;        // 0=<0.002, 1=0.002-0.005, 2=0.005-0.010, 3=>0.010
  sessionBucket: number;    // 0=CLOSED, 1=NY, 2=LONDON, 3=OVERLAP
}

export type SkillAction = 0 | 1 | 2; // 0=BUY, 1=SELL, 2=SKIP
export type SkillStatus = "learning" | "pending_approval" | "approved" | "rejected" | "frozen";
export type SkillEnvironment = "paper" | "live";
export type SkillType = "RL_POLICY" | "LLM_RULES" | "HYBRID";

export const SKILL_STATES = 7 * 4 * 4 * 4; // 448 states
export const ACTION_NAMES = ["BUY", "SELL", "SKIP"] as const;
export const REGIME_NAMES = [
  "BULL_TREND_STRONG",
  "BULL_TREND_WEAK",
  "BEAR_TREND_STRONG",
  "BEAR_TREND_WEAK",
  "SIDEWAYS_LOW_VOL",
  "SIDEWAYS_HIGH_VOL",
  "BREAKOUT_IMMINENT",
] as const;

export interface QTable {
  table: number[][];  // [448 states][3 actions]
  epsilon: number;
  version: number;
  instrument: string;
  trainedAt?: string;
}

export interface TradingRule {
  id: string;
  condition: string;
  action: "BUY" | "SELL" | "SKIP";
  confidenceThreshold: number;
  rationale: string;
  performanceScore: number;
  source: "LLM" | "RL";
  createdAt: string;
}

export interface PerformanceMetrics {
  sharpe: number;
  winRate: number;
  avgPnl: number;
  totalTrades: number;
  totalPnl: number;
}

export interface SkillLearningResult {
  updatedQTable: QTable;
  episodeCount: number;
  avgReward: number;
  improvedActions: number;
  llmRules: TradingRule[];
}

export interface LLMExtractionResult {
  rules: Array<{
    condition: string;
    action: "BUY" | "SELL" | "SKIP";
    confidence_threshold: number;
    rationale: string;
  }>;
  insights: string[];
}

export interface PaperTrade {
  id: string;
  symbol: string;
  direction: "BUY" | "SELL";
  entry_price: number;
  exit_price: number;
  lots: number;
  pnl: number | null;
  pnl_percent: number | null;
  entry_date: string;
  exit_date: string | null;
  regime?: string;
  confidence?: number;
  vol15m?: number;
  session?: "NY" | "LONDON" | "OVERLAP" | "CLOSED";
  maxAdverseExcursion?: number;
  notes?: string;
}
