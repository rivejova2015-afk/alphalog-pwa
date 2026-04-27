/**
 * Dynamic Kelly cap — replaces the fixed `params.maxKellyFraction` (10%)
 * when an event is active. Linearly scales from baseCap → hard ceiling 0.40
 * proportional to event severity.
 *
 *   severity 0.0 → baseCap (e.g. 0.10)
 *   severity 0.5 → midpoint (e.g. 0.25)
 *   severity 1.0 → 0.40 (hard cap)
 *
 * Returns baseCap unchanged when:
 *   - flagAggressive is false (env POLYARB_KELLY_AGGRESSIVE not set)
 *   - eventState is inactive
 */

import type { EventState } from './event-detector.js';

export const HARD_KELLY_CEILING = 0.40;

export function effectiveKellyCap(
  baseCap: number,
  event: EventState,
  flagAggressive: boolean,
): number {
  if (!flagAggressive || !event.active) return baseCap;
  const ceiling = Math.max(baseCap, HARD_KELLY_CEILING);
  const sev = Math.max(0, Math.min(1, event.severity));
  const cap = baseCap + (ceiling - baseCap) * sev;
  return Math.min(ceiling, cap);
}
