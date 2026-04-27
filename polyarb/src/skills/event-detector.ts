/**
 * EventDetector — hybrid mode trigger for polyarb.
 *
 * Runs once per tick over data already collected by other engines.
 * Returns an EventState describing whether the bot should switch
 * from latency-only mode to event-triggered mode (Kelly cap up,
 * profit target down, quorum loosened, EVENT_TRIGGER vote injected).
 *
 * Cascade priority (first to exceed severity 0.4 wins):
 *   MACRO > VELOCITY_JUMP > FUNDING_CLIFF > ODDS_CLIFF > SPREAD > VOLUME
 *
 * Failure mode: any thrown exception → returns INACTIVE (bot operates
 * in NORMAL mode). EventDetector NEVER blocks the loop.
 */

import type { PolymarketOrderbook } from '../feeds/polymarket-ws.js';
import type { FundingMomentumSignal } from '../analysis/providers/funding-momentum.js';
import type { RegimeState } from './regime-detector.js';
import type { MacroEventWindow } from '../feeds/macro-event-feed.js';
import type { PriceSample } from './velocity-detector.js';

export type EventType =
  | 'VELOCITY_JUMP'
  | 'SPREAD_EXPLOSION'
  | 'VOLUME_SURGE'
  | 'FUNDING_CLIFF'
  | 'ODDS_CLIFF'
  | 'MACRO_EVENT';

export interface EventState {
  active: boolean;
  type: EventType | null;
  severity: number;      // 0..1
  detectedAt: number;
  ttlMs: number;
  reason: string;
}

export interface EventDetectorContext {
  /** Recent snapshots of the active polymarket orderbook (any market). */
  orderbookHistory: PolymarketOrderbook[];
  /** Latest BTC price samples with timestamps for velocity-jump detection. */
  binanceSamples: PriceSample[];
  fundingMomentum: FundingMomentumSignal | null;
  regime: RegimeState | null;
  macroNow: MacroEventWindow | null;
}

const DEFAULT_TTL_MS = 60_000;
const MIN_SEVERITY_TO_TRIGGER = 0.4;

const VELOCITY_JUMP_THRESHOLD = 0.006;   // 0.6%
const VELOCITY_JUMP_MAX       = 0.012;   // 1.2% → severity 1.0
const VELOCITY_WINDOW_MS      = 5_000;

const SPREAD_RATIO_THRESHOLD = 4;
const SPREAD_RATIO_MAX       = 8;

const VOLUME_RATIO_THRESHOLD = 5;
const VOLUME_RATIO_MAX       = 10;

const ODDS_CLIFF_THRESHOLD = 0.05;
const ODDS_CLIFF_MAX       = 0.10;

const MACRO_SEVERITY = 0.85;

const INACTIVE: EventState = {
  active: false,
  type: null,
  severity: 0,
  detectedAt: 0,
  ttlMs: 0,
  reason: 'inactive',
};

export class EventDetector {
  evaluate(ctx: EventDetectorContext): EventState {
    try {
      const now = Date.now();

      // 1) MACRO — highest priority
      if (ctx.macroNow) {
        return {
          active: true,
          type: 'MACRO_EVENT',
          severity: MACRO_SEVERITY,
          detectedAt: now,
          ttlMs: Math.max(DEFAULT_TTL_MS, ctx.macroNow.windowEndMs - now),
          reason: `macro=${ctx.macroNow.type} ends=${new Date(ctx.macroNow.windowEndMs).toISOString()}`,
        };
      }

      // 2) VELOCITY_JUMP
      const vj = this.detectVelocityJump(ctx.binanceSamples, now);
      if (vj && vj.severity >= MIN_SEVERITY_TO_TRIGGER) {
        return {
          active: true,
          type: 'VELOCITY_JUMP',
          severity: vj.severity,
          detectedAt: now,
          ttlMs: DEFAULT_TTL_MS,
          reason: `dPx=${(vj.delta * 100).toFixed(2)}% in ${vj.windowMs}ms`,
        };
      }

      // 3) FUNDING_CLIFF
      const fc = this.detectFundingCliff(ctx.fundingMomentum);
      if (fc && fc.severity >= MIN_SEVERITY_TO_TRIGGER) {
        return {
          active: true,
          type: 'FUNDING_CLIFF',
          severity: fc.severity,
          detectedAt: now,
          ttlMs: DEFAULT_TTL_MS,
          reason: `fundingVel=${fc.velocity.toFixed(5)}%/min cascade=HIGH`,
        };
      }

      // 4) ODDS_CLIFF
      const oc = this.detectOddsCliff(ctx.orderbookHistory);
      if (oc && oc.severity >= MIN_SEVERITY_TO_TRIGGER) {
        return {
          active: true,
          type: 'ODDS_CLIFF',
          severity: oc.severity,
          detectedAt: now,
          ttlMs: DEFAULT_TTL_MS,
          reason: `dFair=${oc.delta.toFixed(3)} in ${oc.windowMs}ms`,
        };
      }

      // 5) SPREAD_EXPLOSION
      const se = this.detectSpreadExplosion(ctx.orderbookHistory);
      if (se && se.severity >= MIN_SEVERITY_TO_TRIGGER) {
        return {
          active: true,
          type: 'SPREAD_EXPLOSION',
          severity: se.severity,
          detectedAt: now,
          ttlMs: DEFAULT_TTL_MS,
          reason: `spread×${se.ratio.toFixed(1)} vs avg`,
        };
      }

      // 6) VOLUME_SURGE
      const vs = this.detectVolumeSurge(ctx.orderbookHistory);
      if (vs && vs.severity >= MIN_SEVERITY_TO_TRIGGER) {
        return {
          active: true,
          type: 'VOLUME_SURGE',
          severity: vs.severity,
          detectedAt: now,
          ttlMs: DEFAULT_TTL_MS,
          reason: `depth×${vs.ratio.toFixed(1)} vs avg`,
        };
      }

      return INACTIVE;
    } catch {
      // Never block trading on a detector failure.
      return INACTIVE;
    }
  }

