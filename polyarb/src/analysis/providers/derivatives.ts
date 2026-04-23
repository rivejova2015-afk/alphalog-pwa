/**
 * Derivatives Provider — Binance Futures public endpoints (no API key).
 *
 * Fetches every 60s:
 *   - Funding rate + mark price + index price (premiumIndex)
 *   - Open Interest in BTC (openInterest) → converted to USD
 *   - Global long/short account ratio (5m period)
 *   - Top trader long/short position ratio (5m period)
 *
 * Signals are contrarian for extreme funding/L-S and trend-following for OI.
 * Score range: -40 to +40.
 *
 * Economic intuition:
 *   - High positive funding → longs paying shorts heavily → crowd is long → fade longs (BEARISH)
 *   - High negative funding → shorts paying longs → crowd is short → fade shorts (BULLISH)
 *   - Rising OI + price up → real buyers entering → trend confirmation
 *   - Falling OI + price up → shorts covering → rally may exhaust
 *   - L/S ratio > 1.5 → crowd is overwhelmingly long → contrarian SHORT signal
 *   - L/S ratio < 0.7 → crowd is overwhelmingly short → contrarian LONG signal
 *   - Basis (futures premium) positive → bullish demand; negative → bearish demand
 */

import type { DerivativesComponent } from '../types.js';

const BASE = 'https://fapi.binance.com';
const TTL_MS = 60_000;

const ENDPOINTS = {
  premium:    `${BASE}/fapi/v1/premiumIndex?symbol=BTCUSDT`,
  oi:         `${BASE}/fapi/v1/openInterest?symbol=BTCUSDT`,
  longShort:  `${BASE}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1`,
  topTrader:  `${BASE}/futures/data/topLongShortPositionRatio?symbol=BTCUSDT&period=5m&limit=1`,
};

interface PremiumIndexRaw {
  symbol?: string;
  markPrice?: string;
  indexPrice?: string;
  lastFundingRate?: string;
  nextFundingTime?: number;
}

interface OIRaw {
  openInterest?: string;
  time?: number;
}

interface LongShortRaw {
  longShortRatio?: string;
  longAccount?: string;
  shortAccount?: string;
  timestamp?: string;
}

export class DerivativesProvider {
  private cached: DerivativesComponent | null = null;
  private prevOIUsd: number | null = null;
  private fetching = false;

  get(): DerivativesComponent | null {
    return this.cached;
  }

