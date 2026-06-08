/**
 * Pure helpers for Terminal Reports Bot scheduling.
 *
 * The UI lets the user pick a local Puerto Rico (UTC-4 year-round, no DST)
 * datetime; QStash takes a UTC cron expression. These functions translate.
 *
 * The schedules are intentionally one-shot — the cron expression matches a
 * single instant (`minute hour day month *`) and run-scheduled cancels the
 * QStash schedule the moment it runs. This is a quirk of the UI: the user
 * is scheduling "send the report at this specific timestamp", not "every
 * day at this time". A future iteration could expose a real cron picker.
 */

const PR_OFFSET_HOURS = 4;

export type ParsedDatetimePR = Date | null;

/**
 * Parse a `YYYY-MM-DDTHH:MM` string interpreted as Puerto Rico local time
 * (UTC-4) and return the UTC instant. Returns null on any malformed part.
 */
export function toUtcFromPR(datetimePR: string): ParsedDatetimePR {
  if (typeof datetimePR !== "string") return null;
  const [datePart, timePart] = datetimePR.split("T");
  if (!datePart || !timePart) return null;
  const dateNumbers = datePart.split("-").map(Number);
  const timeNumbers = timePart.split(":").map(Number);
  if (dateNumbers.length < 3 || timeNumbers.length < 2) return null;
  const [year, month, day] = dateNumbers;
  const [hour, minute] = timeNumbers;
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
    return null;
  }
  // Manual offset add (PR has no DST, so this is correct year-round).
  return new Date(Date.UTC(year, month - 1, day, hour + PR_OFFSET_HOURS, minute));
}

/**
 * Build a UTC cron expression that matches exactly the instant represented
 * by the PR datetime. Suitable for QStash one-shot scheduling (we cancel
 * the schedule from `run-scheduled` after it fires once).
 *
 * Returns null when the input fails to parse.
 */
export function buildCronFromPR(datetimePR: string): string | null {
  const scheduledUtc = toUtcFromPR(datetimePR);
  if (!scheduledUtc) return null;
  const minute = scheduledUtc.getUTCMinutes();
  const hour = scheduledUtc.getUTCHours();
  const day = scheduledUtc.getUTCDate();
  const month = scheduledUtc.getUTCMonth() + 1;
  return `${minute} ${hour} ${day} ${month} *`;
}

/**
 * Normalize a QStash base URL — accepts both with-and-without the trailing
 * `/schedules` segment. QSTASH_BASE_URL env is supposed to be the base,
 * but defensive handling lets us paste either form.
 */
export function normalizeQStashBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.endsWith("/schedules") ? trimmed : `${trimmed}/schedules`;
}
