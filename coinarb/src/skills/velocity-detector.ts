/**
 * Velocity Detector — Superpower #1
 *
 * Detects price acceleration toward Polymarket crypto milestones.
 * When BTC/ETH/SOL accelerates toward a price milestone faster than
 * Polymarket participants update their bids, an edge appears.
 *
 * The agent sees this lag in real-time. Humans see it 20-90 min later.
 *
 * Axes used in dashboard 3D visualization:
 *   X = milestone distance %    (how close is price to the target)
 *   Y = Polymarket implied prob  (what the crowd believes right now)
 *   Z = velocity-adjusted edge   (what the model believes, adjusted for momentum)
 */

export interface PriceSample {
  price: number;
  timestamp: number; // ms epoch
}

export interface VelocityWindow {
  label: '1m' | '5m' | '15m' | '1h';
  windowMs: number;
  velocity: number;        // $/hour (positive = up)
  acceleration: number;    // $/hour² (positive = speeding up)
  direction: 'UP' | 'DOWN' | 'FLAT';
  samplesUsed: number;
}

export interface MilestoneProximity {
  milestonePrice: number;
  distancePct: number;       // % away from current price
  distanceUsd: number;
  direction: 'ABOVE' | 'BELOW'; // milestone is above or below current price
  movingToward: boolean;     // is velocity heading toward the milestone?
  timeToHitHours: number | null; // ETA at current velocity (null = not converging)
}

export interface VelocitySignal {
  conditionId: string;
  symbol: string;            // 'BTC' | 'ETH' | 'SOL'
  question: string;          // Polymarket question text
  currentPrice: number;
  marketImpliedProb: number; // Polymarket bid price (0-1)
  windows: VelocityWindow[];
  milestone: MilestoneProximity | null;
  velocityProbDelta: number; // How much velocity shifts the fair probability
  adjustedFairProb: number;  // baseFairProb + velocityProbDelta
  lagEstimateMinutes: number | null; // Minutes before Polymarket corrects
  huntStrength: number;      // 0-100 composite opportunity score
  isAccelerating: boolean;   // True if price is speeding up toward milestone
  computedAt: number;        // timestamp ms
}

// Window configurations
const WINDOWS: Array<{ label: VelocityWindow['label']; ms: number }> = [
  { label: '1m',  ms:    60_000 },
  { label: '5m',  ms:   300_000 },
  { label: '15m', ms:   900_000 },
  { label: '1h',  ms: 3_600_000 },
];

// Historical average lag (Polymarket crowd update delay)
const BASELINE_LAG_MINUTES = 30;

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Extract milestone price from Polymarket question text.
 * Handles: "$100,000", "$95K", "$100k", "100000"
 */
export function parseMilestonePrice(question: string): number | null {
  // Match $100K or $100k patterns first
  const kPattern = /\$([0-9,]+(?:\.[0-9]+)?)\s*[kK]\b/;
  const kMatch = question.match(kPattern);
  if (kMatch) {
    const val = parseFloat(kMatch[1].replace(/,/g, '')) * 1000;
    if (val > 100) return val;
  }

  // Match $100,000 or $95000
  const dollarPattern = /\$([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?|\d{4,}(?:\.[0-9]+)?)/;
  const dollarMatch = question.match(dollarPattern);
  if (dollarMatch) {
    const val = parseFloat(dollarMatch[1].replace(/,/g, ''));
    if (val > 100) return val;
  }

  return null;
}

/**
 * Detect which crypto symbol a Polymarket question refers to.
 */
export function parseSymbol(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('btc') || q.includes('bitcoin')) return 'BTC';
  if (q.includes('eth') || q.includes('ethereum')) return 'ETH';
  if (q.includes('sol') || q.includes('solana')) return 'SOL';
  return 'CRYPTO';
}

// ─── Velocity Calculation ─────────────────────────────────────────────────────

/**
 * Compute velocity ($/h) and acceleration ($/h²) for a given time window.
 */
