/**
 * Fundamental Engine — orchestrates all fundamental analysis providers.
 *
 * Architecture:
 *   - Background refresh loops run independently of the 250ms trading loop
 *   - Main loop calls getSignal() synchronously — never waits on HTTP
 *   - Each provider caches its own result; stale data is returned on error
 *   - MacroGuard is called inline every tick (pure arithmetic, no I/O)
 *   - compositeEdgeMultiplier() is a standalone function (not a method on the
 *     signal object) so the signal is fully JSON-serializable for telemetry
 *
 * Composite score weights:
 *   Fear & Greed  → max ±25  (macro crowd sentiment, contrarian)
 *   Derivatives   → max ±40  (funding/OI/L-S from Binance Futures)
 *   News          → max ±30  (keyword NLP on CryptoPanic headlines)
 *   ─────────────────────────
 *   Total range   → ±95
 *
 * Edge multiplier table (applied after cross-market in loop.ts):
 *   composite aligned with trade:
 *     |score| > 60 → 1.40  (very strong confirmation)
 *     |score| > 35 → 1.20
 *     |score| > 15 → 1.10
 *     otherwise    → 1.00
 *   composite against trade:
 *     |score| > 60 → 0.40  (strong headwind — sharply reduce)
 *     |score| > 35 → 0.65
 *     |score| > 15 → 0.82
 *     otherwise    → 1.00
 *
 * Veto: if macroGuard fires → getSignal().vetoed = true → processMarket returns immediately.
 */

import { FearGreedProvider } from './providers/fear-greed.js';
import { DerivativesProvider } from './providers/derivatives.js';
import { NewsScannerProvider } from './providers/news-scanner.js';
import { MacroGuardProvider } from './providers/macro-guard.js';
import type {
  FundamentalSignal,
  FearGreedComponent,
  DerivativesComponent,
  NewsComponent,
  MacroGuardComponent,
} from './types.js';

// Refresh intervals for HTTP providers
const FEAR_GREED_INTERVAL_MS  = 10 * 60_000;   // 10 minutes
const DERIVATIVES_INTERVAL_MS =      60_000;   // 1 minute
const NEWS_INTERVAL_MS        =  3 * 60_000;   // 3 minutes
// MacroGuard has NO timer — check() is synchronous pure arithmetic, called inline each tick

/**
 * Compute the fundamental edge multiplier from a composite score and trade direction.
 * Standalone function (not a method) so FundamentalSignal is fully JSON-serializable.
 */
export function compositeEdgeMultiplier(compositeScore: number, tradingBullish: boolean): number {
  const aligned   = tradingBullish ? compositeScore > 0 : compositeScore < 0;
  const magnitude = Math.abs(compositeScore);

  if (aligned) {
    if (magnitude > 60) return 1.40;
    if (magnitude > 35) return 1.20;
    if (magnitude > 15) return 1.10;
    return 1.00;
  } else {
    if (magnitude > 60) return 0.40;
    if (magnitude > 35) return 0.65;
    if (magnitude > 15) return 0.82;
    return 1.00;
  }
}

export class FundamentalEngine {
  private fearGreed   = new FearGreedProvider();
  private derivatives = new DerivativesProvider();
  private newsScanner = new NewsScannerProvider();
  private macroGuard  = new MacroGuardProvider();

  private timers: ReturnType<typeof setInterval>[] = [];

  /** Start background refresh loops. Call once at agent startup. */
  start(): void {
    // Immediate first fetch (non-blocking)
    void this.fearGreed.refresh();
    void this.derivatives.refresh();
    void this.newsScanner.refresh();
    // MacroGuard: no timer — called inline each getSignal() call

    this.timers.push(
      setInterval(() => { void this.fearGreed.refresh(); }, FEAR_GREED_INTERVAL_MS),
      setInterval(() => { void this.derivatives.refresh(); }, DERIVATIVES_INTERVAL_MS),
      setInterval(() => { void this.newsScanner.refresh(); }, NEWS_INTERVAL_MS),
    );

    console.log('[fundamental-engine] Started (F&G + Derivatives + News + MacroGuard)');
  }

  /** Stop all background timers. Call on shutdown. */
  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    console.log('[fundamental-engine] Stopped');
  }

  /**
   * Returns the current fundamental signal synchronously.
   * Safe to call every 250ms — HTTP data is cached; MacroGuard is pure arithmetic.
   * The returned object is fully JSON-serializable (no function properties).
   */
  getSignal(): FundamentalSignal {
    const fg    = this.fearGreed.get();
    const deriv = this.derivatives.get();
    const news  = this.newsScanner.get();
    // MacroGuard always called inline — zero I/O, pure time arithmetic, never stale
    const macro = this.macroGuard.check();

    const fgScore    = fg?.score    ?? 0;
    const derivScore = deriv?.score ?? 0;
    const newsScore  = news?.score  ?? 0;

    const compositeScore = Math.max(-95, Math.min(95,
      fgScore + derivScore + newsScore
    ));

    // Confidence: how many HTTP providers have fresh data
    const freshCount = [
      fg    && Date.now() - fg.fetchedAt    < 15 * 60_000,
      deriv && Date.now() - deriv.fetchedAt <  2 * 60_000,
      news  && Date.now() - news.fetchedAt  <  6 * 60_000,
    ].filter(Boolean).length;
    const confidence = freshCount / 3;

    return {
      compositeScore,
      vetoed:      macro.vetoed,
      vetoReason:  macro.reason,
      components:  { fearGreed: fg, derivatives: deriv, news, macroGuard: macro },
      confidence,
      computedAt:  Date.now(),
    };
  }

  /** Expose individual provider snapshots for telemetry. */
  getComponentSnapshot(): {
    fearGreed: FearGreedComponent | null;
    derivatives: DerivativesComponent | null;
    news: NewsComponent | null;
    macroGuard: MacroGuardComponent | null;
  } {
    return {
      fearGreed:   this.fearGreed.get(),
      derivatives: this.derivatives.get(),
      news:        this.newsScanner.get(),
      macroGuard:  this.macroGuard.check(),
    };
  }
}
