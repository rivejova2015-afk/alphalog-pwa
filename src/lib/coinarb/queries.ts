/**
 * Shared helpers for the coinarb stats endpoints. Keeps each route handler thin
 * and gives one place to tune percentile/timezone semantics if we ever move
 * "today" off UTC.
 */

export function dayStartUtc(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function hourStartUtc(at: Date | string): Date {
  const d = typeof at === 'string' ? new Date(at) : new Date(at);
  d.setUTCMinutes(0, 0, 0);
  return d;
}

/**
 * Linear-interpolated percentile over a numeric array. Returns 0 for empty input
 * so callers can render `0` instead of branching on null.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}
