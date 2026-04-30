/**
 * Cascade manager (50x strategy).
 *
 * Decides whether to add a follow-on entry to a winning position. Each cascade
 * is recorded in `polyarb_positions.entry_reason.cascadeLevel` so the existing
 * settlement engine, telemetry, and dashboards handle them transparently.
 *
 * Rules:
 *  - Position must be up at least `cascadeTriggerPnl` (0.02 default).
 *  - At least 90 seconds must remain in the 5-min window (avoid late-entry settlement risk).
 *  - Cascade level must be < `cascadeMaxLevels` (3 default).
 *  - At most one cascade per market per 5 seconds (throttle).
 *  - Each cascade's Kelly = previous Kelly × `cascadeKellyDecay` (0.75 default).
 */

import type { Position } from '../../trading/position-tracker.js';
import type { FiftyXParams } from './config-50x.js';

interface MarketCascadeRecord {
  level: number;            // 0 = original entry, 1+ = cascade adds
  lastEntryAt: number;      // epoch ms of most recent add
  lastKelly: number;        // most recent Kelly fraction used
}

export class CascadeState {
  private readonly byMarket = new Map<string, MarketCascadeRecord>();

  /** Record an original (level 0) entry. */
  recordOriginal(conditionId: string, kellyFraction: number, now = Date.now()): void {
    this.byMarket.set(conditionId, { level: 0, lastEntryAt: now, lastKelly: kellyFraction });
  }

  /** Record a cascade add — bumps level and updates kelly. */
  recordCascade(conditionId: string, kellyFraction: number, now = Date.now()): void {
    const existing = this.byMarket.get(conditionId);
    if (!existing) {
      this.byMarket.set(conditionId, { level: 1, lastEntryAt: now, lastKelly: kellyFraction });
      return;
    }
    existing.level += 1;
    existing.lastEntryAt = now;
    existing.lastKelly = kellyFraction;
  }

  /** Reset state for a market once its position is closed. */
  reset(conditionId: string): void {
    this.byMarket.delete(conditionId);
  }

  getRecord(conditionId: string): MarketCascadeRecord | undefined {
    return this.byMarket.get(conditionId);
  }
}

const CASCADE_THROTTLE_MS = 5_000;
const MIN_WINDOW_LEFT_MS = 90_000;

export interface CascadeDecision {
  add: boolean;
  nextKellyFraction: number;
  nextLevel: number;
  reason: string;
}

/**
 * Decide whether to cascade into an open position.
 *
 * @param pos                  open position
 * @param currentMarketPrice   most recent Polymarket midPrice for the market
 * @param state                cascade state
 * @param params               50x params
 * @param msLeftInWindow       milliseconds before the 5-min window closes
 */
export function shouldCascade(
  pos: Position,
  currentMarketPrice: number,
  state: CascadeState,
  params: FiftyXParams,
  msLeftInWindow: number,
  now = Date.now(),
): CascadeDecision {
  const record = state.getRecord(pos.conditionId);
  const level = record?.level ?? 0;
  const baseKelly = record?.lastKelly ?? 0;

  // 1. Hit max levels → never cascade
  if (level >= params.cascadeMaxLevels) {
    return {
      add: false,
      nextKellyFraction: 0,
      nextLevel: level,
      reason: `cascade level ${level} ≥ max ${params.cascadeMaxLevels}`,
    };
  }

  // 2. Window almost closed → never cascade
  if (msLeftInWindow < MIN_WINDOW_LEFT_MS) {
    return {
      add: false,
      nextKellyFraction: 0,
      nextLevel: level,
      reason: `msLeft=${msLeftInWindow} < ${MIN_WINDOW_LEFT_MS}`,
    };
  }

  // 3. Throttle — at most one add per CASCADE_THROTTLE_MS per market
  if (record && now - record.lastEntryAt < CASCADE_THROTTLE_MS) {
    return {
      add: false,
      nextKellyFraction: 0,
      nextLevel: level,
      reason: `throttled — ${now - record.lastEntryAt}ms since last`,
    };
  }

  // 4. Position must be in profit by at least cascadeTriggerPnl
  if (pos.entryPrice <= 0) {
    return { add: false, nextKellyFraction: 0, nextLevel: level, reason: 'entryPrice=0' };
  }
  // For BUY YES: profit when current > entry. For BUY NO (where outcome NO uses NO-share price): same direction.
  const favourable = (currentMarketPrice - pos.entryPrice) / pos.entryPrice;
  if (favourable < params.cascadeTriggerPnl) {
    return {
      add: false,
      nextKellyFraction: 0,
      nextLevel: level,
      reason: `pnl=${(favourable * 100).toFixed(2)}% < trigger ${(params.cascadeTriggerPnl * 100).toFixed(2)}%`,
    };
  }

  // All gates passed — compute next Kelly with decay
  const nextKelly = baseKelly > 0
    ? baseKelly * params.cascadeKellyDecay
    : params.maxKellyFraction * params.cascadeKellyDecay;
  const nextLevel = level + 1;

  return {
    add: true,
    nextKellyFraction: nextKelly,
    nextLevel,
    reason: `cascade level=${nextLevel} pnl=${(favourable * 100).toFixed(2)}% kelly=${(nextKelly * 100).toFixed(2)}%`,
  };
}