function computeWindow(
  samples: PriceSample[],
  windowMs: number,
  label: VelocityWindow['label'],
  now: number
): VelocityWindow {
  const cutoff = now - windowMs;
  const ws = samples.filter(s => s.timestamp >= cutoff);

  if (ws.length < 2) {
    return { label, windowMs, velocity: 0, acceleration: 0, direction: 'FLAT', samplesUsed: ws.length };
  }

  const oldest = ws[0];
  const newest = ws[ws.length - 1];
  const dtHours = (newest.timestamp - oldest.timestamp) / 3_600_000;
  if (dtHours < 0.0001) {
    return { label, windowMs, velocity: 0, acceleration: 0, direction: 'FLAT', samplesUsed: ws.length };
  }

  const velocity = (newest.price - oldest.price) / dtHours;

  // Acceleration: compare velocity of first half vs second half of window
  let acceleration = 0;
  if (ws.length >= 4) {
    const midIdx = Math.floor(ws.length / 2);
    const mid = ws[midIdx];
    const dtFirst  = (mid.timestamp   - oldest.timestamp) / 3_600_000;
    const dtSecond = (newest.timestamp - mid.timestamp)    / 3_600_000;
    if (dtFirst > 0.00001 && dtSecond > 0.00001) {
      const v1 = (mid.price    - oldest.price) / dtFirst;
      const v2 = (newest.price - mid.price)    / dtSecond;
      acceleration = (v2 - v1) / ((dtFirst + dtSecond) / 2);
    }
  }

  const direction: VelocityWindow['direction'] =
    Math.abs(velocity) < 50 ? 'FLAT' : velocity > 0 ? 'UP' : 'DOWN';

  return { label, windowMs, velocity, acceleration, direction, samplesUsed: ws.length };
}

// ─── Milestone Proximity ───────────────────────────────────────────────────────

function computeMilestoneProximity(
  currentPrice: number,
  milestonePrice: number,
  velocity1h: number
): MilestoneProximity {
  const distanceUsd = Math.abs(milestonePrice - currentPrice);
  const distancePct = (distanceUsd / currentPrice) * 100;
  const direction: MilestoneProximity['direction'] = milestonePrice > currentPrice ? 'ABOVE' : 'BELOW';

  const movingToward =
    (direction === 'ABOVE' && velocity1h > 0) ||
    (direction === 'BELOW' && velocity1h < 0);

  let timeToHitHours: number | null = null;
  if (movingToward && Math.abs(velocity1h) > 0) {
    const t = distanceUsd / Math.abs(velocity1h);
    timeToHitHours = t <= 48 ? t : null; // ignore if > 48h out
  }

  return { milestonePrice, distancePct, distanceUsd, direction, movingToward, timeToHitHours };
}

// ─── Velocity-Adjusted Probability ────────────────────────────────────────────

/**
 * Calculate how much velocity shifts the fair probability.
 *
 * Logic:
 *   - If price is accelerating toward a milestone, probability is higher
 *     than the static jump-diffusion model suggests.
 *   - Returns a signed delta to add to the base fair probability.
 *   - Max effect: ±25% (capped to prevent over-adjustment)
 */
function computeVelocityProbDelta(
  milestone: MilestoneProximity | null,
  w5m: VelocityWindow,
  w1h: VelocityWindow
): number {
  if (!milestone || !milestone.movingToward || milestone.timeToHitHours === null) return 0;
  if (milestone.distancePct > 15) return 0; // Too far — velocity effect is noise

  // Distance factor: 1.0 at 0% distance, 0 at 15%
  const distFactor = Math.max(0, 1 - milestone.distancePct / 15);

  // Time factor: 1.0 at ETA < 1h, decays to 0 at 24h
  const timeFactor = Math.max(0, 1 - milestone.timeToHitHours / 24);

  // Acceleration bonus: price speeding up = stronger signal
  const accelerating =
    (milestone.direction === 'ABOVE' && w5m.acceleration > 0) ||
    (milestone.direction === 'BELOW' && w5m.acceleration < 0);
  const accBonus = accelerating ? 1.6 : 1.0;

  // Alignment: 5m and 1h velocities pointing same direction = more conviction
  const aligned =
    (w5m.velocity > 0 && w1h.velocity > 0) ||
    (w5m.velocity < 0 && w1h.velocity < 0);
  const alignBonus = aligned ? 1.25 : 0.75;

  const maxDelta = 0.25;
  const rawDelta = distFactor * timeFactor * accBonus * alignBonus * maxDelta;
  const clampedDelta = Math.min(maxDelta, rawDelta);

  // Sign: positive delta if milestone is above (higher prob of reaching it)
  return milestone.direction === 'ABOVE' ? clampedDelta : -clampedDelta;
}

// ─── Lag Estimate ─────────────────────────────────────────────────────────────

/**
 * Estimate minutes before Polymarket participants update their prices.
 * Fast moves → shorter lag. Slow/distant moves → longer lag.
 */
