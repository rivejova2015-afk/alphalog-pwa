/**
 * Multi-Source Confluence Engine.
 *
 * Combines three orthogonal directional signals into a single decision:
 *   - Spot:  velocity-detector adjustedFairProb vs midprice (already in loop)
 *   - Perp:  Binance Perpetuals (funding + OI delta + markprice trend)
 *   - IV:    Deribit derivatives (basis + funding from BTC/ETH-PERPETUAL)
 *
 * Pure function — no I/O, no throws. Designed as the pre-gate before the
 * existing 5-layer validator. Fails CLOSED: if perp or IV signal is missing
 * or stale, the engine refuses to authorise a trade.
 *
 * Sizing override: kellyCapUsd scales with the number of agreeing sources.
 *   1 source agrees → $25 cap
 *   2 sources agree → $50 cap
 *   3 sources agree → $100 cap
 */

import type { PerpSignal } from '../feeds/binance-perp-ws.js';
import type { IVSignal } from '../feeds/deribit-iv-ws.js';

export type Direction = 'UP' | 'DOWN' | 'NEUTRAL';

export interface ConfluenceInput {
  /** Direction implied by velocity-detector (sign of adjustedFairProb - midPrice). */
  spotDirection: Direction;
  /** Latest Binance perpetual signal — null = source unavailable. */
  perpSignal: PerpSignal | null;
  /** Latest Deribit derivatives signal — null = source unavailable. */
  ivSignal: IVSignal | null;
  /** True if the loop intends to BUY YES (gap > 0). */
  buyYes: boolean;
}

export interface ConfluenceResult {
  /** Number of sources that produced a directional (non-NEUTRAL) vote (0..3). NEUTRAL means online but no opinion. */
  sourcesAvailable: 0 | 1 | 2 | 3;
  /** Number of sources whose direction matches the majority (0..3). NEUTRAL never counts. */
  sourcesAgreeing: 0 | 1 | 2 | 3;
  /** Majority direction across the agreeing sources. NEUTRAL when there is no plurality. */
  agreedDirection: Direction;
  /** True when any source is null or stale. Forces SKIP. */
  failClosed: boolean;
  /** Human-readable reason for failClosed. Empty when failClosed=false. */
  failReason: string | null;
  /** Hard sizing cap in USD. 0 when failClosed. 25/50/100 by agreeing-count otherwise. */
  kellyCapUsd: number;
  /** True when agreedDirection maps to the loop's buyYes choice. */
  matchesBuyDirection: boolean;
}

const KELLY_CAP_BY_AGREEING: Record<1 | 2 | 3, number> = {
  1: 25,
  2: 50,
  3: 100,
};

export function evaluateConfluence(input: ConfluenceInput): ConfluenceResult {
  const failReasons: string[] = [];

  // Fail-closed checks
  if (input.perpSignal === null) failReasons.push('perp_signal_missing');
  else if (input.perpSignal.isStale) failReasons.push(`perp_signal_stale_${input.perpSignal.ageMs}ms`);

  if (input.ivSignal === null) failReasons.push('iv_signal_missing');
  else if (input.ivSignal.isStale) failReasons.push(`iv_signal_stale_${input.ivSignal.ageMs}ms`);

  if (failReasons.length > 0) {
    return {
      sourcesAvailable: 0,
      sourcesAgreeing: 0,
      agreedDirection: 'NEUTRAL',
      failClosed: true,
      failReason: failReasons.join(','),
      kellyCapUsd: 0,
      matchesBuyDirection: false,
    };
  }

  // perpSignal and ivSignal are guaranteed non-null after the fail-closed branch.
  const perpDir = input.perpSignal!.direction;
  const ivDir = input.ivSignal!.direction;

  // Source availability counts sources that produced a directional vote
  // (non-NEUTRAL). NEUTRAL means "the source is online but has no opinion",
  // so it should not inflate the availability count — otherwise downstream
  // analytics cannot distinguish "spot was flat" from "spot disagreed".
  let sourcesAvailableCount = 0;
  if (input.spotDirection !== 'NEUTRAL') sourcesAvailableCount++;
  if (perpDir !== 'NEUTRAL') sourcesAvailableCount++;
  if (ivDir !== 'NEUTRAL') sourcesAvailableCount++;
  const sourcesAvailable = sourcesAvailableCount as 0 | 1 | 2 | 3;

  // Tally per direction across all 3 sources
  let upVotes = 0;
  let downVotes = 0;
  if (input.spotDirection === 'UP') upVotes++;
  else if (input.spotDirection === 'DOWN') downVotes++;
  if (perpDir === 'UP') upVotes++;
  else if (perpDir === 'DOWN') downVotes++;
  if (ivDir === 'UP') upVotes++;
  else if (ivDir === 'DOWN') downVotes++;

  let agreedDirection: Direction = 'NEUTRAL';
  let sourcesAgreeing: 0 | 1 | 2 | 3 = 0;
  if (upVotes > downVotes) {
    agreedDirection = 'UP';
    sourcesAgreeing = upVotes as 0 | 1 | 2 | 3;
  } else if (downVotes > upVotes) {
    agreedDirection = 'DOWN';
    sourcesAgreeing = downVotes as 0 | 1 | 2 | 3;
  }

  const kellyCapUsd =
    sourcesAgreeing === 1 ? KELLY_CAP_BY_AGREEING[1]
    : sourcesAgreeing === 2 ? KELLY_CAP_BY_AGREEING[2]
    : sourcesAgreeing === 3 ? KELLY_CAP_BY_AGREEING[3]
    : 0;

  const matchesBuyDirection =
    (agreedDirection === 'UP' && input.buyYes) ||
    (agreedDirection === 'DOWN' && !input.buyYes);

  return {
    sourcesAvailable,
    sourcesAgreeing,
    agreedDirection,
    failClosed: false,
    failReason: null,
    kellyCapUsd,
    matchesBuyDirection,
  };
}
