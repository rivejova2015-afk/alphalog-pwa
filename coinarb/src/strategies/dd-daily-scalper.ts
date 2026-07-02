/**
 * Daily Direction Scalper (DD) — high-frequency entries aligned to the
 * daily directional bias.
 *
 * Spec confirmada por el owner: 100 ops/día con risk 4% real por trade,
 * R:R = 1.0, killswitch 6 SL consecutivos → pausa hasta siguiente UTC 00:00.
 *
 * Direction bias:
 *   direction = BUY  si price > daily_open × (1 + threshold)
 *   direction = SELL si price < daily_open × (1 - threshold)
 *   direction = NEUTRAL en la dead-zone (no opera)
 *
 *   daily_open = open de la vela cuyo openTs cae en UTC 00:00 del día actual.
 *
 * Entry trigger (cada vela 1m, solo en dirección):
 *   - Pullback: lastClose ≤ EMA20_1m (BUY) o lastClose ≥ EMA20_1m (SELL)
 *   - Rejection candle: bullish en BUY, bearish en SELL
 *   - ATR floor: ATR(14) / price > minAtrPct (evita rangos muertos)
 *
 * Targets (R:R = 1.0):
 *   sl_distance = 0.4 × ATR(14)_1m
 *   tp_distance = 0.4 × ATR(14)_1m
 *
 * Pura signal detector. No DB / IO. El wrapper DdRunner se encarga de:
 *   - tracking lastDirection por símbolo + flip detection
 *   - cooldown post-trade y post-flip
 *   - consecutive-loss killswitch (6 SLs → pausa hasta UTC 00:00)
 *   - sizing por risk real (riskUsd / sl_distance_pct)
 *   - persistencia + telemetry vía openRegimePosition.
 */

import type { Candle } from '../analysis/candle-builder.js';

export type DdDirection = 'BUY' | 'SELL' | 'NEUTRAL';

export interface DdSignal {
  side: 'BUY' | 'SELL' | null;
  entryPrice: number;
  tp: number;
  sl: number;
  rr: number;
  direction: DdDirection;
  reason: string;
  meta: {
    dailyOpen: number;
    ema20: number;
    atr: number;
    atrPct: number;
    lastOpen: number;
    lastClose: number;
    lastHigh: number;
    lastLow: number;
  };
}

export interface DdConfig {
  /** Half-width de la dead-zone alrededor de daily_open. 0.0005 = ±0.05%. */
  directionThreshold: number;
  /** Periodo de EMA para el pullback gate. */
  emaPeriod: number;
  /** Periodo de ATR. */
  atrPeriod: number;
  /** ATR/price mínimo para considerar que hay vol suficiente. */
  minAtrPct: number;
  /** Multiplicador de ATR para SL distance. */
  slAtrMult: number;
  /** Ratio R:R objetivo — TP distance = SL distance × rrTarget. */
  rrTarget: number;
  /**
   * TP mínimo (% del precio) para que la operación sea viable después de
   * comisiones. Coinbase spot cobra 0.6%/lado = 1.2% ida-vuelta; con TP por
   * debajo de ~1.2% cada "ganador" pierde por fees. Ponemos 1.8% (1.5× el
   * fee round-trip) para que el neto tras comisiones sea ≥ ~0.6%.
   */
  minTpPct: number;
}

export const DEFAULT_DD_CONFIG: DdConfig = {
  directionThreshold: 0.0005,
  emaPeriod: 20,
  atrPeriod: 14,
  minAtrPct: 0.0005,
  // SL = 1× ATR (más ancho que el 0.4 original) y TP = 3× SL. Con R:R 3.0
  // el win rate de breakeven tras fees ~1.2% cae a ~55% (alcanzable), vs el
  // 90% imposible que exigía R:R 1.0 con targets chicos.
  slAtrMult: 1.0,
  rrTarget: 3.0,
  minTpPct: 0.018,
};

/**
 * EMA(period) sobre la serie de cierres. Seedea con SMA de los primeros
 * `period` valores y aplica suavizado estándar. Copia local para mantener
 * el módulo self-contained.
 */
export function ema(values: number[], period: number): number {
  if (values.length < period) return NaN;
  const k = 2 / (period + 1);
  let emaValue = 0;
  for (let i = 0; i < period; i++) emaValue += values[i];
  emaValue /= period;
  for (let i = period; i < values.length; i++) {
    emaValue = values[i] * k + emaValue * (1 - k);
  }
  return emaValue;
}

/**
 * Wilder ATR(period). NaN si `candles.length < period + 1`. Copia local
 * por self-containment del módulo.
 */
export function atr(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return NaN;
  const tr = (prev: number, c: Candle): number =>
    Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));

  let trSum = 0;
  for (let i = 1; i <= period; i++) trSum += tr(candles[i - 1].close, candles[i]);
  let value = trSum / period;
  for (let i = period + 1; i < candles.length; i++) {
    value = (value * (period - 1) + tr(candles[i - 1].close, candles[i])) / period;
  }
  return value;
}

