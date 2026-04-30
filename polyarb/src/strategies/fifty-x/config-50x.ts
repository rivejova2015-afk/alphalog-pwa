/**
 * 500x Strategy Config — extends the base TradingParams with the
 * 500x-specific knobs (decision tiers + validated-layer gates,
 * cascade entries, session-aware Kelly, Day-10 thresholds).
 *
 * Reads the same `polyarb_agents` row as the production loader, then layers
 * the 500x knobs from env vars on top. Env-only (not jsonb) keeps the base
 * loader 100% untouched — the production engine is unaffected.
 */

import { loadAgentConfig, type AgentConfig, type TradingParams } from '../../config.js';

export interface FiftyXParams extends TradingParams {
  /** Multiplier applied to final Kelly fraction for SCALP tier (e.g. 0.10). */
  scalpKellyMultiplier: number;
  /** Position must be up at least this fraction (e.g. 0.02) before a cascade fires. */
  cascadeTriggerPnl: number;
  /** Each subsequent cascade is `prevKelly * cascadeKellyDecay` (e.g. 0.75). */
  cascadeKellyDecay: number;
  /** Maximum number of cascade adds per market window (e.g. 4). */
  cascadeMaxLevels: number;
  /** ENTER tier — minimum |gap| (e.g. 0.02 = 2%). */
  enterMinGap: number;
  /** ENTER tier — minimum five-layer overall confidence (e.g. 0.70). */
  enterMinConfidence: number;
  /** ENTER tier — minimum five-layer validated layer count (e.g. 4). */
  enterMinValidatedCount: number;
  /** SCALP tier — minimum |gap| (e.g. 0.015). */
  scalpMinGap: number;
  /** SCALP tier — minimum five-layer overall confidence (e.g. 0.60). */
  scalpMinConfidence: number;
  /** SCALP tier — minimum five-layer validated layer count (e.g. 3). */
  scalpMinValidatedCount: number;
}

export interface FiftyXAgentConfig extends Omit<AgentConfig, 'params'> {
  params: FiftyXParams;
}

const DEFAULTS = {
  scalpKellyMultiplier: 0.10,
  cascadeTriggerPnl: 0.02,
  cascadeKellyDecay: 0.75,
  cascadeMaxLevels: 4,
  enterMinGap: 0.020,
  enterMinConfidence: 0.70,
  enterMinValidatedCount: 4,
  scalpMinGap: 0.015,
  scalpMinConfidence: 0.60,
  scalpMinValidatedCount: 3,
  /** Default per-tick clamp on Kelly fraction. Raised from 0.10 → 0.40 to allow
   *  the 2.5× session multiplier to actually push sizing up; the production
   *  engine's `maxKellyFractionEvent` (0.40) is still the hard ceiling. */
  maxKellyFraction: 0.40,
} as const;

function envNum(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function loadFiftyXAgentConfig(): Promise<FiftyXAgentConfig> {
  const base = await loadAgentConfig();

  const params: FiftyXParams = {
    ...base.params,
    maxKellyFraction:        envNum('POLYARB_50X_MAX_KELLY',         DEFAULTS.maxKellyFraction),
    scalpKellyMultiplier:    envNum('POLYARB_50X_SCALP_KELLY_MULT',  DEFAULTS.scalpKellyMultiplier),
    cascadeTriggerPnl:       envNum('POLYARB_50X_CASCADE_TRIGGER',   DEFAULTS.cascadeTriggerPnl),
    cascadeKellyDecay:       envNum('POLYARB_50X_CASCADE_DECAY',     DEFAULTS.cascadeKellyDecay),
    cascadeMaxLevels:        envNum('POLYARB_50X_CASCADE_MAX_LVLS',  DEFAULTS.cascadeMaxLevels),
    enterMinGap:             envNum('POLYARB_50X_ENTER_MIN_GAP',     DEFAULTS.enterMinGap),
    enterMinConfidence:      envNum('POLYARB_50X_ENTER_MIN_CONF',    DEFAULTS.enterMinConfidence),
    enterMinValidatedCount:  envNum('POLYARB_50X_ENTER_MIN_LAYERS',  DEFAULTS.enterMinValidatedCount),
    scalpMinGap:             envNum('POLYARB_50X_SCALP_MIN_GAP',     DEFAULTS.scalpMinGap),
    scalpMinConfidence:      envNum('POLYARB_50X_SCALP_MIN_CONF',    DEFAULTS.scalpMinConfidence),
    scalpMinValidatedCount:  envNum('POLYARB_50X_SCALP_MIN_LAYERS',  DEFAULTS.scalpMinValidatedCount),
  };

  return { ...base, params };
}
