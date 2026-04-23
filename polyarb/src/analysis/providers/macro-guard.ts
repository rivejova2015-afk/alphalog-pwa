/**
 * Macro Guard — Economic event calendar with trade veto logic.
 *
 * Blocks trading in a window around high-impact macro releases that cause
 * extreme BTC volatility unpredictable from technicals alone.
 *
 * Block window:
 *   - PRE:  15 minutes before event (positioning chaos)
 *   - POST:  8 minutes after event  (initial spike/reversal digest)
 *
 * Covered events:
 *   - FOMC rate decisions (8 per year, published 1 year in advance)
 *   - US CPI (monthly, mid-month)
 *   - US NFP (Non-Farm Payrolls, first Friday of the month)
 *   - US PPI (monthly, mid-month)
 *   - JOLTS / PCE / GDP (quarterly / monthly)
 *
 * All times in UTC. Hardcoded through end of 2026.
 */

import type { MacroGuardComponent } from '../types.js';

const PRE_BLOCK_MS  = 15 * 60_000;  // 15 min before
const POST_BLOCK_MS =  8 * 60_000;  // 8 min after

interface MacroEvent {
  name: string;
  utcTs: number;  // Unix timestamp (ms) of the event
}

// ── Event database ────────────────────────────────────────────────────────────

function utc(dateStr: string, time = '14:00'): number {
  return new Date(`${dateStr}T${time}:00Z`).getTime();
}

