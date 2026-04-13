/**
 * Regime Detector — Superpower #5
 *
 * Classifies the current market into one of 4 regimes based on BTC
 * price history. The agent switches modes automatically:
 *
 *   CALM      → normal parameters (multiplier 1.0)
 *   TRENDING  → aggressive parameters (multiplier 1.3) — momentum is predictable
 *   VOLATILE  → conservative parameters (multiplier 0.5) — noise dominates
 *   CRISIS    → near-halt (multiplier 0.2) — extreme moves, avoid positions
 *
 * Regime is re-evaluated every tick and stored in telemetry.
 */

import type { PriceSample } from './velocity-detector.js';

export type MarketRegime = 'CALM' | 'TRENDING' | 'VOLATILE' | 'CRISIS';
export type TrendDirection = 'UP' | 'DOWN' | 'SIDEWAYS';

export interface RegimeState {
  regime: MarketRegime;
  volatilityPct: number;     // Realized vol over 1h (annualized %)
  trend: TrendDirection;
  trendStrength: number;     // 0-1
  agentMultiplier: number;   // Scale factor for edge threshold and Kelly
  consistencyScore: number;  // 0-1: how consistent is the current regime signal
  computedAt: number;
}

// Thresholds for regime classification
const VOL_CRISIS    = 120;   // >120% annualized vol = crisis
const VOL_VOLATILE  = 55;    // >55% = volatile
const VOL_CALM_MAX  = 30;    // <30% = calm or trending

// Multipliers per regime
const MULTIPLIERS: Record<MarketRegime, number> = {
  CALM:     1.00,
  TRENDING: 1.30,
  VOLATILE: 0.50,
  CRISIS:   0.20,
};

/**
 * Calculate annualized realized volatility from price samples.
 * Returns percentage (e.g., 45 = 45% annualized vol).
 */
function calcVolatility(samples: PriceSample[], windowMs: number, now: number): number {
  const ws = samples.filter(s => s.timestamp >= now - windowMs);
  if (ws.length < 10) return 0;

  const logReturns: number[] = [];
  for (let i = 1; i < ws.length; i++) {
    if (ws[i - 1].price > 0 && ws[i].price > 0) {
      logReturns.push(Math.log(ws[i].price / ws[i - 1].price));
    }
  }
  if (logReturns.length < 2) return 0;

  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / logReturns.length;
  const stdPerSample = Math.sqrt(variance);

  // Annualize: sqrt(samples_per_year)
  const spanMs = ws[ws.length - 1].timestamp - ws[0].timestamp;
  if (spanMs <= 0) return 0;
  const samplesPerYear = logReturns.length * (365.25 * 24 * 3_600_000 / spanMs);
  const annualizedVol = stdPerSample * Math.sqrt(samplesPerYear) * 100;

  return Math.min(500, annualizedVol); // cap at 500% for sanity
}

/**
 * Detect trend direction and strength from price samples over a window.
 */
function calcTrend(
  samples: PriceSample[],
  windowMs: number,
  now: number
): { trend: TrendDirection; strength: number } {
  const ws = samples.filter(s => s.timestamp >= now - windowMs);
  if (ws.length < 6) return { trend: 'SIDEWAYS', strength: 0 };

  const oldest = ws[0].price;
  const newest = ws[ws.length - 1].price;
  const changePct = (newest - oldest) / oldest * 100;

  // Check consistency: how many sub-windows agree with overall direction
  const chunkSize = Math.floor(ws.length / 4);
  let agreements = 0;
  for (let i = 0; i < 4; i++) {
    const chunkStart = ws[i * chunkSize].price;
    const chunkEnd = ws[Math.min((i + 1) * chunkSize, ws.length - 1)].price;
    const chunkDir = chunkEnd > chunkStart ? 1 : -1;
    const overallDir = changePct > 0 ? 1 : -1;
    if (chunkDir === overallDir) agreements++;
  }
  const consistency = agreements / 4;

  const absChange = Math.abs(changePct);
  const trend: TrendDirection =
    absChange < 0.2 ? 'SIDEWAYS' : changePct > 0 ? 'UP' : 'DOWN';
  const strength = Math.min(1, (absChange / 3) * consistency);

  return { trend, strength };
}

/**
 * Main: detect current market regime from BTC price history.
 */
export function detectRegime(samples: PriceSample[]): RegimeState {
  const now = Date.now();

  // Volatility over different windows
  const vol1h  = calcVolatility(samples, 3_600_000, now);
  const vol15m = calcVolatility(samples,   900_000, now);
  const vol5m  = calcVolatility(samples,   300_000, now);

  // Use weighted blend: 50% 1h, 35% 15m, 15% 5m
  const blendedVol = vol1h * 0.50 + vol15m * 0.35 + vol5m * 0.15;

  // Trend from 1h window
  const { trend, strength: trendStrength } = calcTrend(samples, 3_600_000, now);

  // Consistency: vol readings agree across windows
  const volSpread = Math.abs(vol1h - vol5m);
  const consistencyScore = Math.max(0, 1 - volSpread / (blendedVol + 1));

  // Classify regime
  let regime: MarketRegime;

  if (blendedVol > VOL_CRISIS) {
    regime = 'CRISIS';
  } else if (blendedVol > VOL_VOLATILE) {
    regime = 'VOLATILE';
  } else if (blendedVol <= VOL_CALM_MAX && trendStrength > 0.45 && trend !== 'SIDEWAYS') {
    regime = 'TRENDING';
  } else {
    regime = 'CALM';
  }

  return {
    regime,
    volatilityPct: blendedVol,
    trend,
    trendStrength,
    agentMultiplier: MULTIPLIERS[regime],
    consistencyScore,
    computedAt: now,
  };
}
