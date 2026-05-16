/**
 * Candle builder — folds tick samples into per-timeframe OHLCV candles.
 *
 * Source data: PriceSample[] from coinbase-ws / binance-ws (1h timestamped
 * buffer per asset). We bucket samples into TF windows aligned to UTC, then
 * publish a closed candle once a window rolls over.
 *
 * Volume is NOT available from ticker streams, so candles report v=0 and we
 * rely on volume-delta/volume-profile validators to fetch it from REST when
 * needed.
 */

import type { PriceSample } from '../feeds/coinbase-ws.js';
import type { Timeframe } from '../core/config.js';

export interface Candle {
  timeframe: Timeframe;
  openTs: number;   // ms, aligned to TF bucket start (UTC)
  closeTs: number;  // ms, openTs + bucketMs
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const TF_MS: Record<Timeframe, number> = {
  '1D': 86_400_000,
  '4H': 14_400_000,
  '1H':  3_600_000,
  '30M': 1_800_000,
  '15M':   900_000,
  '5M':    300_000,
  '1M':     60_000,
};

/**
 * Build candles from a sample buffer for the requested timeframes.
 * Returns the most recent N closed candles per TF (configurable).
 *
 * Note: with a 1h buffer, you can reliably build ~60 1M candles, ~12 5M,
 * ~4 15M, ~2 30M, ~1 1H, and at most a partial 4H/1D. Higher TFs are
 * intentionally synthesized from the available window — good enough for
 * recency bias, not for backtesting.
 */
export function buildCandles(
  samples: readonly PriceSample[],
  timeframe: Timeframe,
  maxCandles: number = 60,
): Candle[] {
  if (samples.length === 0) return [];
  const bucketMs = TF_MS[timeframe];
  const now = Date.now();
  const earliestBucket = bucketStart(samples[0].timestamp, bucketMs);
  const currentBucket = bucketStart(now, bucketMs);

  const candles: Candle[] = [];
  for (let bucket = earliestBucket; bucket < currentBucket; bucket += bucketMs) {
    const next = bucket + bucketMs;
    const window = samples.filter((s) => s.timestamp >= bucket && s.timestamp < next);
    if (window.length === 0) continue;

    const open = window[0].price;
    const close = window[window.length - 1].price;
    let high = open;
    let low = open;
    for (const s of window) {
      if (s.price > high) high = s.price;
      if (s.price < low) low = s.price;
    }

    candles.push({
      timeframe,
      openTs: bucket,
      closeTs: next,
      open,
      high,
      low,
      close,
      volume: 0,
    });
  }

  return candles.slice(-maxCandles);
}

function bucketStart(ts: number, bucketMs: number): number {
  return Math.floor(ts / bucketMs) * bucketMs;
}

/** Convenience: build all 7 TFs at once */
export function buildAllTimeframes(
  samples: readonly PriceSample[],
  timeframes: readonly Timeframe[],
): Map<Timeframe, Candle[]> {
  const out = new Map<Timeframe, Candle[]>();
  for (const tf of timeframes) {
    out.set(tf, buildCandles(samples, tf));
  }
  return out;
}

// ============================================================
// CARGA HISTÓRICA — Coinbase Exchange API pública (sin auth)
// ============================================================

// Granularidades nativas en segundos de api.exchange.coinbase.com
// 4H y 30M NO existen — se sintetizan desde 1H y 15M respectivamente
const EXCHANGE_GRANULARITY_SEC: Partial<Record<Timeframe, number>> = {
  '1D':  86400,
  '1H':  3600,
  '15M': 900,
  '5M':  300,
  '1M':  60,
};

// TFs que necesitan síntesis (no existen en la API)
const SYNTHETIC_TF: Partial<Record<Timeframe, { sourceTf: Timeframe; groupBy: number }>> = {
  '4H':  { sourceTf: '1H',  groupBy: 4 },
  '30M': { sourceTf: '15M', groupBy: 2 },
};

/** Pausa entre requests para respetar rate limit de la API pública */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Descarga velas desde Coinbase Exchange API pública (sin autenticación).
 * Endpoint: https://api.exchange.coinbase.com/products/{symbol}/candles
 * Formato respuesta: [[timestamp_unix, low, high, open, close, volume], ...]
 * Más reciente primero — se invierte al procesar.
 */
export async function fetchExchangeCandles(
  symbol: string,       // 'BTC-USD', 'ETH-USD', 'SOL-USD'
  granularitySec: number,
  neededCandles: number,
): Promise<Candle[]> {
  const bucketMs = granularitySec * 1000;
  const now = Date.now();
  // La API acepta máximo 300 velas por request
  const maxPerRequest = 300;
  const allCandles: Candle[] = [];
  let endSec = Math.floor(now / 1000);

  // Paginar hacia atrás hasta tener suficientes velas
  while (allCandles.length < neededCandles) {
    const startSec = endSec - maxPerRequest * granularitySec;
    const url =
      `https://api.exchange.coinbase.com/products/${symbol}/candles` +
      `?granularity=${granularitySec}&start=${startSec}&end=${endSec}`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      console.warn(`[candle-builder] exchange API ${granularitySec}s HTTP ${res.status} for ${symbol}`);
      break;
    }

    // Respuesta: [[ts, low, high, open, close, volume], ...]
    const raw = await res.json() as Array<[number, number, number, number, number, number]>;
    if (!Array.isArray(raw) || raw.length === 0) break;

    // Convertir y ordenar cronológicamente (la API devuelve más reciente primero)
    const batch: Candle[] = raw
      .map(([ts, low, high, open, close, volume]) => ({
        timeframe: '1M' as Timeframe, // placeholder, se sobreescribe abajo
        openTs: ts * 1000,
        closeTs: ts * 1000 + bucketMs,
        open,
        high,
        low,
        close,
        volume,
      }))
      .sort((a, b) => a.openTs - b.openTs);

    allCandles.unshift(...batch);
    endSec = startSec;

    await sleep(120); // respetar rate limit

    if (raw.length < maxPerRequest) break; // no hay más datos disponibles
  }

