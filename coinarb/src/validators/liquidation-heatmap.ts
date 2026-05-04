/**
 * Liquidation heatmap validator — STUB.
 *
 * Coinglass would supply per-tick aggregated liquidation levels (price bands
 * where leveraged longs/shorts get force-closed), which act as magnet zones
 * for spot price action.
 *
 * Until COINGLASS_API_KEY is set in Fly secrets, this returns null so the
 * loop's enter/skip logic can treat liquidation context as unknown rather
 * than blocking trades on missing data.
 */

import type { Symbol } from '../core/config.js';

export interface LiquidationLevel {
  symbol: Symbol;
  price: number;
  side: 'long' | 'short';
  notionalUsd: number;
}

export interface LiquidationHeatmap {
  available: boolean;
  levels: LiquidationLevel[];
  nearestLong: number | null;
  nearestShort: number | null;
}

export async function fetchLiquidationHeatmap(symbol: Symbol, currentPrice: number): Promise<LiquidationHeatmap> {
  void symbol;
  void currentPrice;
  if (!process.env.COINGLASS_API_KEY) {
    return { available: false, levels: [], nearestLong: null, nearestShort: null };
  }
  // TODO: wire Coinglass v3 /liquidation/heatmap endpoint here.
  return { available: false, levels: [], nearestLong: null, nearestShort: null };
}
