import type { XpData } from "./xp";

// Habit-layer helpers: daily goal (XP earned today) and a lenient streak that
// bridges short gaps ("streak freeze") so a single missed day doesn't reset it.

export const DEFAULT_DAILY_GOAL = 50;

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

// XP attributed to activity that happened on a given UTC day (for the daily goal
// ring). This counts per-event activity, distinct from the cumulative best-based
// XP used for the overall level.
export function xpEarnedOn(data: XpData, day: string): number {
  let xp = 0;
  for (const r of data.quizResults) if (r.taken_at && dayKey(r.taken_at) === day) xp += r.score * 10;
  for (const e of data.examResults) if (e.taken_at && dayKey(e.taken_at) === day) xp += e.score * 5;
  for (const h of Object.values(data.homework)) {
    if (h.graded_at && dayKey(h.graded_at) === day) xp += (h.points ?? 0) * 3;
  }
  return xp;
}

export function xpEarnedToday(data: XpData, today: Date = new Date()): number {
  return xpEarnedOn(data, today.toISOString().slice(0, 10));
}

export interface StreakResult { streak: number; frozenUsed: number }

/**
 * Consecutive active days ending today, allowing up to `allowedGaps` missed days
 * to be "frozen" (bridged) instead of breaking the streak. Frozen days don't add
 * to the count but keep the chain alive — same spirit as Duolingo's streak freeze.
 */
export function streakWithFreeze(
  daySet: Set<string>,
  today: Date = new Date(),
  allowedGaps = 2,
): StreakResult {
  let streak = 0;
  let pendingGaps = 0;   // missed days seen since the last active day
  let frozenUsed = 0;    // gaps that actually bridged to another active day
  const d = new Date(today);
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (daySet.has(key)) {
      streak += 1;
      frozenUsed += pendingGaps; // those pending gaps were validly bridged
      pendingGaps = 0;
    } else {
      pendingGaps += 1;
      if (pendingGaps > allowedGaps) break; // can't bridge this gap within budget
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return { streak, frozenUsed };
}

export function activityDays(data: XpData): Set<string> {
  const days = new Set<string>();
  for (const r of data.quizResults) if (r.taken_at) days.add(dayKey(r.taken_at));
  for (const e of data.examResults) if (e.taken_at) days.add(dayKey(e.taken_at));
  for (const h of Object.values(data.homework)) {
    if (h.submitted_at) days.add(dayKey(h.submitted_at));
    if (h.graded_at) days.add(dayKey(h.graded_at));
  }
  return days;
}
