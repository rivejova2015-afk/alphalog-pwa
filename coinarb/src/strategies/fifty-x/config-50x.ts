/**
 * 50x strategy config — extends the Coinarb base TradingParams with the
 * 50x-specific knobs (decision tiers, validated-layer gates, cascade entries).
 *
 * Loads the same Supabase row as the base loader, then layers env-driven
 * COINARB_50X_* knobs on top.
 */

import { loadCoinarbConfig, type CoinarbAgentConfig, type TradingParams } from '../../config.js';

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
  /** Hard cap on simultaneous open positions across both venues. */
  maxOpenPositions: number;
  /** Width of the entry window in ms. */
  entryWindowMs: number;
  /** Allow spot venue (Coinbase Advanced) entries. Default true. */
  spotEnabled: boolean;
  /** Allow perp venue (Coinbase International) entries. Default true. */
  perpEnabled: boolean;
  /** Five-layer validator: minimum overall confidence to allow entry (0..1). */
  validatorMinConfidence: number;
  /** Cancel + skip if a post-only order fails to fill within this many ms. */
  fillTimeoutMs: number;
}

export interface FiftyXAgentConfig extends Omit<CoinarbAgentConfig, 'params'> {
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
  maxOpenPositions: 2,
  entryWindowMs: 60_000,
  spotEnabled: true,
  perpEnabled: true,
  validatorMinConfidence: 0.50,
  fillTimeoutMs: 1_500,
} as const;

function envNum(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1' || raw.toLowerCase() === 'yes';
}

export async function loadFiftyXAgentConfig(): Promise<FiftyXAgentConfig> {
  const base = await loadCoinarbConfig();

  const params: FiftyXParams = {
    ...base.params,
    scalpKellyMultiplier:    envNum('COINARB_50X_SCALP_KELLY_MULT',  DEFAULTS.scalpKellyMultiplier),
    cascadeTriggerPnl:       envNum('COINARB_50X_CASCADE_TRIGGER',   DEFAULTS.cascadeTriggerPnl),
    cascadeKellyDecay:       envNum('COINARB_50X_CASCADE_DECAY',     DEFAULTS.cascadeKellyDecay),
    cascadeMaxLevels:        envNum('COINARB_50X_CASCADE_MAX_LVLS',  DEFAULTS.cascadeMaxLevels),
    enterMinGap:             envNum('COINARB_50X_ENTER_MIN_GAP',     DEFAULTS.enterMinGap),
    enterMinConfidence:      envNum('COINARB_50X_ENTER_MIN_CONF',    DEFAULTS.enterMinConfidence),
    enterMinValidatedCount:  envNum('COINARB_50X_ENTER_MIN_LAYERS',  DEFAULTS.enterMinValidatedCount),
    scalpMinGap:             envNum('COINARB_50X_SCALP_MIN_GAP',     DEFAULTS.scalpMinGap),
    scalpMinConfidence:      envNum('COINARB_50X_SCALP_MIN_CONF',    DEFAULTS.scalpMinConfidence),
    scalpMinValidatedCount:  envNum('COINARB_50X_SCALP_MIN_LAYERS',  DEFAULTS.scalpMinValidatedCount),
    maxOpenPositions:        envNum('COINARB_50X_MAX_OPEN_POSITIONS', DEFAULTS.maxOpenPositions),
    entryWindowMs:           envNum('COINARB_50X_ENTRY_WINDOW_MS',    DEFAULTS.entryWindowMs),
    spotEnabled:             envBool('COINARB_50X_SPOT_ENABLED',      DEFAULTS.spotEnabled),
    perpEnabled:             envBool('COINARB_50X_PERP_ENABLED',      DEFAULTS.perpEnabled),
    validatorMinConfidence:  envNum('COINARB_50X_VALIDATOR_MIN_CONF', DEFAULTS.validatorMinConfidence),
    fillTimeoutMs:           envNum('COINARB_50X_FILL_TIMEOUT_MS',    DEFAULTS.fillTimeoutMs),
  };

  return { ...base, params };
}