  return allCandles.slice(-neededCandles);
}

/**
 * Sintetiza un timeframe mayor a partir de velas de menor granularidad.
 * Ejemplo: 4H = agrupar 4 velas de 1H | 30M = agrupar 2 velas de 15M
 */
function synthesizeCandles(
  sourceCandles: Candle[],
  groupBy: number,
  targetTf: Timeframe,
): Candle[] {
  const result: Candle[] = [];
  // Solo agrupar velas completas
  const trimmed = sourceCandles.slice(0, Math.floor(sourceCandles.length / groupBy) * groupBy);

  for (let i = 0; i < trimmed.length; i += groupBy) {
    const group = trimmed.slice(i, i + groupBy);
    if (group.length < groupBy) break;

    result.push({
      timeframe: targetTf,
      openTs:   group[0].openTs,
      closeTs:  group[group.length - 1].closeTs,
      open:     group[0].open,
      high:     Math.max(...group.map(c => c.high)),
      low:      Math.min(...group.map(c => c.low)),
      close:    group[group.length - 1].close,
      volume:   group.reduce((sum, c) => sum + c.volume, 0),
    });
  }

  return result;
}

/**
 * Carga velas históricas para todos los timeframes usando
 * Coinbase Exchange API pública (sin autenticación).
 *
 * - 1D, 1H, 15M, 5M, 1M: descarga directa
 * - 4H: sintetizado desde 1H (4 velas → 1 vela 4H)
 * - 30M: sintetizado desde 15M (2 velas → 1 vela 30M)
 *
 * Llamar UNA VEZ al arranque y cada 4 horas.
 * No requiere credenciales CDP ni variables de entorno adicionales.
 */
/**
 * Default per-TF candle count for the live bot (warmup window). Overridable
 * via loadHistoricalCandlesForDays for backtests that need deeper history.
 */
const DEFAULT_TARGET_PER_TF = 200;

export async function loadHistoricalCandles(
  symbol: string,
  timeframes: readonly Timeframe[],
): Promise<Map<Timeframe, Candle[]>> {
  return loadHistoricalCandlesWithTarget(symbol, timeframes, DEFAULT_TARGET_PER_TF);
}

/**
 * Convenience helper for backtests. `days=30` → 30 days of candles per TF
 * (e.g. 1M = 43200 rows, 1D = 30 rows). Pagination via fetchExchangeCandles
 * handles the 300-per-request Coinbase Exchange limit transparently.
 *
 * Hard limits: 1M is capped at 7d (10080 candles) to keep one symbol load
 * under ~30s and avoid running into hourly rate limits.
 */
