/**
 * Circuit breaker: pauses trading after a streak of losses, hard-stops at the
 * daily trade cap.
 *
 *   - 6 consecutive losses → 3h pause (loss streak resets on any win)
 *   - 100 trades in a UTC day → hard stop until next UTC day
 *
 * State lives in-memory (loop singleton); on restart we hydrate from
 * coinarb_telemetry's last row so a Fly redeploy doesn't reset the streak.
 */

import { CIRCUIT_LOSS_LIMIT, CIRCUIT_PAUSE_MS, DAILY_TRADE_CAP } from '../core/config.js';

export type CircuitDecision =
  | { allow: true }
  | { allow: false; reason: 'loss-streak' | 'daily-cap'; pausedUntil?: number };

export class CircuitBreaker {
  private consecutiveLosses = 0;
  private dailyTrades = 0;
  private dailyDayUtc: string = todayUtc();
  private pausedUntil: number | null = null;

  hydrate(state: { consecutiveLosses?: number; dailyTrades?: number; pausedUntil?: number | null; dayUtc?: string }): void {
    this.consecutiveLosses = state.consecutiveLosses ?? 0;
    this.dailyTrades = state.dailyTrades ?? 0;
    this.pausedUntil = state.pausedUntil ?? null;
    this.dailyDayUtc = state.dayUtc ?? todayUtc();
  }

  get snapshot() {
    return {
      consecutiveLosses: this.consecutiveLosses,
      dailyTrades: this.dailyTrades,
      pausedUntil: this.pausedUntil,
      dayUtc: this.dailyDayUtc,
    };
  }

  /** Should the loop be allowed to enter a new trade right now? */
  canTrade(now: number = Date.now()): CircuitDecision {
    this.rolloverIfNeeded();

    if (this.pausedUntil !== null && now < this.pausedUntil) {
      return { allow: false, reason: 'loss-streak', pausedUntil: this.pausedUntil };
    }
    if (this.pausedUntil !== null && now >= this.pausedUntil) {
      this.pausedUntil = null;
      this.consecutiveLosses = 0;
    }

    if (this.dailyTrades >= DAILY_TRADE_CAP) {
      return { allow: false, reason: 'daily-cap' };
    }

    return { allow: true };
  }

  /** Record a fresh entry (counts toward daily cap regardless of outcome). */
  recordOpen(): void {
    this.rolloverIfNeeded();
    this.dailyTrades += 1;
  }

  /** Record a closed trade outcome. PnL > 0 = win, PnL <= 0 = loss. */
  recordClose(pnlUsd: number, now: number = Date.now()): void {
    if (pnlUsd > 0) {
      this.consecutiveLosses = 0;
      return;
    }
    this.consecutiveLosses += 1;
    if (this.consecutiveLosses >= CIRCUIT_LOSS_LIMIT) {
      this.pausedUntil = now + CIRCUIT_PAUSE_MS;
      console.warn(
        `[circuit-breaker] ${CIRCUIT_LOSS_LIMIT} consecutive losses — paused until ${new Date(this.pausedUntil).toISOString()}`,
      );
    }
  }

  private rolloverIfNeeded(): void {
    const today = todayUtc();
    if (today !== this.dailyDayUtc) {
      this.dailyDayUtc = today;
      this.dailyTrades = 0;
    }
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
