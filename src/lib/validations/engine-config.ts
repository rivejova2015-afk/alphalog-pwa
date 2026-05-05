import { z } from 'zod';

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
