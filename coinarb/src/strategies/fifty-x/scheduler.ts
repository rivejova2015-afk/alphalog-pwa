/**
 * 500x Session Scheduler — pure UTC-clock module.
 *
 * Maps the current UTC time to a trading session and returns the
 * recommended Kelly multiplier label + aggressivity. The actual
 * multiplier value is resolved by `KellyAdjuster500xOptionB` based on
 * whether the Day-10 validation has passed (aggressive vs safe table).
 *
 * No I/O, no state. Caller rate-limits the session-change log line.
 */

export type SessionName =
  | 'LONDON+NY_OVERLAP'
  | 'LONDON_ONLY'
  | 'NY_ONLY'
  | 'ASIA';

export type Aggressivity = 'EXTREME' | 'HIGH' | 'AGGRESSIVE' | 'CONSERVATIVE';

export interface SessionInfo {
  name: SessionName;
  aggressivity: Aggressivity;
  /** Recommended Kelly multiplier from the AGGRESSIVE table. */
  kellyMultiplier: number;
  /** Markets considered open (informational; not used for gating). */
  markets_open: string[];
  /** Approximate hours until the session boundary changes (informational). */
  hours_until_change: number;
}

const AGGRESSIVE_MULTIPLIERS: Record<SessionName, number> = {
  'LONDON+NY_OVERLAP': 2.5,
  LONDON_ONLY:         1.9,
  NY_ONLY:             2.2,
  ASIA:                1.0,
};

const AGGRESSIVITY: Record<SessionName, Aggressivity> = {
  'LONDON+NY_OVERLAP': 'EXTREME',
  LONDON_ONLY:         'HIGH',
  NY_ONLY:             'AGGRESSIVE',
  ASIA:                'CONSERVATIVE',
};

const MARKETS_OPEN: Record<SessionName, string[]> = {
  'LONDON+NY_OVERLAP': ['LONDON', 'NEW_YORK'],
  LONDON_ONLY:         ['LONDON'],
  NY_ONLY:             ['NEW_YORK'],
  ASIA:                ['TOKYO', 'HONG_KONG', 'SINGAPORE'],
};

export class TradeScheduler {
  /**
   * Decide the session by UTC clock.
   *  08:00 – 12:30  LONDON_ONLY
   *  12:30 – 16:30  LONDON+NY_OVERLAP
   *  16:30 – 19:00  NY_ONLY
   *  19:00 – 08:00  ASIA
   */
  getCurrentSession(now: Date = new Date()): SessionInfo {
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    const minutes = h * 60 + m;

    const LONDON_OPEN  =  8 * 60;        //  480
    const NY_OPEN      = 12 * 60 + 30;   //  750
    const LONDON_CLOSE = 16 * 60 + 30;   //  990
    const NY_CLOSE     = 19 * 60;        // 1140

    let name: SessionName;
    let nextBoundaryMin: number;

    if (minutes >= LONDON_OPEN && minutes < NY_OPEN) {
      name = 'LONDON_ONLY';
      nextBoundaryMin = NY_OPEN;
    } else if (minutes >= NY_OPEN && minutes < LONDON_CLOSE) {
      name = 'LONDON+NY_OVERLAP';
      nextBoundaryMin = LONDON_CLOSE;
    } else if (minutes >= LONDON_CLOSE && minutes < NY_CLOSE) {
      name = 'NY_ONLY';
      nextBoundaryMin = NY_CLOSE;
    } else {
      name = 'ASIA';
      nextBoundaryMin = minutes >= NY_CLOSE
        ? 24 * 60 + LONDON_OPEN   // wrap to next-day London
        : LONDON_OPEN;
    }

    const minutesUntil = Math.max(0, nextBoundaryMin - minutes);

    return {
      name,
      aggressivity: AGGRESSIVITY[name],
      kellyMultiplier: AGGRESSIVE_MULTIPLIERS[name],
      markets_open: MARKETS_OPEN[name],
      hours_until_change: Math.round((minutesUntil / 60) * 10) / 10,
    };
  }
}
