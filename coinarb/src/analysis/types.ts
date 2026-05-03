/**
 * Fundamental Analysis Engine — shared types.
 *
 * All providers output a component score in a fixed range.
 * The engine combines them into a composite FundamentalSignal
 * that drives an edgeMultiplier applied in the trading loop.
 *
 * Score convention: positive = bullish BTC bias, negative = bearish.
 * edgeMultiplier: 0.3–1.5 applied to the edge AFTER cross-market.
 */

// ─── Component interfaces ────────────────────────────────────────────────────

export interface FearGreedComponent {
  value: number;           // 0–100 (Alternative.me raw value)
  label: string;           // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number;           // contribution: -25 to +25
  fetchedAt: number;
}

export interface DerivativesComponent {
  fundingRate: number;            // e.g. 0.0001 = 0.01%
  fundingSignal: 'LONG_HEAVY' | 'SHORT_HEAVY' | 'NEUTRAL';
  openInterestUsd: number;        // total OI in USD
  openInterestDeltaPct: number;   // % change vs previous fetch
  longShortRatio: number;         // global accounts L/S ratio
  topLongShortRatio: number;      // top trader accounts L/S ratio
  basis: number;                  // futures premium vs spot (%)
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number;                  // contribution: -40 to +40
  fetchedAt: number;
}

export interface ScoredHeadline {
  title: string;
  url: string;
  source: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  urgency: number;   // 0–10
  ageMs: number;
  score: number;     // individual score before weighting
}

export interface NewsComponent {
  headlines: ScoredHeadline[];
  aggregateScore: number;     // -100 to +100 weighted average
  urgencyPeak: number;        // highest urgency among recent headlines (0–10)
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score: number;              // contribution: -30 to +30
  fetchedAt: number;
}

export interface MacroGuardComponent {
  vetoed: boolean;
  reason: string | null;      // e.g. "FOMC in 12min" | "CPI release 4min ago"
  nextEventName: string | null;
  nextEventMinutes: number | null;
  lastCheckAt: number;
}

// ─── Composite signal ────────────────────────────────────────────────────────

export interface FundamentalSignal {
  /** Weighted composite: -95 to +95 (positive = bullish) */
  compositeScore: number;

  /** True if a high-impact macro event is within the block window → skip trade */
  vetoed: boolean;
  vetoReason: string | null;

  // Edge multiplier is computed by compositeEdgeMultiplier() in fundamental-engine.ts
  // (not a method here — keeps FundamentalSignal fully JSON-serializable)

  components: {
    fearGreed: FearGreedComponent | null;
    derivatives: DerivativesComponent | null;
    news: NewsComponent | null;
    macroGuard: MacroGuardComponent | null;
  };

  confidence: number;   // 0–1: how many components have fresh data
  computedAt: number;
}
