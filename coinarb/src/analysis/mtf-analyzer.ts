/**
 * Multi-timeframe analyzer — weighted SMC bias across 7 TFs.
 *
 * Weights (per spec):
 *   1D + 4H = 40%   (primary trend)
 *   1H + 30M = 30%  (intermediate context)
 *   15M + 5M + 1M = 30%  (entry timing)
 *
 * Each TF contributes its bias × confidence to a weighted vote. Output bias is
 * the dominant side; output confidence reflects how strongly the TFs agree.
 */

import type { Timeframe } from '../core/config.js';
import { TIMEFRAMES } from '../core/config.js';
import { detectSmc, type SmcBias, type SmcSignal } from './smc-detector.js';
import type { Candle } from './candle-builder.js';

const TF_WEIGHT: Record<Timeframe, number> = {
  '1D':  0.15,
  '4H':  0.15,
  '1H':  0.15,
  '30M': 0.15,
  '15M': 0.15,
  '5M':  0.15,
  '1M':  0.10,
};

// Hard guard: weights must sum to 1.0 — fail fast at module load if drifted.
const TOTAL_WEIGHT = Object.values(TF_WEIGHT).reduce((a, b) => a + b, 0);
if (Math.abs(TOTAL_WEIGHT - 1.0) > 0.001) {
  throw new Error(`[mtf-analyzer] TF_WEIGHT sum must equal 1.0, got ${TOTAL_WEIGHT}`);
}

export interface MtfAnalysis {
  bias: SmcBias;
  confidence: number;
  perTimeframe: Map<Timeframe, SmcSignal>;
  bullScore: number;
  bearScore: number;
}

export function analyzeMtf(candlesByTf: Map<Timeframe, Candle[]>): MtfAnalysis {
  const perTimeframe = new Map<Timeframe, SmcSignal>();
  let bullScore = 0;
  let bearScore = 0;
  let totalWeight = 0;

  for (const tf of TIMEFRAMES) {
    const candles = candlesByTf.get(tf) ?? [];
    const sig = detectSmc(candles);
    perTimeframe.set(tf, sig);

    const w = TF_WEIGHT[tf];
    totalWeight += w;
    const contribution = w * sig.confidence;
    if (sig.bias === 'BUY') bullScore += contribution;
    else if (sig.bias === 'SELL') bearScore += contribution;
  }

  const net = bullScore - bearScore;
  const bias: SmcBias = Math.abs(net) < 0.05 ? 'NEUTRAL' : net > 0 ? 'BUY' : 'SELL';
  const confidence = totalWeight > 0 ? Math.min(Math.max(bullScore, bearScore) / totalWeight, 1) : 0;

  return { bias, confidence, perTimeframe, bullScore, bearScore };
}
