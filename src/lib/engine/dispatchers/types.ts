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
 * Minimal structural shape of a Postgres query-builder client that the
 * dispatch chain (dispatchSignal → dispatchTradovate/dispatchIbkr →
 * executeSignal) actually calls against migrated CME tables (cme_connections,
 * algo_cme_accounts, cme_signals, cme_trades_propfirm, ...).
 *
 * Both a real Supabase `SupabaseClient` and `getPgClient()`'s return value
 * (src/lib/pg/client.ts) satisfy this shape structurally, so the same
 * dispatch code can run unmodified against either backend — needed because
 * the CME/Tradovate tables moved from Supabase to a self-hosted Postgres
 * while historical_bars/ml_models stayed on Supabase. Deliberately narrow:
 * only the methods these call sites use.
 *
 * Modeled in three stages (mirroring Supabase's own builder staging):
 *   - `.from()` returns a `DispatchQueryBuilder` (select/insert/update only).
 *   - Calling one of those returns a `DispatchFilterResult`: chainable via
 *     `.select()`/`.eq()` and awaitable directly (e.g. a bare
 *     `.update(...).eq(...)` with no terminal call).
 *   - `.maybeSingle()`/`.single()` are terminal — they return a plain
 *     `DispatchTerminal` (thenable only), matching Supabase's real builder
 *     (its post-`.maybeSingle()` object isn't chainable any further either).
 * Row/result payloads are untyped (`any`) — neither call site relies on a
 * typed Database schema, and Supabase's own client defaults to the same
 * (`SupabaseClient<any, ...>`) when no generated types are wired in.
 */
export interface DispatchTerminal {
  // Loosely-typed on purpose: Supabase's and the pg shim's real `then`
  // implementations use incompatible generic signatures. Both are awaited
  // directly by every call site here, never chained further — `any` sidesteps
  // that mismatch without affecting runtime behavior.
  then(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve: (result: { data: any; error: { message: string } | null }) => void,
    reject?: (err: unknown) => void,
  ): unknown;
}

export interface DispatchFilterResult extends DispatchTerminal {
  select(cols?: string): DispatchFilterResult;
  eq(col: string, val: unknown): DispatchFilterResult;
  maybeSingle(): DispatchTerminal;
  single(): DispatchTerminal;
}

export interface DispatchQueryBuilder {
  select(cols?: string): DispatchFilterResult;
  insert(rows: Record<string, unknown> | Record<string, unknown>[]): DispatchFilterResult;
  update(row: Record<string, unknown>): DispatchFilterResult;
}

export interface DispatchDbClient {
  from(table: string): DispatchQueryBuilder;
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