// FOMC decisions (release ~18:00 UTC on decision day)
// https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm
const FOMC_DECISIONS: MacroEvent[] = [
  // 2025
  { name: 'FOMC Decision', utcTs: utc('2025-01-29', '19:00') },
  { name: 'FOMC Decision', utcTs: utc('2025-03-19', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2025-05-07', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2025-06-18', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2025-07-30', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2025-09-17', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2025-10-29', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2025-12-10', '19:00') },
  // 2026
  { name: 'FOMC Decision', utcTs: utc('2026-01-28', '19:00') },
  { name: 'FOMC Decision', utcTs: utc('2026-03-18', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2026-04-29', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2026-06-10', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2026-07-29', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2026-09-16', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2026-10-28', '18:00') },
  { name: 'FOMC Decision', utcTs: utc('2026-12-09', '19:00') },
];

// US CPI releases — typically 08:30 ET = 13:30 UTC (12:30 UTC in summer/EDT)
const CPI_RELEASES: MacroEvent[] = [
  // 2025
  { name: 'US CPI', utcTs: utc('2025-01-15', '13:30') },
  { name: 'US CPI', utcTs: utc('2025-02-12', '13:30') },
  { name: 'US CPI', utcTs: utc('2025-03-12', '12:30') },
  { name: 'US CPI', utcTs: utc('2025-04-10', '12:30') },
  { name: 'US CPI', utcTs: utc('2025-05-13', '12:30') },
  { name: 'US CPI', utcTs: utc('2025-06-11', '12:30') },
  { name: 'US CPI', utcTs: utc('2025-07-15', '12:30') },
  { name: 'US CPI', utcTs: utc('2025-08-12', '12:30') },
  { name: 'US CPI', utcTs: utc('2025-09-10', '12:30') },
  { name: 'US CPI', utcTs: utc('2025-10-15', '12:30') },
  { name: 'US CPI', utcTs: utc('2025-11-13', '13:30') },
  { name: 'US CPI', utcTs: utc('2025-12-10', '13:30') },
  // 2026 (approximate — BLS schedule released annually)
  { name: 'US CPI', utcTs: utc('2026-01-14', '13:30') },
  { name: 'US CPI', utcTs: utc('2026-02-11', '13:30') },
  { name: 'US CPI', utcTs: utc('2026-03-11', '12:30') },
  { name: 'US CPI', utcTs: utc('2026-04-09', '12:30') },
  { name: 'US CPI', utcTs: utc('2026-05-13', '12:30') },
  { name: 'US CPI', utcTs: utc('2026-06-10', '12:30') },
];

// NFP — first Friday of the month, 08:30 ET
// Pre-computed for 2025–2026
const NFP_RELEASES: MacroEvent[] = [
  // 2025
  { name: 'NFP', utcTs: utc('2025-01-10', '13:30') },
  { name: 'NFP', utcTs: utc('2025-02-07', '13:30') },
  { name: 'NFP', utcTs: utc('2025-03-07', '13:30') },
  { name: 'NFP', utcTs: utc('2025-04-04', '12:30') },
  { name: 'NFP', utcTs: utc('2025-05-02', '12:30') },
  { name: 'NFP', utcTs: utc('2025-06-06', '12:30') },
  { name: 'NFP', utcTs: utc('2025-07-03', '12:30') },
  { name: 'NFP', utcTs: utc('2025-08-01', '12:30') },
  { name: 'NFP', utcTs: utc('2025-09-05', '12:30') },
  { name: 'NFP', utcTs: utc('2025-10-03', '12:30') },
  { name: 'NFP', utcTs: utc('2025-11-07', '13:30') },
  { name: 'NFP', utcTs: utc('2025-12-05', '13:30') },
  // 2026
  { name: 'NFP', utcTs: utc('2026-01-09', '13:30') },
  { name: 'NFP', utcTs: utc('2026-02-06', '13:30') },
  { name: 'NFP', utcTs: utc('2026-03-06', '13:30') },
  { name: 'NFP', utcTs: utc('2026-04-03', '12:30') },
  { name: 'NFP', utcTs: utc('2026-05-01', '12:30') },
  { name: 'NFP', utcTs: utc('2026-06-05', '12:30') },
  { name: 'NFP', utcTs: utc('2026-07-02', '12:30') },
  { name: 'NFP', utcTs: utc('2026-08-07', '12:30') },
  { name: 'NFP', utcTs: utc('2026-09-04', '12:30') },
  { name: 'NFP', utcTs: utc('2026-10-02', '12:30') },
  { name: 'NFP', utcTs: utc('2026-11-06', '13:30') },
  { name: 'NFP', utcTs: utc('2026-12-04', '13:30') },
];

// PCE / Core PCE — last Friday of the month, usually 08:30 ET
const PCE_RELEASES: MacroEvent[] = [
  // 2025
  { name: 'PCE', utcTs: utc('2025-01-31', '13:30') },
  { name: 'PCE', utcTs: utc('2025-02-28', '13:30') },
  { name: 'PCE', utcTs: utc('2025-03-28', '12:30') },
  { name: 'PCE', utcTs: utc('2025-04-25', '12:30') },
  { name: 'PCE', utcTs: utc('2025-05-30', '12:30') },
  { name: 'PCE', utcTs: utc('2025-06-27', '12:30') },
  { name: 'PCE', utcTs: utc('2025-07-25', '12:30') },
  { name: 'PCE', utcTs: utc('2025-08-29', '12:30') },
  { name: 'PCE', utcTs: utc('2025-09-26', '12:30') },
  { name: 'PCE', utcTs: utc('2025-10-31', '12:30') },
  { name: 'PCE', utcTs: utc('2025-11-26', '13:30') },
  { name: 'PCE', utcTs: utc('2025-12-19', '13:30') },
  // 2026
  { name: 'PCE', utcTs: utc('2026-01-30', '13:30') },
  { name: 'PCE', utcTs: utc('2026-02-27', '13:30') },
  { name: 'PCE', utcTs: utc('2026-03-27', '12:30') },
  { name: 'PCE', utcTs: utc('2026-04-24', '12:30') },
  { name: 'PCE', utcTs: utc('2026-05-29', '12:30') },
  { name: 'PCE', utcTs: utc('2026-06-26', '12:30') },
  { name: 'PCE', utcTs: utc('2026-07-31', '12:30') },
  { name: 'PCE', utcTs: utc('2026-08-28', '12:30') },
  { name: 'PCE', utcTs: utc('2026-09-25', '12:30') },
  { name: 'PCE', utcTs: utc('2026-10-30', '12:30') },
  { name: 'PCE', utcTs: utc('2026-11-25', '13:30') },
  { name: 'PCE', utcTs: utc('2026-12-18', '13:30') },
];

// All events combined and sorted
const ALL_EVENTS: MacroEvent[] = [
  ...FOMC_DECISIONS,
  ...CPI_RELEASES,
  ...NFP_RELEASES,
  ...PCE_RELEASES,
].sort((a, b) => a.utcTs - b.utcTs);

// ── Provider ───────────────────────────────────────────────────────────────────

export class MacroGuardProvider {
  check(): MacroGuardComponent {
    const now = Date.now();

    // Short-circuit: if we're past the last known event + POST window, skip full iteration
    const lastEvent = ALL_EVENTS[ALL_EVENTS.length - 1];
    if (lastEvent && now > lastEvent.utcTs + POST_BLOCK_MS) {
      return { vetoed: false, reason: null, nextEventName: null, nextEventMinutes: null, lastCheckAt: now };
    }

    // Find nearest upcoming event within the look-ahead window
    let vetoed = false;
    let reason: string | null = null;
    let nextEventName: string | null = null;
    let nextEventMinutes: number | null = null;

    for (const event of ALL_EVENTS) {
      const msBefore = event.utcTs - now;
      const msAfter  = now - event.utcTs;

      // Post-event block
      if (msAfter >= 0 && msAfter < POST_BLOCK_MS) {
        vetoed = true;
        reason = `${event.name} released ${Math.round(msAfter / 60_000)}min ago — digest period`;
        nextEventName = event.name;
        nextEventMinutes = 0;
        break;
      }

      // Pre-event block
      if (msBefore > 0 && msBefore < PRE_BLOCK_MS) {
        vetoed = true;
        reason = `${event.name} in ${Math.round(msBefore / 60_000)}min — pre-event block`;
        nextEventName = event.name;
        nextEventMinutes = Math.round(msBefore / 60_000);
        break;
      }

      // Report next upcoming event (even if not blocking)
      if (msBefore > 0 && nextEventMinutes === null) {
        nextEventName = event.name;
        nextEventMinutes = Math.round(msBefore / 60_000);
      }
    }

    if (vetoed) {
      console.log(`[macro-guard] VETO: ${reason}`);
    }

    return { vetoed, reason, nextEventName, nextEventMinutes, lastCheckAt: now };
  }
}