function estimateLag(
  milestone: MilestoneProximity | null,
  w5m: VelocityWindow,
  w1h: VelocityWindow
): number | null {
  if (!milestone || milestone.timeToHitHours === null) return null;

  // Speed factor: the faster the move, the quicker the market notices
  const t = milestone.timeToHitHours;
  const speedFactor = t < 0.5 ? 0.3 : t < 2 ? 0.55 : t < 6 ? 0.8 : 1.0;

  // Alignment factor: consistent velocity = market slower to catch up (trend trade)
  const aligned =
    (w5m.velocity > 0 && w1h.velocity > 0) ||
    (w5m.velocity < 0 && w1h.velocity < 0);
  const alignFactor = aligned ? 0.7 : 1.2;

  // Distance factor: very close milestone = market already priced it in
  const distFactor = milestone.distancePct < 2 ? 0.4 : milestone.distancePct < 5 ? 0.7 : 1.0;

  return Math.max(5, Math.round(BASELINE_LAG_MINUTES * speedFactor * alignFactor * distFactor));
}

// ─── Hunt Strength ────────────────────────────────────────────────────────────

/**
 * Composite 0-100 score representing opportunity strength.
 * Used as bubble size in the 3D visualization.
 */
function computeHuntStrength(
  milestone: MilestoneProximity | null,
  probDelta: number,
  isAccelerating: boolean,
  w5m: VelocityWindow,
  w1h: VelocityWindow
): number {
  if (!milestone || !milestone.movingToward) return 0;

  let score = 0;

  // Distance component (max 30): closer = higher score
  const distScore = milestone.distancePct <= 15
    ? 30 * (1 - milestone.distancePct / 15)
    : 0;
  score += distScore;

  // Edge component (max 35): bigger probability delta = better
  score += Math.min(35, Math.abs(probDelta) * 180);

  // Acceleration (15 pts)
  if (isAccelerating) score += 15;

  // Velocity alignment (10 pts)
  const aligned =
    (w5m.velocity > 0 && w1h.velocity > 0) ||
    (w5m.velocity < 0 && w1h.velocity < 0);
  if (aligned) score += 10;

  // Sweet spot ETA: 1-8h (10 pts)
  const t = milestone.timeToHitHours;
  if (t !== null && t >= 1 && t <= 8) score += 10;

  return Math.min(100, Math.round(score));
}

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Compute the full velocity signal for one Polymarket market.
 *
 * @param conditionId   Polymarket condition ID
 * @param question      Market question text (used to parse milestone price + symbol)
 * @param currentPrice  Current BTC/ETH/SOL spot price (from Binance)
 * @param samples       Timestamped price history (last 1h from BinanceFeed)
 * @param marketImpliedProb Polymarket mid price (0-1)
 * @param baseFairProb  Fair price from jump-diffusion model (0-1)
 * @param milestonePrice Pre-parsed milestone price (or null)
 */
export function computeVelocitySignal(
  conditionId: string,
  question: string,
  currentPrice: number,
  samples: PriceSample[],
  marketImpliedProb: number,
  baseFairProb: number,
  milestonePrice: number | null = null
): VelocitySignal {
  const now = Date.now();

  // Parse milestone if not provided
  const milestone_price = milestonePrice ?? parseMilestonePrice(question);
  const symbol = parseSymbol(question);

  // Compute multi-window velocities
  const windows = WINDOWS.map(w => computeWindow(samples, w.ms, w.label, now));
  const w5m = windows[1]; // 5m window
  const w1h = windows[3]; // 1h window

  // Milestone proximity
  const milestone = milestone_price
    ? computeMilestoneProximity(currentPrice, milestone_price, w1h.velocity)
    : null;

  // Is accelerating toward milestone?
  const isAccelerating =
    milestone !== null &&
    milestone.movingToward &&
    ((milestone.direction === 'ABOVE' && w5m.acceleration > 0) ||
     (milestone.direction === 'BELOW' && w5m.acceleration < 0));

  // Velocity-adjusted probability delta
  const velocityProbDelta = computeVelocityProbDelta(milestone, w5m, w1h);
  const adjustedFairProb = Math.max(0.001, Math.min(0.999, baseFairProb + velocityProbDelta));

  // Lag estimate
  const lagEstimateMinutes = estimateLag(milestone, w5m, w1h);

  // Hunt strength
  const huntStrength = computeHuntStrength(milestone, velocityProbDelta, isAccelerating, w5m, w1h);

  return {
    conditionId,
    symbol,
    question,
    currentPrice,
    marketImpliedProb,
    windows,
    milestone,
    velocityProbDelta,
    adjustedFairProb,
    lagEstimateMinutes,
    huntStrength,
    isAccelerating,
    computedAt: now,
  };
}
