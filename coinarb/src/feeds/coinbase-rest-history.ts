/**
 * Coinbase REST historic candle cache.
 *
 * The WS feeds only buffer ~1h of ticks, which is not enough to build
 * 1H/4H/1D candles. This module pulls OHLC from the Coinbase Advanced REST
 * `/products/{symbol}/candles` endpoint and caches them per (symbol, TF),
 * refreshing on a TF-aware schedule so the loop always has real higher-TF
 * structure available.
 */

import { fetchHistoricCandles } from '../analysis/liquidity-map.js';
import type { Candle } from '../analysis/candle-builder.js';
import { SYMBOLS, type Symbol, type Timeframe } from '../core/config.js';

const GRANULARITY_BY_TF: Record<Timeframe, number> = {
  '1M':       60,
  '5M':      300,
  '15M':     900,
  '30M':    1800,
  '1H':     3600,
  // Coinbase Advanced does not expose 4H natively — synthesize from 1H below.
  '4H':     3600,
  '1D':    86400,
};

const REFRESH_MS_BY_TF: Record<Timeframe, number> = {
  '1M':       60_000,
  '5M':      300_000,
  '15M':     900_000,
  '30M':   1_800_000,
  '1H':    3_600_000,
  '4H':    3_600_000,    // refresh source 1H every hour, re-aggregate
  '1D':   86_400_000,
};

const CANDLE_COUNT = 200;

interface CacheEntry {
  candles: Candle[];
  fetchedAt: number;
  inFlight: Promise<Candle[]> | null;
}

class CoinbaseRestHistory {
  private readonly cache = new Map<string, CacheEntry>();

  async get(symbol: Symbol, tf: Timeframe): Promise<Candle[]> {
    const key = `${symbol}:${tf}`;
    const now = Date.now();
    const entry = this.cache.get(key);
    const refreshMs = REFRESH_MS_BY_TF[tf];

    if (entry && now - entry.fetchedAt < refreshMs && entry.candles.length > 0) {
      return entry.candles;
    }
    if (entry?.inFlight) {
      return entry.inFlight;
    }

    const fetchPromise = this.fetch(symbol, tf).then((candles) => {
      this.cache.set(key, { candles, fetchedAt: Date.now(), inFlight: null });
      return candles;
    }).catch((err) => {
      console.error(`[coinbase-rest-history] ${key} fetch failed:`, err);
      const stale = this.cache.get(key);
      if (stale) stale.inFlight = null;
      return entry?.candles ?? [];
    });

    this.cache.set(key, {
      candles: entry?.candles ?? [],
      fetchedAt: entry?.fetchedAt ?? 0,
      inFlight: fetchPromise,
    });
    return fetchPromise;
  }

  async warmup(): Promise<void> {
    const tfs: Timeframe[] = ['1H', '4H', '1D', '15M', '5M'];
    const tasks: Promise<unknown>[] = [];
    for (const symbol of SYMBOLS) {
      for (const tf of tfs) {
        tasks.push(this.get(symbol, tf));
      }
    }
    await Promise.all(tasks);
    console.log(`[coinbase-rest-history] warmup complete (${SYMBOLS.length} symbols × ${tfs.length} TFs)`);
  }

  private async fetch(symbol: Symbol, tf: Timeframe): Promise<Candle[]> {
    const granularity = GRANULARITY_BY_TF[tf];
    const raw = await fetchHistoricCandles(symbol, granularity, CANDLE_COUNT);
    const sourceCandles: Candle[] = raw.map((c) => ({
      timeframe: tf === '4H' ? '1H' : tf,
      openTs: c.start * 1000,
      closeTs: (c.start + granularity) * 1000,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    if (tf === '4H') {
      const aggregated = aggregateToFourHour(sourceCandles);
      console.log(`[coinbase-rest-history] ${symbol} 4H: ${aggregated.length} candles aggregated from 1H`);
      return aggregated;
    }

    console.log(`[coinbase-rest-history] ${symbol} ${tf}: ${sourceCandles.length} candles loaded`);
    return sourceCandles;
  }
}

function aggregateToFourHour(hourly: Candle[]): Candle[] {
  if (hourly.length === 0) return [];
  const bucketMs = 14_400_000;
  const groups = new Map<number, Candle[]>();
  for (const c of hourly) {
    const bucket = Math.floor(c.openTs / bucketMs) * bucketMs;
    const arr = groups.get(bucket) ?? [];
    arr.push(c);
    groups.set(bucket, arr);
  }

  const out: Candle[] = [];
  const sortedBuckets = [...groups.keys()].sort((a, b) => a - b);
  for (const bucket of sortedBuckets) {
    const window = groups.get(bucket)!;
    if (window.length === 0) continue;
    window.sort((a, b) => a.openTs - b.openTs);
    out.push({
      timeframe: '4H',
      openTs: bucket,
      closeTs: bucket + bucketMs,
      open: window[0].open,
      high: Math.max(...window.map((c) => c.high)),
      low: Math.min(...window.map((c) => c.low)),
      close: window[window.length - 1].close,
      volume: window.reduce((s, c) => s + c.volume, 0),
    });
  }
  return out;
}

export const coinbaseRestHistory = new CoinbaseRestHistory();
