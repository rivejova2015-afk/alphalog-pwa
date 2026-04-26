/**
 * A3 — Price Stasis Breakout
 *
 * A breakout from a long period of consolidation is more reliable than
 * a continuation of already-moving volatility.
 *
 * Detects: price was in a tight range (< 0.5% std) for ≥5 min,
 * then broke out sharply (> 2σ from the stasis range).
 *
 * Complement to Velocity Detector: velocity detects the speed, stasis adds
 * "this move is fresh, not a continuation of existing noise".
 */

export interface StasisSignal {
  inStasis: boolean;
  breakoutDetected: boolean;
  breakoutDirection: 'UP' | 'DOWN' | null;
  stasisMinutes: number;      // how long the stasis lasted before breakout
  stasisMean: number;         // average price during stasis
  stasisStd: number;          // std dev during stasis
  confidence: number;         // min(stasisMinutes / 8, 1.0)
}

// Buffer stored per conditionId: circular array of midPrice samples
const midPriceBuffers = new Map<string, number[]>();
const BUFFER_SIZE = 60;         // 60 samples × 5s poll = 5 min of history
const STASIS_WINDOW = 48;       // check stasis in first 48 of 60 samples = 4 min
const STASIS_STD_THRESHOLD = 0.003; // < 0.3% std = "quiet"
const BREAKOUT_SIGMA = 2.0;     // must be 2σ away from stasis mean

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[], m: number): number {
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

export function updateStasisBuffer(conditionId: string, midPrice: number): void {
  const buf = midPriceBuffers.get(conditionId) ?? [];
  buf.push(midPrice);
  if (buf.length > BUFFER_SIZE) buf.shift();
  midPriceBuffers.set(conditionId, buf);
}

export function computeStasisSignal(conditionId: string): StasisSignal {
  const buf = midPriceBuffers.get(conditionId) ?? [];

  const noSignal: StasisSignal = {
    inStasis: false,
    breakoutDetected: false,
    breakoutDirection: null,
    stasisMinutes: 0,
    stasisMean: 0,
    stasisStd: 0,
    confidence: 0,
  };

  if (buf.length < STASIS_WINDOW + 5) return noSignal;

  // Stasis window = older portion of buffer
  const stasisBuf = buf.slice(0, STASIS_WINDOW);
  const currentPrice = buf[buf.length - 1];

  const m = mean(stasisBuf);
  const s = std(stasisBuf, m);

  // Not in stasis if already noisy
  if (s > STASIS_STD_THRESHOLD) {
    return { ...noSignal, stasisMean: m, stasisStd: s };
  }

  // Was in stasis — check if current price broke out
  const deviation = Math.abs(currentPrice - m);
  const breakoutDetected = deviation > BREAKOUT_SIGMA * Math.max(s, 0.001);
  const breakoutDirection = breakoutDetected
    ? (currentPrice > m ? 'UP' : 'DOWN')
    : null;

  // Approximate stasis duration: samples in window × 5s per sample
  const stasisMinutes = (STASIS_WINDOW * 5) / 60;
  const confidence = breakoutDetected ? Math.min(1, stasisMinutes / 8) : 0;

  return {
    inStasis: !breakoutDetected,
    breakoutDetected,
    breakoutDirection,
    stasisMinutes,
    stasisMean: m,
    stasisStd: s,
    confidence,
  };
}
