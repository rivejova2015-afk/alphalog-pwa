// Platform router for engine signals.
//
// The cron caller hands us {algo, signal, currentBarTs}; we decide who
// executes it based on algo.platform:
//
//   - 'MT4' / 'MT5'   → NOT handled here. Returns 'failed/unsupported_platform'
//                       on purpose. EA polling (/api/algorithms/[id]/signal)
//                       is the canonical path for those — running the
//                       server-side dispatcher AND the EA at the same time
//                       would double-fire orders.
//   - 'Tradovate'     → ./tradovate.ts
//   - 'IBKR'          → unsupported in Sprint A (Sprint C will wire it up
//                       using the same pattern as Tradovate).
//   - anything else   → unsupported with a clear error message.
//
// HOLD signals are filtered here — they short-circuit before any platform
// branching, so the tradovate dispatcher never sees them.

import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchTradovate } from "./tradovate";
import { dispatchIbkr } from "./ibkr";
import type { DispatchInput, DispatchResult } from "./types";

export type { DispatchInput, DispatchResult, DispatchMode } from "./types";
export { getDispatchMode } from "./types";

export async function dispatchSignal(
  input: DispatchInput,
  svc: SupabaseClient,
): Promise<DispatchResult> {
  if (input.signal.action === "HOLD") {
    return { ok: true, action: "skipped", reason: "engine_hold" };
  }

  const platform = input.algo.platform;

  if (platform === "Tradovate") {
    return await dispatchTradovate(input, svc);
  }

  if (platform === "MT4" || platform === "MT5") {
    return {
      ok: false, action: "failed",
      reason: "ea_driven_platform",
      error: `Platform ${platform} uses EA polling at /api/algorithms/[id]/signal — server-side dispatch is not used to avoid double execution.`,
    };
  }

  if (platform === "IBKR") {
    return await dispatchIbkr(input, svc);
  }

  return {
    ok: false, action: "failed",
    reason: "unsupported_platform",
    error: `Unknown platform '${platform}'.`,
  };
}
