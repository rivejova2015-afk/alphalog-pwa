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

// Trace of the D1 → H1 → M15 → M1 SMC funnel for a single evaluation.
export interface FunnelTrace {
  pdh: number | null;
  pdl: number | null;
  swept: "PDH" | "PDL" | null;
  h1Bias: "bull" | "bear" | "neutral";
  setupSide: "bull" | "bear" | null;        // null = no valid D1+H1 setup
  bosDirection: "bull" | "bear" | null;
  bosKind: "a_favor" | "en_contra" | null;  // BOS vs H1 structure
  entryZone: "ob" | "fvg" | null;
}

export interface SignalResult {
  action: SignalAction;
  lots: number;
  confidence: number;       // 0..1
  signalId: string;         // deterministic — same input → same id
  reason: string;
  funnel?: FunnelTrace;     // SMC funnel trace (Base Engine v1)
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
