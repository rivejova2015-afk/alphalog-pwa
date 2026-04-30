// CME Equity Futures Regular Trading Hours (RTH): 09:30–16:15 ET, Mon–Fri

const ET_OFFSET_STANDARD = -5 * 60; // minutes
const ET_OFFSET_DST      = -4 * 60;

function isEasternDST(date: Date): boolean {
  // DST in US: second Sunday of March → first Sunday of November
  const year = date.getUTCFullYear();
  const marchSecondSunday = getNthSundayOfMonth(year, 2, 2); // month=2 (March), nth=2
  const novFirstSunday    = getNthSundayOfMonth(year, 10, 1); // month=10 (Nov), nth=1
  return date >= marchSecondSunday && date < novFirstSunday;
}

function getNthSundayOfMonth(year: number, month: number, nth: number): Date {
  // month: 0-based JS month (2=March, 10=November)
  const first = new Date(Date.UTC(year, month, 1));
  const dayOfWeek = first.getUTCDay(); // 0=Sunday
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const firstSunday = new Date(Date.UTC(year, month, 1 + daysUntilSunday));
  return new Date(firstSunday.getTime() + (nth - 1) * 7 * 24 * 60 * 60 * 1000);
}

function toETMinutes(utcDate: Date): { dayOfWeek: number; minutesOfDay: number } {
  const offsetMin = isEasternDST(utcDate) ? ET_OFFSET_DST : ET_OFFSET_STANDARD;
  const etMs = utcDate.getTime() + offsetMin * 60 * 1000;
  const etDate = new Date(etMs);
  return {
    dayOfWeek: etDate.getUTCDay(), // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    minutesOfDay: etDate.getUTCHours() * 60 + etDate.getUTCMinutes(),
  };
}

export function isMarketHours(now: Date = new Date()): boolean {
  const { dayOfWeek, minutesOfDay } = toETMinutes(now);
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // weekend
  const open  = 9 * 60 + 30;  // 09:30
  const close = 16 * 60 + 15; // 16:15
  return minutesOfDay >= open && minutesOfDay < close;
}

export function nextMarketOpen(now: Date = new Date()): Date {
  const candidate = new Date(now);
  for (let i = 0; i < 7; i++) {
    candidate.setUTCDate(candidate.getUTCDate() + (i === 0 ? 0 : 1));
    const { dayOfWeek, minutesOfDay } = toETMinutes(candidate);
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    if (i === 0 && minutesOfDay >= 9 * 60 + 30 && minutesOfDay < 16 * 60 + 15) {
      return now; // already open
    }
    const offsetMin = isEasternDST(candidate) ? ET_OFFSET_DST : ET_OFFSET_STANDARD;
    const openUTC = new Date(
      Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate(),
        9, 30) - offsetMin * 60 * 1000
    );
    if (openUTC > now) return openUTC;
  }
  return now;
}
