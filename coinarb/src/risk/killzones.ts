/**
 * Killzone session gate.
 *
 * The new SMC pipeline only opens new entries during the high-volume
 * institutional sessions:
 *   - London: 07:00-10:00 UTC
 *   - New York: 13:00-16:00 UTC
 *
 * Outside these windows the bot only manages open positions (TP/SL still
 * active 24/7), no new trades.
 */

export type Killzone = 'LONDON' | 'NY' | 'NONE';

const LONDON_START_UTC = 7;
const LONDON_END_UTC = 10;
const NY_START_UTC = 13;
const NY_END_UTC = 16;

export function currentKillzone(now: Date = new Date()): Killzone {
  const utcH = now.getUTCHours();
  if (utcH >= LONDON_START_UTC && utcH < LONDON_END_UTC) return 'LONDON';
  if (utcH >= NY_START_UTC && utcH < NY_END_UTC) return 'NY';
  return 'NONE';
}

export function inKillzone(now: Date = new Date()): boolean {
  return currentKillzone(now) !== 'NONE';
}
