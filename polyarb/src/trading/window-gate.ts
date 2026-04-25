/**
 * Window Gate — controls when the bot is allowed to enter a market.
 *
 * For btc/eth-updown-5m markets the slug encodes the window expiry:
 *   "btc-updown-5m-1751500800"  → expiry = 1751500800 seconds unix
 *   window start = expiry - 300s, entry window = first 60s of window.
 *
 * Rules enforced here:
 *   1. Only enter in the first 60s of each new window (configurable).
 *   2. Never enter within 60s of expiry.
 *   3. One entry attempt per (conditionId, slug) pair — no retries within same window.
 */

export interface WindowInfo {
  windowStart: number; // unix ms
  windowEnd: number;   // unix ms (= slugTs * 1000)
  slugTs: number;      // unix seconds parsed from slug
}

/**
 * Parse window timestamps from a market slug.
 * Returns null if the slug has no valid timestamp suffix.
 */
export function extractWindowInfo(slug: string): WindowInfo | null {
  const parts = slug.split('-');
  const slugTs = parseInt(parts[parts.length - 1], 10);
  if (!slugTs || isNaN(slugTs) || slugTs === 0) return null;
  const windowEnd = slugTs * 1000;
  const windowStart = windowEnd - 300_000;
  return { windowStart, windowEnd, slugTs };
}

/**
 * Returns true if `now` is within the entry window (first `entryWindowMs` ms of the 5-min window).
 */
export function isInEntryWindow(info: WindowInfo, now: number, entryWindowMs = 60_000): boolean {
  return now >= info.windowStart && now <= info.windowStart + entryWindowMs;
}

/**
 * Returns true if there is less than `bufferMs` remaining before expiry.
 */
export function isNearExpiry(info: WindowInfo, now: number, bufferMs = 60_000): boolean {
  return info.windowEnd - now <= bufferMs;
}

/**
 * Tracks which (conditionId, slug) pairs have already been entered or skipped.
 * Prevents double-entry within the same 5-minute window.
 */
export class WindowGate {
  private readonly entered = new Map<string, string>(); // conditionId → slug

  hasEnteredWindow(conditionId: string, slug: string): boolean {
    return this.entered.get(conditionId) === slug;
  }

  markEntered(conditionId: string, slug: string): void {
    this.entered.set(conditionId, slug);
  }
}
