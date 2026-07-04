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

/**
 * True when CME Globex (electronic) is open for equity-index/metals/energy
 * futures. Globex runs Sunday 18:00 ET → Friday 17:00 ET, with a daily 60-min
 * maintenance break 17:00–18:00 ET on weekdays.
 *
 * Used by the dispatcher cron (Sprint S) to early-skip when no instrument
 * can fill — saves Yahoo/Tradovate API budget during the weekend and the
 * nightly maintenance window.
 *
 * Note: per-contract sessions vary slightly (grains shorter, FX nearly 24/5).
 * This function picks the most common Globex window (index/metals/energy) as
 * a conservative default. Algos that need wider coverage can override via
 * `parameters.session_filter='always'`.
 */
export function isGlobexOpen(now: Date = new Date()): boolean {
  const { dayOfWeek, minutesOfDay } = toETMinutes(now);
  // Saturday: fully closed.
  if (dayOfWeek === 6) return false;
  // Sunday: opens at 18:00 ET.
  if (dayOfWeek === 0) return minutesOfDay >= 18 * 60;
  // Friday: closes at 17:00 ET.
  if (dayOfWeek === 5) return minutesOfDay < 17 * 60;
  // Monday–Thursday: closed for the 17:00–18:00 ET maintenance window.
  if (minutesOfDay >= 17 * 60 && minutesOfDay < 18 * 60) return false;
  return true;
}

/** Helper público para convertir una fecha UTC a (dayOfWeek, minutesOfDay) en ET
 *  con DST awareness. Usar para chequeos custom como weekend policy propfirm. */
export function nowToEt(utcDate: Date): { dayOfWeek: number; minutesOfDay: number } {
  return toETMinutes(utcDate);
}

export function isMarketHours(now: Date = new Date()): boolean {
  const { dayOfWeek, minutesOfDay } = toETMinutes(now);
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // weekend
  const open  = 9 * 60 + 30;  // 09:30
  const close = 16 * 60 + 15; // 16:15
  return minutesOfDay >= open && minutesOfDay < close;
}

/** Parsea "HH:MM" → minutos del día. Devuelve -1 si el formato es inválido. */
function parseHHMM(hhmm: string): number {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return -1;
  return h * 60 + mm;
}

/** True si la hora ET actual es ≥ cutoffHHMM (formato "HH:MM"). Sábado cuenta
 *  como "past cutoff" todo el día (Globex cerrado). Domingo solo cuenta como
 *  "past cutoff" ANTES de las 18:00 ET (igual que isGlobexOpen) — desde que
 *  Globex reabre el domingo a la noche, el cutoff (un concepto de cierre de
 *  día hábil) ya no aplica y debe permitirse la primera orden de la semana.
 *  Sirve para enforcement del overnight cutoff propfirm. */
export function isPastCutoffEt(now: Date, cutoffHHMM: string): boolean {
  const cutoffMin = parseHHMM(cutoffHHMM);
  if (cutoffMin < 0) return false; // formato inválido → no bloquea
  const { dayOfWeek, minutesOfDay } = toETMinutes(now);
  if (dayOfWeek === 6) return true; // sábado: Globex cerrado todo el día
  if (dayOfWeek === 0) return minutesOfDay < 18 * 60; // domingo: bloqueado solo antes de la reapertura
  return minutesOfDay >= cutoffMin;
}

/** Hora ET actual en formato "HH:MM" — para audit logs y mensajes de reason. */
export function nowEtHHMM(now: Date = new Date()): string {
  const { minutesOfDay } = toETMinutes(now);
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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
