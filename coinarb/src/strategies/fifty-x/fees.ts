/**
 * Per-venue fee model. Used to populate `coinarb_trades.fee_usd` so that
 * realised PnL is net of trading costs rather than the gross USD move.
 *
 * Coinbase Advanced (spot, US):  maker 0.40% / taker 0.60% per side
 * Coinbase International (perp): maker 0.02% / taker 0.08% per side
 *
 * The loop runs `post_only` by default, so the maker rate applies on both
 * the entry and the exit. We accept `isMaker` as a parameter so a future
 * taker fallback can pass `false`.
 */

import type { Venue } from '../../trading/coinarb-positions.js';

export const FEE_BPS = {
  spot: { maker: 40, taker: 60 },
  perp: { maker: 2,  taker: 8  },
} as const;

export function estimateFeeUsd(
  venue: Venue,
  notionalUsd: number,
  isMaker: boolean,
): number {
  if (!Number.isFinite(notionalUsd) || notionalUsd <= 0) return 0;
  const table = FEE_BPS[venue];
  const bps = isMaker ? table.maker : table.taker;
  return (notionalUsd * bps) / 10_000;
}
