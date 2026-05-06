/**
 * Coinarb runtime configuration.
 *
 * Spot-only crypto bot for Coinbase Advanced (BTC-USD/ETH-USD/SOL-USD).
 * Capital phase ladder, arb gap thresholds, R:R, and circuit-breaker tuning
 * all live here so they can be tuned without touching the loop.
 */

export const SYMBOLS = ['BTC-USD', 'ETH-USD', 'SOL-USD'] as const;
export type Symbol = typeof SYMBOLS[number];

export const TIMEFRAMES = ['1D', '4H', '1H', '30M', '15M', '5M', '1M'] as const;
export type Timeframe = typeof TIMEFRAMES[number];

export interface PhaseConfig {
  name: string;
  capitalMin: number;
  riskPct: number;
}

// 11-phase capital ladder. risk_pct compounds up as capital grows.
export const PHASES: readonly PhaseConfig[] = [
  { name: '$100',   capitalMin:      100, riskPct: 0.01  },
  { name: '$500',   capitalMin:      500, riskPct: 0.015 },
  { name: '$1K',    capitalMin:    1_000, riskPct: 0.02  },
  { name: '$5K',    capitalMin:    5_000, riskPct: 0.025 },
  { name: '$10K',   capitalMin:   10_000, riskPct: 0.03  },
  { name: '$50K',   capitalMin:   50_000, riskPct: 0.04  },
  { name: '$100K',  capitalMin:  100_000, riskPct: 0.05  },
  { name: '$250K',  capitalMin:  250_000, riskPct: 0.07  },
  { name: '$500K',  capitalMin:  500_000, riskPct: 0.09  },
  { name: '$1M',    capitalMin: 1_000_000, riskPct: 0.12 },
  { name: '$5M',    capitalMin: 5_000_000, riskPct: 0.15 },
] as const;

// Latency-arb gap thresholds (Coinbase vs Binance), in pct (e.g. 0.0005 = 0.05%).
// Calibrated for efficient spot — real Coinbase↔Binance gaps usually sit at 0.0005–0.001.
// If too many false entries: raise. If arb-gap is the dominant SKIP reason: lower.
export const ARB_GAP_MIN_PCT: Record<Symbol, number> = {
  'BTC-USD': 0.00050,
  'ETH-USD': 0.00080,
  'SOL-USD': 0.00100,
};

export const RR_MIN = 2.0;                    // Min R:R 1:2 (TP / SL distance)
export const FEAR_GREED_GATE = 65;            // Legacy constant; F&G is telemetry-only and never blocks entries.
export const CIRCUIT_LOSS_LIMIT = 6;          // 6 consecutive losses → 3h pause
export const CIRCUIT_PAUSE_MS = 3 * 60 * 60 * 1000;
export const DAILY_TRADE_CAP = 100;           // Hard stop at 100 trades/day
export const LOOP_INTERVAL_MS = 60_000;       // 1 tick per minute

// Tunable thresholds — overridable via Fly secrets without redeploy.
export const MTF_CONFIDENCE_MIN = Number(process.env.MTF_CONFIDENCE_MIN ?? '0.30');
export const PD_MACRO_BAND = Number(process.env.PD_MACRO_BAND ?? '0.005');
export const PD_MICRO_BAND = Number(process.env.PD_MICRO_BAND ?? '0.005');
export const PD_MACRO_DAYS = 3;
export const SWEEP_CONFIRM_BODY_RATIO = Number(process.env.SWEEP_CONFIRM_BODY_RATIO ?? '0.40');

export const COINARB_AGENT_ID = process.env.COINARB_AGENT_ID ?? 'a667d400-065f-4415-9609-373c3749e5fd';
export const COINARB_USER_ID = process.env.COINARB_USER_ID ?? '';
// PAPER_MODE: env var COINARB_50X_PAPER_MODE has ABSOLUTE priority over Supabase config.
// To go live: flyctl secrets set COINARB_50X_PAPER_MODE=false -a coinarb-50x
// (additionally requires COINBASE_CDP_API_KEY/SECRET to actually trade real money)
export const PAPER_MODE = (process.env.COINARB_50X_PAPER_MODE ?? 'true') === 'true';
