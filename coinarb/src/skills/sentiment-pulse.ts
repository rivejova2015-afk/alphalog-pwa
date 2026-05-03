/**
 * Sentiment Pulse — Superpower #4
 *
 * Detects anomalous changes in Polymarket orderbook liquidity.
 * When bid SIZE suddenly increases without a corresponding price move,
 * it means someone is accumulating — informed money moving before
 * the rest of the market catches up.
 *
 * Works the other way too: sudden ask SIZE spike = someone offloading = bearish.
 *
 * Mechanism:
 *   - Track rolling history of (bidSize, askSize) per market
 *   - Calculate z-score of current size vs recent baseline
 *   - High positive bid z-score = accumulation = bullish anomaly
 *   - High negative bid z-score or high ask z-score = distribution = bearish anomaly
 *   - Output: anomaly score per market (-100 to +100)
 */

export interface OrderbookSample {
  bidSize: number;
  askSize: number;
  bidPrice: number;
  askPrice: number;
  timestamp: number;
}

export interface SentimentPulse {
  conditionId: string;
  anomalyScore: number;     // -100 to +100 (negative = bearish, positive = bullish)
  zScoreBid: number;        // Z-score of current bid size vs baseline
  zScoreAsk: number;        // Z-score of current ask size vs baseline
  signal: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL';
  priceMovedWithSignal: boolean; // Is price also moving in same direction?
  samplesUsed: number;
  computedAt: number;
}

const HISTORY_WINDOW_MS = 300_000;  // 5 min baseline window
const MIN_SAMPLES = 10;             // Minimum samples for reliable z-score
const ANOMALY_THRESHOLD = 1.8;      // Z-score threshold for anomaly detection

export class SentimentPulseTracker {
  // conditionId → rolling history of orderbook snapshots
  private history: Map<string, OrderbookSample[]> = new Map();

  /**
   * Feed a new orderbook snapshot for a market.
   * Called every time the Polymarket feed polls a new orderbook.
   */
  record(
    conditionId: string,
    bidSize: number,
    askSize: number,
    bidPrice: number,
    askPrice: number,
  ): void {
    if (!this.history.has(conditionId)) {
      this.history.set(conditionId, []);
    }

    const samples = this.history.get(conditionId)!;
    const now = Date.now();

    samples.push({ bidSize, askSize, bidPrice, askPrice, timestamp: now });

    // Prune samples older than window
    const cutoff = now - HISTORY_WINDOW_MS;
    while (samples.length > 0 && samples[0].timestamp < cutoff) {
      samples.shift();
    }
  }

  /**
   * Compute the sentiment pulse for a market.
   * Returns null if not enough data.
   */
  compute(conditionId: string): SentimentPulse | null {
    const samples = this.history.get(conditionId);
    if (!samples || samples.length < MIN_SAMPLES) return null;

    const now = Date.now();

    // Use all but the last sample as baseline, last sample as current
    const baseline = samples.slice(0, -1);
    const current = samples[samples.length - 1];

    // Baseline stats for bid size
    const bidSizes = baseline.map(s => s.bidSize);
    const bidMean = bidSizes.reduce((s, v) => s + v, 0) / bidSizes.length;
    const bidStd = Math.sqrt(
      bidSizes.reduce((s, v) => s + (v - bidMean) ** 2, 0) / bidSizes.length
    ) || 1;

    // Baseline stats for ask size
    const askSizes = baseline.map(s => s.askSize);
    const askMean = askSizes.reduce((s, v) => s + v, 0) / askSizes.length;
    const askStd = Math.sqrt(
      askSizes.reduce((s, v) => s + (v - askMean) ** 2, 0) / askSizes.length
    ) || 1;

    // Z-scores
    const zBid = (current.bidSize - bidMean) / bidStd;
    const zAsk = (current.askSize - askMean) / askStd;

    // Did price move in the same direction as the anomaly?
    const firstPrice = (baseline[0].bidPrice + baseline[0].askPrice) / 2;
    const currentPrice = (current.bidPrice + current.askPrice) / 2;
    const priceMovedUp = currentPrice > firstPrice * 1.001;
    const priceMovedDown = currentPrice < firstPrice * 0.999;

    // Anomaly score: positive = bullish accumulation, negative = bearish distribution
    let anomalyScore = 0;
    let signal: SentimentPulse['signal'] = 'NEUTRAL';
    let priceMovedWithSignal = false;

    if (zBid > ANOMALY_THRESHOLD) {
      // Big bid size increase = accumulation = bullish
      signal = 'ACCUMULATION';
      anomalyScore = Math.min(100, Math.round(zBid * 30));
      priceMovedWithSignal = priceMovedUp;
    } else if (zAsk > ANOMALY_THRESHOLD || zBid < -ANOMALY_THRESHOLD) {
      // Big ask size increase OR bid size drop = distribution = bearish
      signal = 'DISTRIBUTION';
      const z = zAsk > ANOMALY_THRESHOLD ? zAsk : -zBid;
      anomalyScore = -Math.min(100, Math.round(z * 30));
      priceMovedWithSignal = priceMovedDown;
    }

    return {
      conditionId,
      anomalyScore,
      zScoreBid: Math.round(zBid * 100) / 100,
      zScoreAsk: Math.round(zAsk * 100) / 100,
      signal,
      priceMovedWithSignal,
      samplesUsed: samples.length,
      computedAt: now,
    };
  }

  /**
   * Compute sentiment for all tracked markets.
   */
  computeAll(): SentimentPulse[] {
    const results: SentimentPulse[] = [];
    for (const conditionId of this.history.keys()) {
      const pulse = this.compute(conditionId);
      if (pulse) results.push(pulse);
    }
    return results;
  }

  /**
   * Get edge multiplier based on sentiment alignment with a trade direction.
   * Trades that align with sentiment anomalies get a boost.
   */
  getEdgeMultiplier(conditionId: string, tradingBullish: boolean): number {
    const pulse = this.compute(conditionId);
    if (!pulse || pulse.signal === 'NEUTRAL') return 1.0;

    const sentimentBullish = pulse.signal === 'ACCUMULATION';
    const aligned = sentimentBullish === tradingBullish;

    if (aligned && Math.abs(pulse.anomalyScore) > 50) return 1.3;
    if (aligned) return 1.1;
    if (!aligned && Math.abs(pulse.anomalyScore) > 50) return 0.6; // Counter-sentiment penalty
    return 0.85;
  }
}