export async function loadHistoricalCandlesForDays(
  symbol: string,
  timeframes: readonly Timeframe[],
  days: number,
): Promise<Map<Timeframe, Candle[]>> {
  const target = (tf: Timeframe): number => {
    const granSec = EXCHANGE_GRANULARITY_SEC[tf] ?? 86400;  // synth TFs hit their source's helper
    const ideal = Math.ceil((days * 86400) / granSec);
    // 1m intra-day data balloons fast; cap to a 7-day rolling window.
    if (tf === '1M') return Math.min(ideal, 10_080);
    return ideal;
  };
  // Compute per-TF target before delegating so the helper has uniform shape.
  return loadHistoricalCandlesWithTarget(symbol, timeframes, undefined, target);
}

async function loadHistoricalCandlesWithTarget(
  symbol: string,
  timeframes: readonly Timeframe[],
  staticTarget: number | undefined,
  dynamicTarget?: (tf: Timeframe) => number,
): Promise<Map<Timeframe, Candle[]>> {
  const result = new Map<Timeframe, Candle[]>();
  const targetFor = (tf: Timeframe): number => dynamicTarget ? dynamicTarget(tf) : (staticTarget ?? DEFAULT_TARGET_PER_TF);

  // Primero descargar los TFs nativos
  for (const tf of timeframes) {
    const synth = SYNTHETIC_TF[tf];
    if (synth) continue;

    const granSec = EXCHANGE_GRANULARITY_SEC[tf];
    if (!granSec) continue;

    try {
      // Para 1H y 15M pedir más para poder sintetizar 4H y 30M
      const extra = tf === '1H' ? 4 : tf === '15M' ? 2 : 1;
      const finalTarget = targetFor(tf);
      const needed = finalTarget * extra;

      const raw = await fetchExchangeCandles(symbol, granSec, needed);
      const candles = raw.map(c => ({ ...c, timeframe: tf }));
      result.set(tf, candles.slice(-finalTarget));

      console.log(`[candle-builder] ${symbol} ${tf}: ${candles.length} candles loaded (target=${finalTarget})`);
      await sleep(150);
    } catch (err) {
      console.warn(`[candle-builder] failed ${tf} for ${symbol}:`, err);
      result.set(tf, []);
    }
  }

  // Sintetizar 4H desde 1H
  if (timeframes.includes('4H')) {
    const target4H = targetFor('4H');
    const source1H = await fetchExchangeCandles(symbol, 3600, target4H * 4)
      .then(raw => raw.map(c => ({ ...c, timeframe: '1H' as Timeframe })))
      .catch(() => [] as Candle[]);
    const synth4H = synthesizeCandles(source1H, 4, '4H');
    result.set('4H', synth4H.slice(-target4H));
    console.log(`[candle-builder] ${symbol} 4H: ${synth4H.length} synthesized candles (target=${target4H})`);
    await sleep(150);
  }

  // Sintetizar 30M desde 15M
  if (timeframes.includes('30M')) {
    const target30M = targetFor('30M');
    const source15M = await fetchExchangeCandles(symbol, 900, target30M * 2)
      .then(raw => raw.map(c => ({ ...c, timeframe: '15M' as Timeframe })))
      .catch(() => [] as Candle[]);
    const synth30M = synthesizeCandles(source15M, 2, '30M');
    result.set('30M', synth30M.slice(-target30M));
    console.log(`[candle-builder] ${symbol} 30M: ${synth30M.length} synthesized candles (target=${target30M})`);
  }

  return result;
}

/**
 * Fusiona velas históricas con velas realtime del WebSocket.
 * El realtime tiene prioridad para las velas más recientes.
 */
export function mergeWithRealtimeCandles(
  historical: Map<Timeframe, Candle[]>,
  realtime: Map<Timeframe, Candle[]>,
): Map<Timeframe, Candle[]> {
  const merged = new Map<Timeframe, Candle[]>();

  for (const [tf, histCandles] of historical) {
    const rtCandles = realtime.get(tf) ?? [];
    if (rtCandles.length === 0) {
      merged.set(tf, histCandles);
      continue;
    }
    const rtEarliestTs = rtCandles[0].openTs;
    const filteredHist = histCandles.filter(c => c.openTs < rtEarliestTs);
    merged.set(tf, [...filteredHist, ...rtCandles].slice(-200));
  }

  // TFs que solo están en realtime (sin histórico)
  for (const [tf, rtCandles] of realtime) {
    if (!merged.has(tf)) merged.set(tf, rtCandles);
  }

  return merged;
}
