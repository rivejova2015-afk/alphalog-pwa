/**
 * B4 — Sentiment vs Price Divergence
 *
 * When the crowd sentiment (Fear & Greed) says one thing but the market is doing
 * the opposite, it signals a high-conviction contrarian opportunity:
 *
 *   F&G < 35 (Fear) but BTC is trending UP → market is climbing a wall of worry
 *   F&G > 65 (Greed) but BTC is trending DOWN → distribution under euphoria
 *
 * Neither Velocity nor Fundamental cross these dimensions today.
 */

import type { FearGreedComponent } from '../analysis/types.js';

export interface DivergenceSignal {
  divergenceActive: boolean;
  direction: 'CONTRARIAN_BULLISH' | 'CONTRARIAN_BEARISH' | null;
  fearGreedValue: number;
  priceDirection15m: 'UP' | 'DOWN' | 'FLAT';
  priceChange15mPct: number;  // % change in last 15 min
  strength: number;           // 0-1
  confidence: number;         // 0-1
}

const FEAR_THRESHOLD     = 35;   // F&G below = "Fear"
const GREED_THRESHOLD    = 65;   // F&G above = "Greed"
const PRICE_MOVE_THRESHOLD = 0.005; // 0.5% min 15m move to confirm trend

export function computeDivergenceSignal(
  fearGreed: FearGreedComponent | null,
  priceHistory: number[],   // BTC price samples, newest last
): DivergenceSignal {
  const noSignal: DivergenceSignal = {
    divergenceActive: false,
    direction: null,
    fearGreedValue: fearGreed?.value ?? 50,
    priceDirection15m: 'FLAT',
    priceChange15mPct: 0,
    strength: 0,
    confidence: 0,
  };

  if (!fearGreed || priceHistory.length < 20) return noSignal;

  // 15-min price change: last 180 samples at 250ms each = 45s, need to scale
  // We use what's available — at least 20 samples = 5s of data
  // For true 15m we'd need priceHistoryWindowMs data; use available window
  const windowEnd = priceHistory[priceHistory.length - 1];
  const windowStart = priceHistory[Math.max(0, priceHistory.length - 60)]; // ~15s at 250ms
  const priceChange15mPct = windowStart > 0
    ? (windowEnd - windowStart) / windowStart
    : 0;

  let priceDirection15m: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
  if (priceChange15mPct > PRICE_MOVE_THRESHOLD)  priceDirection15m = 'UP';
  if (priceChange15mPct < -PRICE_MOVE_THRESHOLD) priceDirection15m = 'DOWN';

  if (priceDirection15m === 'FLAT') return { ...noSignal, priceChange15mPct, fearGreedValue: fearGreed.value };

  const fgVal = fearGreed.value;
  let divergenceActive = false;
  let direction: 'CONTRARIAN_BULLISH' | 'CONTRARIAN_BEARISH' | null = null;

  // Contrarian bullish: F&G says Fear, market says UP
  if (fgVal < FEAR_THRESHOLD && priceDirection15m === 'UP') {
    divergenceActive = true;
    direction = 'CONTRARIAN_BULLISH';
  }
  // Contrarian bearish: F&G says Greed, market says DOWN
  else if (fgVal > GREED_THRESHOLD && priceDirection15m === 'DOWN') {
    divergenceActive = true;
    direction = 'CONTRARIAN_BEARISH';
  }

  if (!divergenceActive) return { ...noSignal, priceChange15mPct, priceDirection15m, fearGreedValue: fgVal };

  // Strength: product of sentiment extreme and price move magnitude
  const sentimentExtreme = Math.abs(fgVal - 50) / 50;
  const priceMagnitude   = Math.min(1, Math.abs(priceChange15mPct) / 0.02);
  const strength = Math.min(1, sentimentExtreme * priceMagnitude * 2);
  const confidence = strength;

  return {
    divergenceActive,
    direction,
    fearGreedValue: fgVal,
    priceDirection15m,
    priceChange15mPct,
    strength,
    confidence,
  };
}
