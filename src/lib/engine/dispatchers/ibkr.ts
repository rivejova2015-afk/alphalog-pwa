// IBKR options dispatcher — Sprint C scaffold.
//
// Goal of this file: make `algorithms.platform = 'IBKR'` a first-class
// citizen in the dispatcher chain so the cron doesn't error out and the
// user can see decisions accumulate in `last_dispatch_*` telemetry,
// EVEN BEFORE real IBKR order placement is wired.
//
// What this stub does today (real_execution_unavailable):
//   1. Validates the algo has an ibkr_account in parameters.
//   2. Returns `action='shadow_logged'` with `reason='ibkr_stub_no_executor'`.
//   3. Logs the decision so the user can see what an active IBKR algo would
//      have traded.
//
// What it WILL do (Sprint C+ — when wired to a real IBKR client):
//   - Authenticate against IBKR Client Portal Web API (session-based) or
//     TWS API (requires a host with TWS running — not viable in Vercel
//     serverless).
//   - Build a combo-leg order for the options strategy declared in
//     algo.parameters.options_strategy (covered_call, iron_condor, etc.).
//   - Place via /iserver/account/{accountId}/orders, persist fill info.
//
// Until then: stub. The shape mirrors dispatchTradovate so the swap is
// mechanical when execution lands.

import type { SupabaseClient } from "@supabase/supabase-js";
import { logInfo } from "@/lib/log";
import type { DispatchInput, DispatchResult } from "./types";

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Signature mirrors dispatchTradovate so the swap-in (real executor) is
// mechanical when the IBKR REST client lands. The `svc` param is unused
// in the stub but will be needed to persist into a future ibkr_signals table.
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function dispatchIbkr(
  input: DispatchInput,
  svc: SupabaseClient,
): Promise<DispatchResult> {
/* eslint-enable @typescript-eslint/no-unused-vars */
  const { algo, signal } = input;

  if (signal.action === "HOLD") {
    return { ok: true, action: "skipped", reason: "engine_hold" };
  }

  const params = (algo.parameters ?? {}) as Record<string, unknown>;
  const ibkrAccount = str(params.ibkr_account);
  const underlying  = str(params.underlying) ?? str(params.leg_a_instrument);
  const strategy    = str(params.options_strategy) ?? "single_leg";

  if (!ibkrAccount) {
    return {
      ok: false, action: "failed",
      reason: "no_ibkr_account",
      error: "algo.parameters.ibkr_account missing — set it in the wizard (format U1234567).",
    };
  }
  if (!underlying) {
    return {
      ok: false, action: "failed",
      reason: "no_underlying",
      error: "algo.parameters.underlying missing.",
    };
  }

  // Stub: log + return shadow result. No order, no persistence yet — when the
  // real executor lands, swap this block for an actual IBKR REST call and a
  // row insert into a future `ibkr_signals` table.
  logInfo(
    "DispatchIbkr",
    `STUB ${signal.action} ${strategy} ${underlying} (algo=${algo.id}, ibkr=${ibkrAccount}) — no order placed`,
  );

  return {
    ok: true,
    action: "shadow_logged",
    reason: "ibkr_stub_no_executor",
  };
}