  async refresh(): Promise<void> {
    if (this.fetching) return;
    if (this.cached && Date.now() - this.cached.fetchedAt < TTL_MS) return;
    this.fetching = true;

    try {
      const [premRes, oiRes, lsRes, topRes] = await Promise.allSettled([
        fetch(ENDPOINTS.premium,   { signal: AbortSignal.timeout(5_000) }),
        fetch(ENDPOINTS.oi,        { signal: AbortSignal.timeout(5_000) }),
        fetch(ENDPOINTS.longShort, { signal: AbortSignal.timeout(5_000) }),
        fetch(ENDPOINTS.topTrader, { signal: AbortSignal.timeout(5_000) }),
      ]);

      // ── Funding rate + mark/index prices ──────────────────────────────────
      let fundingRate = 0;
      let markPrice = 0;
      let indexPrice = 0;

      if (premRes.status === 'fulfilled' && premRes.value.ok) {
        const raw = await premRes.value.json() as PremiumIndexRaw;
        fundingRate  = parseFloat(raw.lastFundingRate ?? '0') || 0;
        markPrice    = parseFloat(raw.markPrice ?? '0') || 0;
        indexPrice   = parseFloat(raw.indexPrice ?? '0') || 0;
      }

      // Basis = (markPrice - indexPrice) / indexPrice × 100
      const basis = indexPrice > 0 ? ((markPrice - indexPrice) / indexPrice) * 100 : 0;

      // ── Open Interest ──────────────────────────────────────────────────────
      let openInterestUsd = 0;
      let openInterestDeltaPct = 0;
      const priceForOI = markPrice || indexPrice;

      if (oiRes.status === 'fulfilled' && oiRes.value.ok && priceForOI > 0) {
        // Only convert OI to USD when we have a valid mark/index price.
        // If the premium fetch failed (priceForOI === 0), skip OI entirely and
        // leave this.cached unchanged below rather than writing zeros.
        const raw = await oiRes.value.json() as OIRaw;
        const oiBtc = parseFloat(raw.openInterest ?? '0') || 0;
        openInterestUsd = oiBtc * priceForOI;
      }

      if (openInterestUsd === 0 && priceForOI === 0) {
        // Premium index fetch failed — can't convert OI to USD.
        // Return stale data rather than overwriting cache with degraded values.
        console.warn('[derivatives] Premium fetch failed — keeping stale cache');
        return;
      }

      if (this.prevOIUsd !== null && openInterestUsd > 0) {
        openInterestDeltaPct = ((openInterestUsd - this.prevOIUsd) / this.prevOIUsd) * 100;
      }
      if (openInterestUsd > 0) this.prevOIUsd = openInterestUsd;

      // ── Global Long/Short ratio ────────────────────────────────────────────
      let longShortRatio = 1;
      if (lsRes.status === 'fulfilled' && lsRes.value.ok) {
        const raw = await lsRes.value.json() as LongShortRaw[];
        const entry = Array.isArray(raw) ? raw[0] : raw;
        longShortRatio = parseFloat((entry as LongShortRaw).longShortRatio ?? '1') || 1;
      }

      // ── Top Trader Long/Short ratio ────────────────────────────────────────
      let topLongShortRatio = 1;
      if (topRes.status === 'fulfilled' && topRes.value.ok) {
        const raw = await topRes.value.json() as LongShortRaw[];
        const entry = Array.isArray(raw) ? raw[0] : raw;
        topLongShortRatio = parseFloat((entry as LongShortRaw).longShortRatio ?? '1') || 1;
      }

      // ── Funding signal classification ──────────────────────────────────────
      let fundingSignal: DerivativesComponent['fundingSignal'] = 'NEUTRAL';
      if (fundingRate > 0.00015)       fundingSignal = 'LONG_HEAVY';  // longs paying > 0.015%
      else if (fundingRate < -0.00015) fundingSignal = 'SHORT_HEAVY'; // shorts paying

      // ── Score calculation ──────────────────────────────────────────────────
      let score = 0;

      // Funding: contrarian — overloaded longs get squeezed down; overloaded shorts squeezed up
      if (fundingSignal === 'LONG_HEAVY') {
        // Scale by magnitude: very high funding = bigger bearish signal
        const magnitude = Math.min(fundingRate / 0.001, 1); // cap at 0.1%
        score -= Math.round(magnitude * 20);
      } else if (fundingSignal === 'SHORT_HEAVY') {
        const magnitude = Math.min(Math.abs(fundingRate) / 0.001, 1);
        score += Math.round(magnitude * 20);
      }

      // L/S ratio: contrarian at extremes
      if (longShortRatio > 1.8) score -= 8;       // extreme long crowding
      else if (longShortRatio > 1.4) score -= 4;
      else if (longShortRatio < 0.6) score += 8;  // extreme short crowding
      else if (longShortRatio < 0.8) score += 4;

      // Top trader ratio (smarter money — weight slightly more)
      if (topLongShortRatio > 1.6) score -= 6;
      else if (topLongShortRatio < 0.65) score += 6;

      // Basis: positive = futures demand → mild bullish; negative → mild bearish
      if (basis > 0.05) score += 4;
      else if (basis < -0.05) score -= 4;

      // OI delta: expanding OI in direction of funding signal amplifies the contrarian
      if (openInterestDeltaPct > 1.5 && fundingSignal === 'LONG_HEAVY') score -= 4;
      if (openInterestDeltaPct > 1.5 && fundingSignal === 'SHORT_HEAVY') score += 4;

      const clampedScore = Math.max(-40, Math.min(40, score));
      const signal: DerivativesComponent['signal'] =
        clampedScore > 8 ? 'BULLISH' : clampedScore < -8 ? 'BEARISH' : 'NEUTRAL';

      this.cached = {
        fundingRate,
        fundingSignal,
        openInterestUsd,
        openInterestDeltaPct,
        longShortRatio,
        topLongShortRatio,
        basis,
        signal,
        score: clampedScore,
        fetchedAt: Date.now(),
      };

      console.log(
        `[derivatives] funding=${(fundingRate * 100).toFixed(4)}% L/S=${longShortRatio.toFixed(2)} ` +
        `topL/S=${topLongShortRatio.toFixed(2)} basis=${basis.toFixed(3)}% OIΔ=${openInterestDeltaPct.toFixed(2)}% ` +
        `→ ${signal} score=${clampedScore}`
      );
    } catch (err) {
      console.warn('[derivatives] Fetch failed (using stale):', err instanceof Error ? err.message : String(err));
    } finally {
      this.fetching = false;
    }
  }
}
