/**
 * Multi-source spot consensus.
 *
 * Pure function — given a list of (source, price, ageMs) snapshots, returns:
 *   - price        : median of fresh sources
 *   - dispersionBps: max-min spread relative to median, in basis points
 *   - sources      : count of fresh sources used
 *   - usedSources  : labels of the sources that survived freshness filter
 *
 * Returns null when zero sources are fresh — caller must fail-closed.
 *
 * Why median (not mean): Coinbase + Binance is a 2-source case where mean and
 * median coincide, but the API also accepts 3+ sources for forward-compat
 * (Kraken / OKX). With 3 sources, median rejects a single outlier (e.g. one
 * exchange momentarily dislocated by a fat-finger fill) without manual
 * thresholding.
 */

export interface SpotSample {
  source: string;
  price: number;
  ageMs: number;
}

export interface ConsensusSpot {
  price: number;
  dispersionBps: number;
  sources: number;
  usedSources: string[];
}

const DEFAULT_MAX_AGE_MS = 5_000;

export function computeConsensusSpot(
  samples: SpotSample[],
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): ConsensusSpot | null {
  const fresh = samples.filter(s => s.ageMs <= maxAgeMs && Number.isFinite(s.price) && s.price > 0);
  if (fresh.length === 0) return null;

  const prices = fresh.map(s => s.price).sort((a, b) => a - b);
  const median =
    prices.length % 2 === 1
      ? prices[(prices.length - 1) / 2]
      : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;

  const min = prices[0];
  const max = prices[prices.length - 1];
  const dispersionBps = median > 0 ? ((max - min) / median) * 10_000 : 0;

  return {
    price: median,
    dispersionBps,
    sources: fresh.length,
    usedSources: fresh.map(s => s.source),
  };
}
