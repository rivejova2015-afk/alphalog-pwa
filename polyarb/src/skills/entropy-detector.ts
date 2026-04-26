/**
 * A4 — Entropy Detector
 *
 * Shannon entropy of the last 40 ticks of price returns.
 * Low entropy = price moves in a structured, directional way (exploit it).
 * High entropy = random noise (fade it or skip).
 *
 * Complement to Velocity Detector: velocity says WHERE, entropy says HOW RELIABLE.
 */

export interface EntropySignal {
  entropy: number;                            // bits, 0-3 range
  regime: 'DIRECTIONAL' | 'NOISY' | 'NEUTRAL';
  velocityDirection: 'UP' | 'DOWN' | null;   // dominant direction in structured move
  confidence: number;                         // 0-1
}

const BINS = [-Infinity, -0.002, -0.0005, 0.0005, 0.002, Infinity];
const DIRECTIONAL_THRESHOLD = 1.5;  // H below this = structured
const NOISY_THRESHOLD = 2.5;        // H above this = noisy

/**
 * Quantize a return into bin index 0-4.
 */
function binReturn(r: number): number {
  for (let i = 1; i < BINS.length; i++) {
    if (r < BINS[i]) return i - 1;
  }
  return BINS.length - 2;
}

/**
 * Compute Shannon entropy from price series.
 * Returns null if insufficient data.
 */
export function computeEntropySignal(
  priceHistory: number[],  // raw price samples, newest last
  velocityDirection: 'UP' | 'DOWN' | 'FLAT',
): EntropySignal {
  const WINDOW = 40;
  const prices = priceHistory.slice(-WINDOW - 1);

  if (prices.length < 10) {
    return { entropy: 2.0, regime: 'NEUTRAL', velocityDirection: null, confidence: 0 };
  }

  // Compute log-returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }

  if (returns.length < 5) {
    return { entropy: 2.0, regime: 'NEUTRAL', velocityDirection: null, confidence: 0 };
  }

  // Count bin frequencies
  const counts = new Array(BINS.length - 1).fill(0) as number[];
  for (const r of returns) {
    counts[binReturn(r)]++;
  }

  // Shannon entropy: H = -sum(p_i * log2(p_i))
  const n = returns.length;
  let H = 0;
  for (const c of counts) {
    if (c > 0) {
      const p = c / n;
      H -= p * Math.log2(p);
    }
  }

  // Determine regime
  let regime: 'DIRECTIONAL' | 'NOISY' | 'NEUTRAL';
  let confidence: number;

  if (H < DIRECTIONAL_THRESHOLD) {
    regime = 'DIRECTIONAL';
    confidence = Math.min(1, (DIRECTIONAL_THRESHOLD - H) / DIRECTIONAL_THRESHOLD);
  } else if (H > NOISY_THRESHOLD) {
    regime = 'NOISY';
    confidence = Math.min(1, (H - NOISY_THRESHOLD) / (3 - NOISY_THRESHOLD));
  } else {
    regime = 'NEUTRAL';
    confidence = 0;
  }

  const dir = velocityDirection === 'UP' ? 'UP'
    : velocityDirection === 'DOWN' ? 'DOWN'
    : null;

  return { entropy: H, regime, velocityDirection: dir, confidence };
}
