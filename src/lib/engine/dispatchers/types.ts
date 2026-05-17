// Shared types for the platform dispatcher. The dispatcher routes engine
// signals to the correct execution venue based on `algorithms.platform`:
//   - MT4/MT5: NOT handled here. Those algos are driven by an EA polling
//     /api/algorithms/[id]/signal — server-side dispatch would double-fire.
//   - Tradovate: handled by ./tradovate.ts (Sprint A scope).
//   - IBKR: explicitly unsupported in this sprint (Sprint C will add it).
//
// Pure types + a small env helper. No I/O.

export type DispatchMode = "shadow" | "live";

/**
 * Per-algo input the dispatcher needs. Kept narrow so tests can construct
 * fixtures without faking the full Algorithm row.
 */
export interface DispatchInput {
  algo: {
    id:         string;
    user_id:    string;
    platform:   string;
    parameters: Record<string, unknown> | null;
  };
  signal: {
    action:     "BUY" | "SELL" | "HOLD";
    lots:       number;
    confidence: number;
    reason:     string;
  };
  /** Timestamp of the latest bar that drove this signal — used for dedup upstream. */
  currentBarTs: string;
}

/**
 * Discriminated by `action`:
 *   - 'placed'        → live mode, executed against the broker. externalOrderId set.
 *   - 'shadow_logged' → shadow mode, decision persisted to cme_signals but not executed.
 *   - 'skipped'       → engine said HOLD, or upstream dedup, or risk gate caught it.
 *   - 'failed'        → unexpected error (network, missing config). `error` is set.
 *
 * `ok` lets the cron treat `placed`, `shadow_logged`, and `skipped` as success
 * states without crashing on a per-algo error.
 */
export interface DispatchResult {
  ok:               boolean;
  action:           "placed" | "shadow_logged" | "skipped" | "failed";
  cmeSignalId?:     string;
  externalOrderId?: number;
  reason?:          string;
  error?:           string;
}

/**
 * Reads `DISPATCH_MODE` env var. Defaults to 'shadow' on anything other than
 * the literal string 'live' (case-insensitive). Defensive default — accidental
 * empty/missing env never silently flips to live.
 */
export function getDispatchMode(): DispatchMode {
  const raw = (process.env.DISPATCH_MODE ?? "shadow").toLowerCase().trim();
  return raw === "live" ? "live" : "shadow";
}
