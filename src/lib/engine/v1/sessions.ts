// Session guard — checks whether the current UTC time falls within any of the
// declared trading windows for the given symbol. When no sessions are declared
// (default config), trading is permitted 24/7 — the engine simply respects what
// the template says, and `null` sessions mean "always on".

import type { SessionWindow } from "./types";

function hhmmToMinutes(hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map((s) => parseInt(s, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return -1;
  return hh * 60 + mm;
}

export function inAnySession(sessions: SessionWindow[] | null | undefined, now: Date): boolean {
  if (!sessions || sessions.length === 0) return true;
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  for (const s of sessions) {
    const start = hhmmToMinutes(s.start_gmt);
    const end   = hhmmToMinutes(s.end_gmt);
    if (start < 0 || end < 0) continue;
    if (start <= end) {
      if (minutes >= start && minutes < end) return true;
    } else {
      // Wraps midnight (e.g. 22:00 → 06:00)
      if (minutes >= start || minutes < end) return true;
    }
  }
  return false;
}
