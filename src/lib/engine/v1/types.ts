// Base Engine v1 — internal types.
// Public response surface lives in /api/algorithms/[id]/signal route.

import type { Bar } from "@/types/backtest";

export type SignalAction = "BUY" | "SELL" | "HOLD";

export interface ModuleStatus {
  name: string;
  enabled: boolean;
  tripped?: boolean;
  reason?: string;
}

export interface SignalResult {
  action: SignalAction;
  lots: number;
  confidence: number;       // 0..1
  signalId: string;         // deterministic — same input → same id
  reason: string;
  bias_score?: number;      // 0..100, 50=neutral, >50=BUY skew
  tfs?: TfState[];
  modules: ModuleStatus[];
}

export interface TfState {
  tf: string;
  weight: number;
  role: string;
  bias: number;             // -100..+100
  bars: number;             // count loaded
}

export interface EngineContext {
  now: Date;
  symbol: string;
  currentEquity?: number;
  baseLots?: number;
}

export interface TimeframeWeight {
  tf: string;
  weight: number;
  role: string;
}

export interface SessionWindow {
  name: string;
  start_gmt: string;        // "HH:MM"
  end_gmt: string;          // "HH:MM"
}

export interface MultiTfConfig {
  timeframes: TimeframeWeight[];
  min_bias_score?: number;
  sessions?: Record<string, SessionWindow[]>;
}

export type BarsByTf = Map<string, Bar[]>;
