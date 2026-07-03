import { z } from 'zod';

// MT4/MT5 EA engine config. Used by forex/futures/options algorithms.
// Crypto/Fly bots use `CoinarbEngineConfigSchema` (sibling, not unioned —
// existing MT5 call sites would have to narrow on a union, so we keep the
// canonical EngineConfigSchema as the MT5 shape and let coinarb callers
// import CoinarbEngineConfigSchema explicitly).
export const EngineConfigSchema = z.object({
  base_engine: z.object({
    multi_tf: z.literal(true),
    engine_version: z.string().default('1.0.0'),
    seed: z.number().int().default(42),
  }),
  modules: z.object({
    capital_phases: z.object({
      enabled: z.boolean().default(false),
      phases: z.number().int().min(1).max(11).default(11),
      starting_capital: z.number().positive().default(100),
      risk_min_pct: z.number().min(0.1).max(5).default(1),
      risk_max_pct: z.number().min(1).max(15).default(15),
    }),
    circuit_breaker: z.object({
      enabled: z.boolean().default(false),
      consecutive_losses: z.number().int().min(1).max(20).default(5),
      daily_dd_pct: z.number().min(1).max(20).default(5),
      weekly_dd_pct: z.number().min(1).max(30).default(10),
      // Default false = fail-closed: si la query de trades falla (ej. infra
      // de Supabase caída), el breaker DISPARA y bloquea nuevas entradas —
      // justo cuando más protección hace falta. true = comportamiento
      // legacy fail-open, solo para casos de uso que lo necesiten
      // explícitamente.
      fail_open_on_error: z.boolean().default(false),
    }),
    cascade_probability: z.object({
      enabled: z.boolean().default(false),
      min_bias_score: z.number().min(0).max(100).default(60),
      min_probability: z.number().min(0).max(1).default(0.65),
    }),
  }),
  overlays: z.object({
    decision_engine: z.object({
      enabled: z.boolean().default(false),
      decision_score_min: z.number().min(0).max(100).default(60),
      decision_base_start: z.number().min(0).max(100).default(60),
    }),
    order_flow: z.object({
      enabled: z.boolean().default(false),
      sweep_lookback_bars: z.number().int().min(1).max(50).default(10),
      eq_tolerance_points: z.number().min(0).default(20),
    }),
    range_gate: z.object({
      enabled: z.boolean().default(false),
      range_gate_mode: z.enum(['RANGE_POINTS', 'RANGE_ATR']).default('RANGE_POINTS'),
      range_gate_min_points: z.number().min(0).default(0),
      range_gate_max_points: z.number().min(0).default(0),
      range_gate_min_atr: z.number().min(0).default(0),
      range_gate_max_atr: z.number().min(0).default(0),
    }),
    pulse_engine: z.object({
      enabled: z.boolean().default(false),
      pulse_window_ms: z.number().int().min(100).default(800),
      min_pulse_ticks: z.number().int().min(1).default(5),
      max_skew_points: z.number().min(0).default(30),
    }),
  }),
});

export type EngineConfig = z.infer<typeof EngineConfigSchema>;

// Coinarb crypto-bot engine config. Mirrors `coinarb_agents.config` and the
// `algorithms.engine_config` JSONB that the Fly worker reads (Fase B). Sibling
// of EngineConfigSchema — coinarb callers import this directly. Tunable
// thresholds (mtf_confidence_min, pd_*) live in `algorithms.parameters` so
// they can be edited from the UI without touching the engine shape.
const SymbolKey = z.string().regex(/^[A-Z]+-[A-Z]+$/);  // e.g. BTC-USD
export const CoinarbEngineConfigSchema = z.object({
  kind: z.literal('coinarb'),
  venue: z.enum(['coinbase_spot']).default('coinbase_spot'),
  tick_ms: z.number().int().min(1_000).max(120_000).default(15_000),
  spot_pairs: z.array(SymbolKey).min(1).default(['BTC-USD', 'ETH-USD', 'SOL-USD']),
  paper_mode_default: z.boolean().default(true),  // cosmetic; runtime brake is COINARB_50X_PAPER_MODE
  phases: z.number().int().min(1).max(11).default(11),
  starting_capital_usd: z.number().positive().default(100),
  rr_min: z.number().min(0.5).max(10).default(2),
  mtf_weights: z.record(z.string(), z.union([z.string(), z.number()])).default({
    '1D': '0.15', '4H': '0.15', '1H': '0.15', '30M': '0.15', '15M': '0.15', '5M': '0.15', '1M': '0.10',
  }),
  pd_macro_days: z.number().int().min(1).max(30).default(3),
  daily_trade_cap_total: z.number().int().min(0).max(1000).default(100),
  daily_trade_cap_per_symbol: z.number().int().min(0).max(1000).default(33),
  consecutive_loss_limit: z.number().int().min(1).max(50).default(6),
  circuit_pause_ms: z.number().int().min(0).default(10_800_000),
  historical_ttl_h: z.number().min(0.1).max(48).default(4),
  historical_reload_strategy: z.enum(['blocking', 'background_after_first_load'])
    .default('background_after_first_load'),
  parallel_symbol_eval: z.boolean().default(true),
});

export type CoinarbEngineConfig = z.infer<typeof CoinarbEngineConfigSchema>;

// Tunable per-algorithm parameters that hot-rotate (Fase C). These live in
// `algorithms.parameters` and can be edited from the UI; the bot polls
// `bot_commands` to apply updates without restart.
export const CoinarbParametersSchema = z.object({
  mtf_confidence_min:       z.number().min(0).max(1).default(0.30),
  pd_macro_band:            z.number().min(0).max(0.2).default(0.005),
  pd_micro_band:            z.number().min(0).max(0.2).default(0.005),
  sweep_confirm_body_ratio: z.number().min(0).max(1).default(0.40),
  arb_gap_min:              z.record(SymbolKey, z.number().min(0).max(1)).default({
    'BTC-USD': 0.00050,
    'ETH-USD': 0.00080,
    'SOL-USD': 0.00100,
  }),
});

export type CoinarbParameters = z.infer<typeof CoinarbParametersSchema>;

export const ENGINE_CONFIG_DEFAULT: EngineConfig = {
  base_engine: {
    multi_tf: true,
    engine_version: '1.0.0',
    seed: 42,
  },
  modules: {
    capital_phases: {
      enabled: false,
      phases: 11,
      starting_capital: 100,
      risk_min_pct: 1,
      risk_max_pct: 15,
    },
    circuit_breaker: {
      enabled: false,
      consecutive_losses: 5,
      daily_dd_pct: 5,
      weekly_dd_pct: 10,
      fail_open_on_error: false,
    },
    cascade_probability: {
      enabled: false,
      min_bias_score: 60,
      min_probability: 0.65,
    },
  },
  overlays: {
    decision_engine: {
      enabled: false,
      decision_score_min: 60,
      decision_base_start: 60,
    },
    order_flow: {
      enabled: false,
      sweep_lookback_bars: 10,
      eq_tolerance_points: 20,
    },
    range_gate: {
      enabled: false,
      range_gate_mode: 'RANGE_POINTS',
      range_gate_min_points: 0,
      range_gate_max_points: 0,
      range_gate_min_atr: 0,
      range_gate_max_atr: 0,
    },
    pulse_engine: {
      enabled: false,
      pulse_window_ms: 800,
      min_pulse_ticks: 5,
      max_skew_points: 30,
    },
  },
};
