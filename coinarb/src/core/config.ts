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
export const LOOP_INTERVAL_MS = 15_000;       // 4 ticks per minute (parallel symbol eval)

// =============================================================================
// CONFIG SPLIT (CAMBIO 5c)
// =============================================================================
// • Operational toggles → Fly secrets (this file via process.env). Hot-rotated
//   without code change: thresholds, caps, paper-mode flag, CDP creds.
// • Documentation/dashboard mirror → coinarb_agents.config jsonb in Supabase.
//   The runtime does NOT read Supabase config; it's there so the dashboard and
//   future audits show what the bot is actually running.
// • Code-only constants → exported here as `const` (PHASES, SYMBOLS, etc).
//   Changing these requires a redeploy.
// • Real paper/live switch lives in COINARB_50X_PAPER_MODE (env, line below);
//   `coinarb_agents.config.paper_mode_default` is purely cosmetic.
// =============================================================================

// Tunable thresholds — `let` so loadConfigFromDb() can rebind them at startup.
// ES module exports are live bindings, so consumers that did
//   `import { MTF_CONFIDENCE_MIN } from './config.js'` see the new value
// on next read without any plumbing changes.
export let MTF_CONFIDENCE_MIN = Number(process.env.MTF_CONFIDENCE_MIN ?? '0.30');
export let PD_MACRO_BAND = Number(process.env.PD_MACRO_BAND ?? '0.005');
export let PD_MICRO_BAND = Number(process.env.PD_MICRO_BAND ?? '0.005');
export const PD_MACRO_DAYS = 3;  // hardcoded; not user-tunable
export let SWEEP_CONFIRM_BODY_RATIO = Number(process.env.SWEEP_CONFIRM_BODY_RATIO ?? '0.40');

export const COINARB_AGENT_ID = process.env.COINARB_AGENT_ID ?? 'a667d400-065f-4415-9609-373c3749e5fd';
export const COINARB_USER_ID = process.env.COINARB_USER_ID ?? '';

// Bot identity for the bot_commands lifecycle (Fase C). Defaults match
// the rows created by migration 099/100; envs override for parity tests.
export const COINARB_BOT_ID = process.env.COINARB_BOT_ID ?? '11111111-c01a-4b00-9001-000000000001';
export const COINARB_BOT_ACCOUNT_ID = process.env.COINARB_BOT_ACCOUNT_ID ?? '22222222-c01a-4b00-9002-000000000001';

// User-driven pause state — set by bot_commands command_type='pause'/'resume'
// from the UI. Loop checks this before entering any position. Independent of
// circuit breaker (machine self-protection) and daily cap (rate limit).
export let TRADING_PAUSED = false;
export function setTradingPaused(paused: boolean): boolean {
  if (paused === TRADING_PAUSED) return false;
  TRADING_PAUSED = paused;
  return true;
}
// PAPER_MODE: env var COINARB_50X_PAPER_MODE has ABSOLUTE priority over Supabase config.
// To go live: flyctl secrets set COINARB_50X_PAPER_MODE=false -a coinarb-50x
// (additionally requires COINBASE_CDP_API_KEY/SECRET to actually trade real money)
export const PAPER_MODE = (process.env.COINARB_50X_PAPER_MODE ?? 'true') === 'true';

// =============================================================================
// applyParameters (Fase B+C) — mutate this module's `let` bindings from a
// jsonb-shaped object. Used both at startup (loadConfigFromDb) and at runtime
// by the command-poller when bot_commands.update_parameters arrives. Returns
// the list of fields that actually changed so callers can log/audit.
// =============================================================================
export function applyParameters(params: Record<string, unknown>): string[] {
  const changes: string[] = [];

  if (typeof params.mtf_confidence_min === 'number' && params.mtf_confidence_min !== MTF_CONFIDENCE_MIN) {
    MTF_CONFIDENCE_MIN = params.mtf_confidence_min;
    changes.push(`mtf_confidence_min=${MTF_CONFIDENCE_MIN}`);
  }
  if (typeof params.pd_macro_band === 'number' && params.pd_macro_band !== PD_MACRO_BAND) {
    PD_MACRO_BAND = params.pd_macro_band;
    changes.push(`pd_macro_band=${PD_MACRO_BAND}`);
  }
  if (typeof params.pd_micro_band === 'number' && params.pd_micro_band !== PD_MICRO_BAND) {
    PD_MICRO_BAND = params.pd_micro_band;
    changes.push(`pd_micro_band=${PD_MICRO_BAND}`);
  }
  if (typeof params.sweep_confirm_body_ratio === 'number' && params.sweep_confirm_body_ratio !== SWEEP_CONFIRM_BODY_RATIO) {
    SWEEP_CONFIRM_BODY_RATIO = params.sweep_confirm_body_ratio;
    changes.push(`sweep_confirm_body_ratio=${SWEEP_CONFIRM_BODY_RATIO}`);
  }

  const gaps = params.arb_gap_min as Record<string, number> | undefined;
  if (gaps && typeof gaps === 'object') {
    for (const sym of SYMBOLS) {
      const v = gaps[sym];
      if (typeof v === 'number' && v > 0 && v !== ARB_GAP_MIN_PCT[sym]) {
        ARB_GAP_MIN_PCT[sym] = v;
        changes.push(`arb_gap[${sym}]=${v}`);
      }
    }
  }

  return changes;
}

// =============================================================================
// loadConfigFromDb (Fase B) — pull tunables from algorithms.parameters at
// startup so the trader can edit them from the UI without flyctl secrets set.
// Precedence: DB row → env var → hardcoded default. DB failure keeps env values.
// =============================================================================
export async function loadConfigFromDb(): Promise<void> {
  const { getSupabase } = await import('../supabase.js');
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('algorithms')
      .select('parameters, engine_config')
      .eq('id', COINARB_AGENT_ID)
      .maybeSingle();

    if (error) {
      console.warn('[config] algorithms row lookup failed, keeping env defaults:', error.message);
      return;
    }
    if (!data) {
      console.warn(`[config] no algorithms row for id=${COINARB_AGENT_ID}, keeping env defaults`);
      return;
    }

    const params = (data.parameters ?? {}) as Record<string, unknown>;
    const engine = (data.engine_config ?? {}) as Record<string, unknown>;
    // Back-compat: arb_gap_min historically lived in engine_config too.
    if (!params.arb_gap_min && engine.arb_gap_min) params.arb_gap_min = engine.arb_gap_min;

    applyParameters(params);

    console.log(
      `[config] loaded from algorithms.parameters — ` +
      `mtf_min=${MTF_CONFIDENCE_MIN} pd_macro=${PD_MACRO_BAND} pd_micro=${PD_MICRO_BAND} ` +
      `sweep=${SWEEP_CONFIRM_BODY_RATIO} arb_gap=${JSON.stringify(ARB_GAP_MIN_PCT)}`
    );
  } catch (err) {
    console.warn('[config] loadConfigFromDb threw, keeping env defaults:', err);
  }
}
