/**
 * Helpers shared by feature panels that render outbox-pending rows
 * inline with server-fetched rows (eg. NewTradesLog, JournalPanel).
 *
 * The convention is: a pending row's `id` is prefixed with "pending:" so
 * that downstream handlers (edit / delete) can branch on it without
 * needing a separate `_pending` flag on the data model.
 *
 * Keeping these as exports of a tiny pure module makes them testable
 * without dragging in fake-indexeddb or full component render.
 */

export const PENDING_ID_PREFIX = "pending:";

/** True when the id refers to an outbox entry, false when it's a real server id. */
export function isPendingId(id: string): boolean {
  return typeof id === "string" && id.startsWith(PENDING_ID_PREFIX);
}

/**
 * Strip the prefix so the result can be passed to `deleteOutboxEntry` /
 * `updateOutboxPayload` / etc. Throws if the input is not a pending id —
 * callers must check `isPendingId` first.
 */
export function pendingIdToOutboxId(id: string): string {
  if (!isPendingId(id)) {
    throw new Error(`Not a pending id: ${id}`);
  }
  return id.slice(PENDING_ID_PREFIX.length);
}

/** Build the inverse — wraps a raw outbox id with the prefix. */
export function outboxIdToPendingId(outboxId: string): string {
  return `${PENDING_ID_PREFIX}${outboxId}`;
}
