/**
 * EventPositionManager — exit logic for positions opened during an event.
 *
 * When a position has `entryReason.eventType != null` (was opened in
 * EVENT-TRIGGERED mode), the manager checks whether the move that
 * justified the entry has reversed. If so, exit immediately rather
 * than holding to expiry.
 *
 * Rule:
 *   exit if velocity has flipped against the position direction by
 *   more than 50% of the original move strength, AND there are still
 *   > 60s left in the window (no exit in the last 60s — let it resolve).
 *
 * Failure mode: any exception → returns { exit: false } (no early exit).
 */

import type { Position } from '../trading/position-tracker.js';
import type { VelocitySignal } from './velocity-detector.js';
import type { EventState } from './event-detector.js';
import { extractWindowInfo, isNearExpiry } from '../trading/window-gate.js';

export interface EventExitDecision {
  exit: boolean;
  reason: string;
}

const REVERSAL_FRACTION = 0.5;
const MIN_TIME_LEFT_MS  = 60_000;

export function shouldExitOnEventReversal(
  pos: Position,
  velocity: VelocitySignal | null,
  eventState: EventState,
  now: number = Date.now(),
): EventExitDecision {
  try {
    // Only act on positions opened during an event
    const entryEventType = (pos.entryReason as { eventType?: string | null })?.eventType;
    if (!entryEventType) return { exit: false, reason: 'not_event_position' };

    if (!velocity) return { exit: false, reason: 'no_velocity_signal' };

    // Don't exit in the last 60s — let market resolution handle it
    const windowInfo = extractWindowInfo(pos.marketSlug);
    if (windowInfo && isNearExpiry(windowInfo, now, MIN_TIME_LEFT_MS)) {
      return { exit: false, reason: 'too_close_to_expiry' };
    }

    // Use 5m velocity window as the canonical direction signal
    const w5m = velocity.windows.find(w => w.label === '5m');
    if (!w5m) return { exit: false, reason: 'no_5m_window' };

    const positionDir: 'UP' | 'DOWN' = pos.outcome === 'YES' ? 'UP' : 'DOWN';

    // Reversal: current 5m direction is opposite to position
    if (w5m.direction === 'FLAT') return { exit: false, reason: 'flat' };
    if (w5m.direction === positionDir) return { exit: false, reason: 'still_aligned' };

    // Magnitude check — only exit if reversal is strong (≥ 50% of severity-implied move)
    const reversalStrength = Math.abs(w5m.velocity);
    const reversalThreshold = REVERSAL_FRACTION * eventState.severity;
    if (reversalStrength < reversalThreshold) {
      return { exit: false, reason: 'reversal_too_weak' };
    }

    return {
      exit: true,
      reason: `event_reversal type=${entryEventType} 5mDir=${w5m.direction} v=${w5m.velocity.toFixed(2)}`,
    };
  } catch {
    return { exit: false, reason: 'exception' };
  }
}
