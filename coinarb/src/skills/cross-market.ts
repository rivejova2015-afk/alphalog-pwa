/**
 * Cross-Market Confirmation — Superpower #6
 *
 * When BTC accelerates toward a milestone, checks if ETH and SOL
 * are moving in the same direction. Multi-asset alignment = stronger signal.
 * Divergence = probable false positive, down-weight or skip.
 *
 * Logic:
 *   - Compare 5m velocity direction across BTC / ETH / SOL
 *   - Count how many assets agree with the primary signal direction
 *   - Score: 3/3 = STRONG, 2/3 = MODERATE, 1/3 = WEAK
 *   - Also checks if cross-asset velocities are accelerating (3x signal)
 */

import type { PriceSample } from './velocity-detector.js';

export type ConfirmationStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'DIVERGING';

export interface AssetMomentum {
  symbol: string;
  velocity5m: number;   // $/h over last 5 min
  velocity1h: number;   // $/h over last 1h
  direction: 'UP' | 'DOWN' | 'FLAT';
  isAccelerating: boolean;
  samplesUsed: number;
}

export interface CrossMarketSignal {
  primarySymbol: string;
  primaryDirection: 'UP' | 'DOWN';
  assets: AssetMomentum[];
  agreementCount: number;   // how many of 3 assets agree with primary
  strength: ConfirmationStrength;
  allAccelerating: boolean; // true if all agreeing assets are also accelerating
  edgeMultiplier: number;   // multiply edge by this (1.0-1.5 boost or 0.5 penalty)
  computedAt: number;
}

const FLAT_THRESHOLD = 20; // $/h — below this velocity = FLAT

function calcVelocity(samples: PriceSample[], windowMs: number, now: number): number {
  const ws = samples.filter(s => s.timestamp >= now - windowMs);
  if (ws.length < 2) return 0;
  const oldest = ws[0];
  const newest = ws[ws.length - 1];
  const dtHours = (newest.timestamp - oldest.timestamp) / 3_600_000;
  if (dtHours < 0.0001) return 0;
  return (newest.price - oldest.price) / dtHours;
}

function calcAcceleration(samples: PriceSample[], windowMs: number, now: number): boolean {
  const ws = samples.filter(s => s.timestamp >= now - windowMs);
  if (ws.length < 4) return false;
  const midIdx = Math.floor(ws.length / 2);
  const mid = ws[midIdx];
  const oldest = ws[0];
  const newest = ws[ws.length - 1];
  const dt1 = (mid.timestamp - oldest.timestamp) / 3_600_000;
  const dt2 = (newest.timestamp - mid.timestamp) / 3_600_000;
  if (dt1 < 0.0001 || dt2 < 0.0001) return false;
  const v1 = (mid.price - oldest.price) / dt1;
  const v2 = (newest.price - mid.price) / dt2;
  // Accelerating = same sign and v2 > v1 in magnitude
  return Math.sign(v1) === Math.sign(v2) && Math.abs(v2) > Math.abs(v1) * 1.1;
}

/**
 * Compute momentum for a single asset.
 */
function getAssetMomentum(
  symbol: string,
  samples: PriceSample[],
  now: number,
): AssetMomentum {
  const vel5m = calcVelocity(samples, 300_000, now);
  const vel1h = calcVelocity(samples, 3_600_000, now);
  const accel = calcAcceleration(samples, 300_000, now);

  const direction: AssetMomentum['direction'] =
    Math.abs(vel5m) < FLAT_THRESHOLD ? 'FLAT' : vel5m > 0 ? 'UP' : 'DOWN';

  return {
    symbol,
    velocity5m: vel5m,
    velocity1h: vel1h,
    direction,
    isAccelerating: accel,
    samplesUsed: samples.filter(s => s.timestamp >= now - 300_000).length,
  };
}

/**
 * Main: compute cross-market confirmation signal.
 *
 * @param primarySymbol   Which asset the Polymarket signal is for (e.g. 'BTC')
 * @param primaryDirection The direction of the velocity signal ('UP' | 'DOWN')
 * @param btcSamples      BTC timestamped price history
 * @param ethSamples      ETH timestamped price history (empty = unavailable)
 * @param solSamples      SOL timestamped price history (empty = unavailable)
 */
export function computeCrossMarketSignal(
  primarySymbol: string,
  primaryDirection: 'UP' | 'DOWN',
  btcSamples: PriceSample[],
  ethSamples: PriceSample[],
  solSamples: PriceSample[],
): CrossMarketSignal {
  const now = Date.now();

  const btcMomentum = getAssetMomentum('BTC', btcSamples, now);
  const ethMomentum = getAssetMomentum('ETH', ethSamples, now);
  const solMomentum = getAssetMomentum('SOL', solSamples, now);

  const assets = [btcMomentum, ethMomentum, solMomentum];

  // Count how many assets agree with the primary direction
  const agreeing = assets.filter(
    a => a.samplesUsed >= 2 && a.direction === primaryDirection,
  );
  const available = assets.filter(a => a.samplesUsed >= 2);
  const agreementCount = agreeing.length;
  const allAccelerating = agreeing.every(a => a.isAccelerating);

  // Classify strength
  let strength: ConfirmationStrength;
  let edgeMultiplier: number;

  if (available.length <= 1) {
    // Only one asset available — can't confirm
    strength = 'WEAK';
    edgeMultiplier = 1.0;
  } else if (agreementCount === available.length && agreementCount >= 2) {
    // All available assets agree
    strength = allAccelerating ? 'STRONG' : 'MODERATE';
    edgeMultiplier = allAccelerating ? 1.5 : 1.25;
  } else if (agreementCount >= Math.ceil(available.length / 2)) {
    // Majority agree
    strength = 'MODERATE';
    edgeMultiplier = 1.1;
  } else {
    // Diverging — fewer than half agree
    strength = 'DIVERGING';
    edgeMultiplier = 0.5; // Penalty for divergence
  }

  return {
    primarySymbol,
    primaryDirection,
    assets,
    agreementCount,
    strength,
    allAccelerating,
    edgeMultiplier,
    computedAt: now,
  };
}