/**
 * Encuentra el `open` de la vela cuyo openTs cae exactamente en UTC 00:00
 * del día (millisecond timestamp) provisto. Retorna null si esa vela no
 * está en el buffer (warmup o data gap).
 *
 * Crypto opera 24/7 → no hay concepto de "abierto del mercado" per se.
 * Usamos el snapshot al UTC 00:00 como ancla del día, alineado con la
 * convención de daily candles del exchange.
 */
export function getDailyOpenFromCandles(
  candles: Candle[],
  nowMs: number,
): number | null {
  if (candles.length === 0) return null;
  const dayStart = utcDayStart(nowMs);
  // Buscamos la primera vela cuyo openTs >= dayStart. En 1m son 1440 velas/día,
  // así que el buffer típico (~60-1440 velas) cubre el día actual completo
  // o solo las últimas horas. Si el dayStart cae fuera del buffer (warmup
  // recién después del rolover de medianoche), retornamos null.
  for (const c of candles) {
    if (c.openTs >= dayStart) {
      return c.open;
    }
  }
  return null;
}

/**
 * Retorna el inicio del día UTC (00:00:00.000) que contiene `ms`.
 */
export function utcDayStart(ms: number): number {
  const date = new Date(ms);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Decide direction a partir del precio actual vs daily_open y el threshold
 * de dead-zone.
 */
export function getDailyDirection(
  currentPrice: number,
  dailyOpen: number,
  threshold: number,
): DdDirection {
  if (!Number.isFinite(currentPrice) || !Number.isFinite(dailyOpen) || dailyOpen <= 0) {
    return 'NEUTRAL';
  }
  if (currentPrice > dailyOpen * (1 + threshold)) return 'BUY';
  if (currentPrice < dailyOpen * (1 - threshold)) return 'SELL';
  return 'NEUTRAL';
}

/**
 * Detect a Daily-Direction-Scalper signal sobre la última vela 1m del
 * buffer. Retorna `{ side: null, ... }` si algún gate falla; el reason
 * field describe la causa para el decisions logger.
 *
 * Pre-condiciones invocador:
 *   - `candles1m` debe ser un buffer histórico de 1m candles (ascending ts).
 *   - `nowMs` debe ser el timestamp del tick actual (Date.now()).
 *
 * Gates evaluados (en orden):
 *   1. warmup (necesita ≥ max(emaPeriod, atrPeriod + 1) candles)
 *   2. daily_open disponible (sino warmup post-rolover)
 *   3. direction != NEUTRAL
 *   4. ATR floor (vol mínima)
 *   5. Pullback (BUY: lastClose ≤ EMA20; SELL: lastClose ≥ EMA20)
 *   6. Rejection candle (BUY: lastClose > lastOpen; SELL: lastClose < lastOpen)
 */
export function detectDdSignal(
  candles1m: Candle[],
  nowMs: number,
  cfg: DdConfig = DEFAULT_DD_CONFIG,
): DdSignal {
  const need = Math.max(cfg.emaPeriod, cfg.atrPeriod + 1) + 5;
  if (candles1m.length < need) {
    return blockedSignal(
      `warming up (need ${need} 1m candles, have ${candles1m.length})`,
    );
  }

  const dailyOpen = getDailyOpenFromCandles(candles1m, nowMs);
  if (dailyOpen === null) {
    return blockedSignal('daily_open not yet available (post-rollover warmup)');
  }

  const last = candles1m[candles1m.length - 1];
  const lastClose = last.close;
  const lastOpen = last.open;
  const closes = candles1m.map((c) => c.close);
  const ema20 = ema(closes, cfg.emaPeriod);
  const atrValue = atr(candles1m, cfg.atrPeriod);

  if (!Number.isFinite(ema20) || !Number.isFinite(atrValue)) {
    return blockedSignal('non-finite indicators', lastClose, {
      dailyOpen, ema20, atr: atrValue, atrPct: NaN,
      lastOpen, lastClose, lastHigh: last.high, lastLow: last.low,
    });
  }

  const atrPct = atrValue / lastClose;
  const meta = {
    dailyOpen, ema20, atr: atrValue, atrPct,
    lastOpen, lastClose, lastHigh: last.high, lastLow: last.low,
  };

  const direction = getDailyDirection(lastClose, dailyOpen, cfg.directionThreshold);
  if (direction === 'NEUTRAL') {
    return {
      side: null,
      entryPrice: lastClose,
      tp: 0, sl: 0, rr: 0,
      direction,
      reason:
        `direction=NEUTRAL (price=${lastClose.toFixed(2)} ` +
        `dailyOpen=${dailyOpen.toFixed(2)} threshold=±${(cfg.directionThreshold * 100).toFixed(3)}%)`,
      meta,
    };
  }

  if (atrPct < cfg.minAtrPct) {
    return {
      side: null,
      entryPrice: lastClose,
      tp: 0, sl: 0, rr: 0,
      direction,
      reason:
        `atr/price=${(atrPct * 100).toFixed(4)}% below floor ` +
        `(${(cfg.minAtrPct * 100).toFixed(4)}%)`,
      meta,
    };
  }

  const slDistance = cfg.slAtrMult * atrValue;
  const tpDistance = slDistance * cfg.rrTarget; // TP = rrTarget × SL

  // Gate fee-aware: si el TP no supera el piso mínimo (para cubrir la
  // comisión 1.2% ida-vuelta de Coinbase spot), skip. Sin esto, cada TP
  // "ganador" pierde plata por fees. Reduce la frecuencia a solo setups
  // con volatilidad suficiente para que valga la pena operar.
  const tpPct = tpDistance / lastClose;
  if (tpPct < cfg.minTpPct) {
    return {
      side: null,
      entryPrice: lastClose,
      tp: 0, sl: 0, rr: 0,
      direction,
      reason:
        `TP ${(tpPct * 100).toFixed(3)}% below fee-viable floor ` +
        `(${(cfg.minTpPct * 100).toFixed(2)}%) — atr too small to clear fees`,
      meta,
    };
  }

  if (direction === 'BUY') {
    // BUY pullback: precio bajó a o por debajo de la EMA20 (zona de retest).
    if (lastClose > ema20) {
      return {
        side: null,
        entryPrice: lastClose,
        tp: 0, sl: 0, rr: 0,
        direction,
        reason:
          `BUY direction but no pullback ` +
          `(lastClose=${lastClose.toFixed(2)} > ema20=${ema20.toFixed(2)})`,
        meta,
      };
    }
    // Rejection candle: la última vela cerró por encima de su open (bullish).
    if (lastClose <= lastOpen) {
      return {
        side: null,
        entryPrice: lastClose,
        tp: 0, sl: 0, rr: 0,
        direction,
        reason:
          `BUY pullback OK but no bullish rejection ` +
          `(lastClose=${lastClose.toFixed(2)} ≤ lastOpen=${lastOpen.toFixed(2)})`,
        meta,
      };
    }
    const tp = lastClose + tpDistance;
    const sl = lastClose - slDistance;
    const reward = tp - lastClose;
    const risk = lastClose - sl;
    const rr = risk > 0 ? reward / risk : 0;
    return {
      side: 'BUY',
      entryPrice: lastClose,
      tp, sl, rr,
      direction,
      reason:
        `BUY @ ${lastClose.toFixed(2)} pullback to ema20=${ema20.toFixed(2)} ` +
        `rejection candle (open=${lastOpen.toFixed(2)} close=${lastClose.toFixed(2)}) ` +
        `atr=${atrValue.toFixed(2)} (${(atrPct * 100).toFixed(3)}%)`,
      meta,
    };
  }

  // SELL direction
  if (lastClose < ema20) {
    return {
      side: null,
      entryPrice: lastClose,
      tp: 0, sl: 0, rr: 0,
      direction,
      reason:
        `SELL direction but no pullback ` +
        `(lastClose=${lastClose.toFixed(2)} < ema20=${ema20.toFixed(2)})`,
      meta,
    };
  }
  if (lastClose >= lastOpen) {
    return {
      side: null,
      entryPrice: lastClose,
      tp: 0, sl: 0, rr: 0,
      direction,
      reason:
        `SELL pullback OK but no bearish rejection ` +
        `(lastClose=${lastClose.toFixed(2)} ≥ lastOpen=${lastOpen.toFixed(2)})`,
      meta,
    };
  }
  const tp = lastClose - tpDistance;
  const sl = lastClose + slDistance;
  const reward = lastClose - tp;
  const risk = sl - lastClose;
  const rr = risk > 0 ? reward / risk : 0;
  return {
    side: 'SELL',
    entryPrice: lastClose,
    tp, sl, rr,
    direction,
    reason:
      `SELL @ ${lastClose.toFixed(2)} pullback to ema20=${ema20.toFixed(2)} ` +
      `rejection candle (open=${lastOpen.toFixed(2)} close=${lastClose.toFixed(2)}) ` +
      `atr=${atrValue.toFixed(2)} (${(atrPct * 100).toFixed(3)}%)`,
    meta,
  };
}

function blockedSignal(
  reason: string,
  entryPrice = 0,
  meta?: DdSignal['meta'],
): DdSignal {
  return {
    side: null,
    entryPrice,
    tp: 0, sl: 0, rr: 0,
    direction: 'NEUTRAL',
    reason,
    meta: meta ?? {
      dailyOpen: NaN, ema20: NaN, atr: NaN, atrPct: NaN,
      lastOpen: NaN, lastClose: NaN, lastHigh: NaN, lastLow: NaN,
    },
  };
}
