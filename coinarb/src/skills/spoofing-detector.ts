/**
 * D1 — Spoofing Detector
 *
 * Detects orders that appear on the CLOB with large size and disappear
 * within 1-2 poll cycles (< 6s). This is a spoofing pattern: fake depth
 * intended to mislead other traders about real supply/demand.
 *
 * When spoofing is active:
 *   - Sentiment Pulse's anomaly scores are unreliable
 *   - Depth Imbalance (A2) signals may be fake
 *   - Hard VETO: block all new entries for 60s
 *
 * Uses the orderbookHistory circular buffer added to PolymarketFeed.
 */

import type { PolymarketOrderbook } from '../feeds/polymarket-ws.js';

export interface SpoofingState {
  conditionId: string;
  spooferActive: boolean;
  spoofOrdersDetected: number;   // in last 30s (10 snapshots)
  lastSpoofAt: number;
  vetoActive: boolean;           // true: block new entries
  vetoExpiresAt: number;         // timestamp when veto lifts
}

const VETO_DURATION_MS     = 60_000;  // block entries for 60s after spoof detected
const SPOOF_SIZE_MULTIPLIER = 2.0;    // order must be > 2× mean size to flag
const MIN_SNAPSHOTS        = 3;       // need at least 3 snapshots to compare

class SpoofingDetectorImpl {
  private states: Map<string, SpoofingState> = new Map();

  getState(conditionId: string): SpoofingState {
    return this.states.get(conditionId) ?? {
      conditionId,
      spooferActive: false,
      spoofOrdersDetected: 0,
      lastSpoofAt: 0,
      vetoActive: false,
      vetoExpiresAt: 0,
    };
  }

  analyze(conditionId: string, history: PolymarketOrderbook[]): SpoofingState {
    const now = Date.now();
    const prev = this.states.get(conditionId) ?? this.getState(conditionId);

    // Lift veto if expired
    if (prev.vetoActive && now >= prev.vetoExpiresAt) {
      const lifted: SpoofingState = { ...prev, vetoActive: false, spoofOrdersDetected: 0 };
      this.states.set(conditionId, lifted);
      return lifted;
    }

    if (history.length < MIN_SNAPSHOTS) return prev;

    // Compute mean bid and ask sizes across history
    const meanBidSize = history.reduce((s, ob) => s + ob.bidSize, 0) / history.length;
    const meanAskSize = history.reduce((s, ob) => s + ob.askSize, 0) / history.length;

    // Detect "appeared and disappeared" — compare snapshot[t-2] vs snapshot[t-1] vs current
    let spoofCount = 0;

    for (let i = 2; i < history.length; i++) {
      const prev2 = history[i - 2];
      const prev1 = history[i - 1];
      const curr  = history[i];

      // Bid spoof: large bid appeared in prev1 but gone in curr
      const largeAppeared = prev1.bidSize > meanBidSize * SPOOF_SIZE_MULTIPLIER;
      const disappeared   = curr.bidSize < meanBidSize * 0.8;
      const wasNormal     = prev2.bidSize < meanBidSize * SPOOF_SIZE_MULTIPLIER;
      if (largeAppeared && disappeared && wasNormal) spoofCount++;

      // Ask spoof: large ask appeared in prev1 but gone in curr
      const largeAskAppeared = prev1.askSize > meanAskSize * SPOOF_SIZE_MULTIPLIER;
      const askDisappeared   = curr.askSize < meanAskSize * 0.8;
      const askWasNormal     = prev2.askSize < meanAskSize * SPOOF_SIZE_MULTIPLIER;
      if (largeAskAppeared && askDisappeared && askWasNormal) spoofCount++;
    }

    const spooferActive = spoofCount >= 2;
    const vetoActive    = spooferActive || (prev.vetoActive && now < prev.vetoExpiresAt);
    const vetoExpiresAt = spooferActive
      ? now + VETO_DURATION_MS
      : prev.vetoExpiresAt;

    const state: SpoofingState = {
      conditionId,
      spooferActive,
      spoofOrdersDetected: spoofCount,
      lastSpoofAt: spooferActive ? now : prev.lastSpoofAt,
      vetoActive,
      vetoExpiresAt,
    };
    this.states.set(conditionId, state);
    return state;
  }
}

export const spoofingDetector = new SpoofingDetectorImpl();
