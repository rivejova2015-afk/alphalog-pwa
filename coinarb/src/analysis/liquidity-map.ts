/**
 * Liquidity map — fetches recent OHLC from Coinbase Advanced REST and writes
 * notable liquidity zones (swing highs/lows, EQH/EQL clusters) to
 * coinarb_liquidity_map. The dashboard's heatmap reads this table.
 *
 * Refreshed once per loop tick (1 min). Cheap: a single GET per symbol.
 */

import { COINARB_AGENT_ID, COINARB_USER_ID, type Symbol, type Timeframe } from '../core/config.js';
import { getSupabase } from '../supabase.js';

interface CandleRest {
  start: number;
  low: number;
  high: number;
  open: number;
  close: number;
  volume: number;
}

const COINBASE_REST = 'https://api.exchange.coinbase.com';

export type ZoneType = 'EQH' | 'EQL' | 'SWING_HIGH' | 'SWING_LOW';

export interface LiquidityZone {
  symbol: Symbol;
  timeframe: Timeframe;
  zoneType: ZoneType;
  priceTop: number;
  priceBottom: number;
  strength: number;
}

const GRANULARITY_BY_TF: Partial<Record<Timeframe, number>> = {
  '1H': 3600,
  '4H': 14400,
  '1D': 86400,
};

export async function fetchHistoricCandles(
  symbol: Symbol,
  granularitySec: number,
  count = 200,
): Promise<CandleRest[]> {
  const url = `${COINBASE_REST}/products/${symbol}/candles?granularity=${granularitySec}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'coinarb/1.0' } });
  if (!res.ok) throw new Error(`[liquidity-map] coinbase REST ${res.status}`);
  const raw = (await res.json()) as Array<[number, number, number, number, number, number]>;
  return raw
    .slice(0, count)
    .map(([start, low, high, open, close, volume]) => ({ start, low, high, open, close, volume }))
    .sort((a, b) => a.start - b.start);
}

export function detectLiquidityZones(symbol: Symbol, timeframe: Timeframe, candles: CandleRest[]): LiquidityZone[] {
  if (candles.length < 11) return [];
  const out: LiquidityZone[] = [];
  const lookback = 5;

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isSwingHigh = true;
    let isSwingLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].high >= c.high) isSwingHigh = false;
      if (candles[j].low <= c.low) isSwingLow = false;
    }
    if (isSwingHigh) {
      out.push({ symbol, timeframe, zoneType: 'SWING_HIGH', priceBottom: c.high * 0.999, priceTop: c.high * 1.001, strength: 1 });
    }
    if (isSwingLow) {
      out.push({ symbol, timeframe, zoneType: 'SWING_LOW', priceBottom: c.low * 0.999, priceTop: c.low * 1.001, strength: 1 });
    }
  }

  return mergeNearby(out);
}

function mergeNearby(zones: LiquidityZone[]): LiquidityZone[] {
  const merged: LiquidityZone[] = [];
  for (const z of zones) {
    const existing = merged.find(
      (m) => m.symbol === z.symbol && m.timeframe === z.timeframe && m.zoneType === z.zoneType
        && Math.abs((m.priceBottom + m.priceTop) / 2 - (z.priceBottom + z.priceTop) / 2) / ((m.priceBottom + m.priceTop) / 2) < 0.001,
    );
    if (existing) {
      existing.strength += 1;
      existing.priceBottom = Math.min(existing.priceBottom, z.priceBottom);
      existing.priceTop = Math.max(existing.priceTop, z.priceTop);
      if (existing.zoneType === 'SWING_HIGH' && existing.strength > 1) existing.zoneType = 'EQH';
      if (existing.zoneType === 'SWING_LOW' && existing.strength > 1) existing.zoneType = 'EQL';
    } else {
      merged.push({ ...z });
    }
  }
  return merged;
}

export async function refreshLiquidityMap(symbol: Symbol, timeframe: Timeframe = '1H'): Promise<LiquidityZone[]> {
  if (!COINARB_USER_ID) return [];
  const granularity = GRANULARITY_BY_TF[timeframe] ?? 3600;
  try {
    const candles = await fetchHistoricCandles(symbol, granularity, 200);
    const zones = detectLiquidityZones(symbol, timeframe, candles);
    if (zones.length === 0) return zones;

    const supabase = getSupabase();
    await supabase
      .from('coinarb_liquidity_map')
      .delete()
      .eq('agent_id', COINARB_AGENT_ID)
      .eq('symbol', symbol)
      .eq('timeframe', timeframe);

    const rows = zones.map((z) => ({
      user_id: COINARB_USER_ID,
      agent_id: COINARB_AGENT_ID,
      symbol: z.symbol,
      timeframe: z.timeframe,
      zone_type: z.zoneType,
      price_top: z.priceTop,
      price_bottom: z.priceBottom,
      meta: { strength: z.strength },
      detected_at: new Date().toISOString(),
    }));
    await supabase.from('coinarb_liquidity_map').insert(rows);
    return zones;
  } catch (err) {
    console.error(`[liquidity-map] refresh ${symbol} failed:`, err);
    return [];
  }
}
