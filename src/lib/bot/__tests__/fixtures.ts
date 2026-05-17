// Reusable test fixtures for src/lib/bot/ unit tests.
//
// Convenciones:
// - Helpers `make*()` retornan objetos fresh por cada llamada (no mutar).
// - Cualquier override va por spread al final del objeto base.

import type {
  TickData,
  HestonParams,
  CombinedSignal,
  WalkResult,
  AmplitudeResult,
  QuantumState,
  RecentTrade,
  RegimeCode,
  SizerParams,
} from "../signal-engine/types";
import type { Tick, SkewSignal, DetectorConfig } from "../arbitrage/latency-detector";
import type { PulseConfig } from "../arbitrage/pulse-validator";

// ─── TickData (signal-engine) ────────────────────────────────────────────────

export function makeTick(overrides: Partial<TickData> = {}): TickData {
  return {
    bid: 2000,
    ask: 2002,
    last: 2001,
    volume: 100,
    timestamp: "2026-05-03T13:00:00Z",
    ...overrides,
  };
}

export function makeBullishTickSeries(n = 10, startPrice = 1990): TickData[] {
  return Array.from({ length: n }, (_, i) => makeTick({
    bid: startPrice + i * 2,
    ask: startPrice + i * 2 + 2,
    last: startPrice + i * 2 + 1,
    volume: 100 + i * 5,
    timestamp: new Date(Date.parse("2026-05-03T13:00:00Z") + i * 60_000).toISOString(),
  }));
}

export function makeBearishTickSeries(n = 10, startPrice = 2010): TickData[] {
  return Array.from({ length: n }, (_, i) => makeTick({
    bid: startPrice - i * 2,
    ask: startPrice - i * 2 + 2,
    last: startPrice - i * 2 + 1,
    volume: 100,
    timestamp: new Date(Date.parse("2026-05-03T13:00:00Z") + i * 60_000).toISOString(),
  }));
}

// ─── Heston / Quantum ────────────────────────────────────────────────────────

export const HESTON_DEFAULT: HestonParams = {
  kappa: 2.0,
  theta: 0.05,
  sigma: 0.5,
  rho: -0.7,
  v0: 0.04,
};

export function makeQuantumState(overrides: Partial<QuantumState> = {}): QuantumState {
  return {
    psi: [{ re: 1, im: 0 }],
    energy: 1.5e3,
    wavefunction: [1],
    ...overrides,
  };
}

export function makeWalkResult(overrides: Partial<WalkResult> = {}): WalkResult {
  return {
    probabilityDistribution: new Array(100).fill(1 / 100),
    expectedMove: 0.5,
    variance: 10,
    bullBias: 0.3,
    ...overrides,
  };
}

export function makeAmplitudeResult(overrides: Partial<AmplitudeResult> = {}): AmplitudeResult {
  return {
    signal: "BUY",
    confidence: 0.7,
    amplitudes: { bull: 0.8, bear: 0.4, neutral: 0.4 },
    ...overrides,
  };
}

export function makeCombinedSignal(overrides: Partial<CombinedSignal> = {}): CombinedSignal {
  return {
    action: "BUY",
    confidence: 0.7,
    expectedMove: 0.5,
    signalId: "sig_test_12345",
    ...overrides,
  };
}

// ─── Position sizer ──────────────────────────────────────────────────────────

export function makeRecentTrade(overrides: Partial<RecentTrade> = {}): RecentTrade {
  return {
    pnl: 100,
    entry_price: 2000,
    exit_price: 2010,
    stop_loss_price: 1990,
    take_profit_price: 2020,
    direction: "BUY",
    ...overrides,
  };
}

export function makeSizerParams(overrides: Partial<SizerParams> = {}): SizerParams {
  return {
    currentEquity: 10_000,
    sessionBaseEquity: 10_000,
    dailyPnlPct: 0,
    signal: makeCombinedSignal(),
    recentTrades: [makeRecentTrade(), makeRecentTrade({ pnl: -50 })],
    currentVol15m: 0.005,
    volTarget: 0.005,
    stopLossPips: 50,
    ...overrides,
  };
}

export const ALL_REGIMES: RegimeCode[] = [
  "BULL_TREND_STRONG",
  "BULL_TREND_WEAK",
  "BEAR_TREND_STRONG",
  "BEAR_TREND_WEAK",
  "SIDEWAYS_LOW_VOL",
  "SIDEWAYS_HIGH_VOL",
  "BREAKOUT_IMMINENT",
];

// ─── Arbitrage (latency-detector / pulse-validator) ──────────────────────────

export function makeArbTick(overrides: Partial<Tick> = {}): Tick {
  return {
    broker_id: "broker_a",
    symbol: "XAUUSD",
    bid: 2000.00,
    ask: 2000.02,
    ts_ms: Date.parse("2026-05-03T13:00:00Z"),
    ...overrides,
  };
}

export function makeDetectorConfig(overrides: Partial<DetectorConfig> = {}): DetectorConfig {
  return {
    max_skew_points: 10,
    point_size: 0.01,
    ...overrides,
  };
}

export function makePulseConfig(overrides: Partial<PulseConfig> = {}): PulseConfig {
  return {
    min_pulse_ticks: 5,
    pulse_window_ms: 2000,
    min_alignment: 0.8,
    ...overrides,
  };
}

export function makeSkewSignal(overrides: Partial<SkewSignal> = {}): SkewSignal {
  return {
    symbol: "XAUUSD",
    fast_broker: "broker_a",
    slow_broker: "broker_b",
    skew_points: 15,
    direction: "BUY",
    fast_bid: 2000.15,
    slow_bid: 2000.00,
    detected_at: Date.parse("2026-05-03T13:00:00Z"),
    ...overrides,
  };
}

/**
 * Genera N ticks consecutivos en una sola dirección.
 * direction "BUY"  → bid sube
 * direction "SELL" → bid baja
 */
export function makePulseTicksAligned(
  direction: "BUY" | "SELL",
  n: number,
  startBid = 2000,
  signalTime = Date.parse("2026-05-03T13:00:00Z"),
): Tick[] {
  const step = direction === "BUY" ? 0.01 : -0.01;
  return Array.from({ length: n }, (_, i) => makeArbTick({
    bid: startBid + i * step,
    ask: startBid + i * step + 0.02,
    ts_ms: signalTime - (n - i) * 100, // 100ms entre ticks, terminando en signalTime
  }));
}
