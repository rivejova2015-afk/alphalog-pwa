/**
 * A2 — Orderbook Depth Imbalance
 *
 * Sentiment Pulse uses only best bid/ask size.
 * This engine analyzes the top 5 levels on each side of the CLOB.
 *
 * Large bid-side dominance = real buying pressure accumulating at multiple price levels.
 * Not a single-level anomaly (easier to spoof) but a structural imbalance.
 */

import type { DepthLevel } from '../feeds/polymarket-ws.js';

export interface DepthSignal {
  bidDepth: number;          // total size across top 5 bid levels
  askDepth: number;          // total size across top 5 ask levels
  imbalanceRatio: number;    // bidDepth / (bidDepth + askDepth), 0-1
  signal: 'BUY_PRESSURE' | 'SELL_PRESSURE' | 'NEUTRAL';
  confidence: number;        // |ratio - 0.5| × 2, 0-1
}

const IMBALANCE_THRESHOLD = 0.15; // |ratio - 0.5| must exceed this to signal
const MAX_LEVELS = 5;

export function computeDepthSignal(
  bidLevels: DepthLevel[],
  askLevels: DepthLevel[],
): DepthSignal {
  if (bidLevels.length === 0 || askLevels.length === 0) {
    return { bidDepth: 0, askDepth: 0, imbalanceRatio: 0.5, signal: 'NEUTRAL', confidence: 0 };
  }

  const bidDepth = bidLevels.slice(0, MAX_LEVELS).reduce((s, l) => s + l.size, 0);
  const askDepth = askLevels.slice(0, MAX_LEVELS).reduce((s, l) => s + l.size, 0);
  const total = bidDepth + askDepth;

  if (total === 0) {
    return { bidDepth: 0, askDepth: 0, imbalanceRatio: 0.5, signal: 'NEUTRAL', confidence: 0 };
  }

  const imbalanceRatio = bidDepth / total;
  const deviation = Math.abs(imbalanceRatio - 0.5);
  const confidence = Math.min(1, deviation * 2);

  let signal: 'BUY_PRESSURE' | 'SELL_PRESSURE' | 'NEUTRAL' = 'NEUTRAL';
  if (deviation > IMBALANCE_THRESHOLD) {
    signal = imbalanceRatio > 0.5 ? 'BUY_PRESSURE' : 'SELL_PRESSURE';
  }

  return { bidDepth, askDepth, imbalanceRatio, signal, confidence };
}