  private detectVelocityJump(
    samples: PriceSample[],
    now: number,
  ): { delta: number; severity: number; windowMs: number } | null {
    if (!samples || samples.length < 2) return null;
    const recent = samples.filter(s => now - s.timestamp <= VELOCITY_WINDOW_MS);
    if (recent.length < 2) return null;

    const first = recent[0];
    const last = recent[recent.length - 1];
    if (!first || !last || first.price <= 0) return null;

    const delta = (last.price - first.price) / first.price;
    const absDelta = Math.abs(delta);
    if (absDelta < VELOCITY_JUMP_THRESHOLD) return null;

    const severity = Math.min(1, absDelta / VELOCITY_JUMP_MAX);
    return { delta, severity, windowMs: last.timestamp - first.timestamp };
  }

  private detectFundingCliff(
    fm: FundingMomentumSignal | null,
  ): { velocity: number; severity: number } | null {
    if (!fm) return null;
    if (fm.cascadeRisk !== 'HIGH') return null;
    return { velocity: fm.fundingVelocity, severity: Math.min(1, fm.confidence) };
  }

  private detectOddsCliff(
    history: PolymarketOrderbook[],
  ): { delta: number; severity: number; windowMs: number } | null {
    if (!history || history.length < 3) return null;
    const last = history[history.length - 1];
    const earlier = history[history.length - 3];
    if (!last || !earlier) return null;

    const delta = Math.abs(last.midPrice - earlier.midPrice);
    if (delta < ODDS_CLIFF_THRESHOLD) return null;

    const severity = Math.min(1, delta / ODDS_CLIFF_MAX);
    return { delta, severity, windowMs: last.timestamp - earlier.timestamp };
  }

  private detectSpreadExplosion(
    history: PolymarketOrderbook[],
  ): { ratio: number; severity: number } | null {
    if (!history || history.length < 5) return null;
    const last = history[history.length - 1];
    if (!last) return null;

    const baseline = history.slice(0, -1);
    const avgSpread =
      baseline.reduce((s, ob) => s + ob.spread, 0) / baseline.length;
    if (avgSpread <= 0) return null;

    const ratio = last.spread / avgSpread;
    if (ratio < SPREAD_RATIO_THRESHOLD) return null;

    const severity = Math.min(1, ratio / SPREAD_RATIO_MAX);
    return { ratio, severity };
  }

  private detectVolumeSurge(
    history: PolymarketOrderbook[],
  ): { ratio: number; severity: number } | null {
    if (!history || history.length < 5) return null;
    const last = history[history.length - 1];
    if (!last) return null;

    const baseline = history.slice(0, -1);
    const avgDepth =
      baseline.reduce((s, ob) => s + ob.bidSize + ob.askSize, 0) /
      baseline.length;
    if (avgDepth <= 0) return null;

    const lastDepth = last.bidSize + last.askSize;
    const ratio = lastDepth / avgDepth;
    if (ratio < VOLUME_RATIO_THRESHOLD) return null;

    const severity = Math.min(1, ratio / VOLUME_RATIO_MAX);
    return { ratio, severity };
  }
}

export function inactiveEventState(): EventState {
  return { ...INACTIVE };
}
