// Latency arbitrage cross-broker detector
//
// Recibe ticks de dos brokers (fast/slow) sobre el mismo símbolo y detecta
// cuando el skew supera el threshold. Mantiene un buffer rolling de N ticks
// por (broker, symbol).

export interface Tick {
  broker_id:    string;
  symbol:       string;
  bid:          number;
  ask:          number;
  ts_ms:        number;
}

export interface SkewSignal {
  symbol:       string;
  fast_broker:  string;
  slow_broker:  string;
  skew_points:  number;
  direction:    'BUY' | 'SELL';
  fast_bid:     number;
  slow_bid:     number;
  detected_at:  number;
}

export interface DetectorConfig {
  max_skew_points: number;
  point_size:      number; // p.ej. 0.01 para XAUUSD
}

// XAUUSD: 1 point = 0.01. EURUSD: 1 point = 0.0001
export const POINT_SIZE_BY_SYMBOL: Record<string, number> = {
  XAUUSD: 0.01,
  XAGUSD: 0.001,
  EURUSD: 0.0001,
  GBPUSD: 0.0001,
  USDJPY: 0.01,
};

export function getPointSize(symbol: string): number {
  return POINT_SIZE_BY_SYMBOL[symbol] ?? 0.0001;
}

/**
 * Detect skew entre dos ticks del mismo símbolo en distintos brokers.
 * Retorna SkewSignal si |fast - slow| en puntos > threshold, null si no.
 */
export function detectSkew(
  fast: Tick,
  slow: Tick,
  config: DetectorConfig,
): SkewSignal | null {
  if (fast.symbol !== slow.symbol) return null;
  if (fast.broker_id === slow.broker_id) return null;
  // Sólo comparar ticks recientes (≤ 1s diferencia)
  if (Math.abs(fast.ts_ms - slow.ts_ms) > 1000) return null;

  const diff = fast.bid - slow.bid;
  const points = Math.abs(diff) / config.point_size;
  if (points < config.max_skew_points) return null;

  return {
    symbol:      fast.symbol,
    fast_broker: fast.broker_id,
    slow_broker: slow.broker_id,
    skew_points: Number(points.toFixed(2)),
    direction:   diff > 0 ? 'BUY' : 'SELL',
    fast_bid:    fast.bid,
    slow_bid:    slow.bid,
    detected_at: Math.max(fast.ts_ms, slow.ts_ms),
  };
}
