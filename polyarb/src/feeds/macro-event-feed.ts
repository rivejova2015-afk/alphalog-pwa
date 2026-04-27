/**
 * MacroEventFeed — schedule of high-impact macro events (CPI, FOMC, NFP, PPI).
 *
 * v1: hardcoded list of upcoming events. The detector flips MACRO_EVENT
 * active during a [-30min, +30min] window around eventTimeUtc.
 * v2 (future): fetch dynamically from Investing.com / ForexFactory.
 *
 * Times are ISO-8601 UTC strings — keep this list current.
 */

export type MacroEventType = 'CPI' | 'FOMC' | 'NFP' | 'PPI' | 'FOMC_MINUTES';

export interface MacroEventWindow {
  type: MacroEventType;
  eventTimeUtc: number;   // epoch ms
  windowStartMs: number;  // eventTime - 30min
  windowEndMs: number;    // eventTime + 30min
}

interface ScheduledEvent {
  type: MacroEventType;
  isoUtc: string;
}

const WINDOW_HALF_MS = 30 * 60_000;

// Hardcoded high-impact US macro events through Q3 2026.
// Update this list periodically. Past events auto-skip.
const SCHEDULE: ScheduledEvent[] = [
  // CPI — typically 8:30 AM ET (12:30/13:30 UTC depending on DST)
  { type: 'CPI',  isoUtc: '2026-05-13T12:30:00Z' },
  { type: 'CPI',  isoUtc: '2026-06-10T12:30:00Z' },
  { type: 'CPI',  isoUtc: '2026-07-15T12:30:00Z' },
  { type: 'CPI',  isoUtc: '2026-08-12T12:30:00Z' },
  { type: 'CPI',  isoUtc: '2026-09-10T12:30:00Z' },

  // FOMC rate decisions — 2:00 PM ET (18:00/19:00 UTC depending on DST)
  { type: 'FOMC', isoUtc: '2026-05-06T18:00:00Z' },
  { type: 'FOMC', isoUtc: '2026-06-17T18:00:00Z' },
  { type: 'FOMC', isoUtc: '2026-07-29T18:00:00Z' },
  { type: 'FOMC', isoUtc: '2026-09-16T18:00:00Z' },

  // NFP — 8:30 AM ET first Friday
  { type: 'NFP',  isoUtc: '2026-05-01T12:30:00Z' },
  { type: 'NFP',  isoUtc: '2026-06-05T12:30:00Z' },
  { type: 'NFP',  isoUtc: '2026-07-03T12:30:00Z' },
  { type: 'NFP',  isoUtc: '2026-08-07T12:30:00Z' },
  { type: 'NFP',  isoUtc: '2026-09-04T12:30:00Z' },

  // PPI — typically day before/after CPI
  { type: 'PPI',  isoUtc: '2026-05-14T12:30:00Z' },
  { type: 'PPI',  isoUtc: '2026-06-11T12:30:00Z' },
  { type: 'PPI',  isoUtc: '2026-07-16T12:30:00Z' },

  // FOMC Minutes — 3 weeks after each meeting, 2:00 PM ET
  { type: 'FOMC_MINUTES', isoUtc: '2026-05-27T18:00:00Z' },
  { type: 'FOMC_MINUTES', isoUtc: '2026-07-08T18:00:00Z' },
  { type: 'FOMC_MINUTES', isoUtc: '2026-08-19T18:00:00Z' },
];

export class MacroEventFeed {
  private windows: MacroEventWindow[] = [];

  constructor() {
    this.windows = SCHEDULE.map(s => {
      const t = Date.parse(s.isoUtc);
      return {
        type: s.type,
        eventTimeUtc: t,
        windowStartMs: t - WINDOW_HALF_MS,
        windowEndMs: t + WINDOW_HALF_MS,
      };
    }).sort((a, b) => a.eventTimeUtc - b.eventTimeUtc);
  }

  /** Returns the active window (if `now` is inside one), else null. */
  getCurrentWindow(now: number = Date.now()): MacroEventWindow | null {
    for (const w of this.windows) {
      if (now >= w.windowStartMs && now <= w.windowEndMs) return w;
      if (now < w.windowStartMs) break; // sorted — no need to scan further
    }
    return null;
  }

  /** v2 placeholder for dynamic feed. */
  async refresh(): Promise<void> {
    // no-op v1
  }

  /** Returns the next upcoming event (for telemetry / dashboard). */
  getNextEvent(now: number = Date.now()): MacroEventWindow | null {
    return this.windows.find(w => w.eventTimeUtc > now) ?? null;
  }
}
