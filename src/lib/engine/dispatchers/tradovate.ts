// Tradovate dispatcher — bridges engine v1 signals to Tradovate execution.
//
// Sprint A scope:
//   1. Validate the algo's CME wiring (account id + contract).
//   2. Compose a CmeSignal record (inserted with status='pending').
//   3. If shadow mode → mark it 'skipped' with reject_reason='shadow_mode'.
//      If live mode    → hand off to executeSignal() (existing executor).
//
// All failure paths return a structured DispatchResult — never throw. The
// cron caller depends on this to keep processing other algos after one fails.

import type { SupabaseClient } from "@supabase/supabase-js";
import { executeSignal, type CmeSignal } from "@/lib/cme/order-executor";
import { logError, logInfo } from "@/lib/log";
import { getDispatchMode, type DispatchInput, type DispatchResult } from "./types";

// Defaults for SL/TP when the algo's parameters don't carry per-bar ATR.
// Conservative — small enough that an honest shadow run can validate the
// pipeline without absurd risk if/when the user flips DISPATCH_MODE=live.
// Sprint B will replace these with ATR-derived values.
const DEFAULT_SL_TICKS = 20;
const DEFAULT_TP_TICKS = 40;

function num(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function dispatchTradovate(
  input: DispatchInput,
  svc: SupabaseClient,
): Promise<DispatchResult> {
  const { algo, signal } = input;

  // Defensive guard — caller should have filtered HOLD already, but no harm
  // double-checking. (No persistence on HOLD, no order placed.)
  if (signal.action === "HOLD") {
    return { ok: true, action: "skipped", reason: "engine_hold" };
  }

  const params = (algo.parameters ?? {}) as Record<string, unknown>;
  const cmeAccountId = str(params.cme_account_id);
  const contract     = str(params.contract) ?? str(params.leg_a_instrument);
  if (!cmeAccountId) {
    return {
      ok: false, action: "failed",
      reason: "no_cme_account",
      error: "algo.parameters.cme_account_id is missing — wire a CME account in the wizard.",
    };
  }
  if (!contract) {
    return {
      ok: false, action: "failed",
      reason: "no_contract",
      error: "algo.parameters.contract is missing.",
    };
  }

  const quantity = Math.max(1, Math.round(num(params.contracts_per_trade, 1)));
  // SL/TP ticks. Sprint A uses defaults if the algo doesn't carry explicit
  // tick values; Sprint B will derive from ATR × multiplier.
  const slTicks = Math.max(1, Math.round(num(params.sl_ticks, DEFAULT_SL_TICKS)));
  const tpTicks = Math.max(1, Math.round(num(params.tp_ticks, DEFAULT_TP_TICKS)));

  // Step 1: insert a pending signal row. This is the audit trail entry. It
  // exists for every dispatch attempt, including shadow + failed ones.
  const { data: inserted, error: insErr } = await svc
    .from("cme_signals")
    .insert({
      user_id:           algo.user_id,
      algorithm_id:      algo.id,
      cme_account_id:    cmeAccountId,
      contract,
      direction:         signal.action,  // 'BUY' | 'SELL'
      signal_type:       "entry",
      quantity,
      stop_loss_ticks:   slTicks,
      take_profit_ticks: tpTicks,
      status:            "pending",
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    logError("DispatchTradovate", {
      component: "insert cme_signals",
      message: insErr?.message ?? "no row returned",
      meta: { algoId: algo.id },
    });
    return {
      ok: false, action: "failed",
      reason: "persist_failed",
      error: insErr?.message ?? "could not persist signal",
    };
  }
  const cmeSignalId = inserted.id as string;

  const mode = getDispatchMode();

  if (mode === "shadow") {
    // Mark the row as skipped with a clear reason. NO call to Tradovate.
    const { error: updErr } = await svc
      .from("cme_signals")
      .update({ status: "skipped", reject_reason: "shadow_mode" })
      .eq("id", cmeSignalId);
    if (updErr) {
      logError("DispatchTradovate", {
        component: "shadow update",
        message: updErr.message,
        meta: { algoId: algo.id, cmeSignalId },
      });
    }
    logInfo("DispatchTradovate", `shadow ${signal.action} ${contract} x${quantity} (algo=${algo.id})`);
    return {
      ok: true, action: "shadow_logged",
      cmeSignalId,
      reason: "shadow_mode",
    };
  }

  // Live mode — hand off to the existing executor. It owns:
  //   - token renewal (tradovateRenew when near expiry)
  //   - placeMarketOrder with bracket SL/TP
  //   - persist to cme_trades_propfirm
  //   - flip cme_signals.status to 'executed'
  const cmeSignal: CmeSignal = {
    id:                cmeSignalId,
    userId:            algo.user_id,
    cmeAccountId,
    contract,
    direction:         signal.action,
    quantity,
    stopLossTicks:     slTicks,
    takeProfitTicks:   tpTicks,
    algorithmId:       algo.id,
  };

  try {
    const result = await executeSignal(cmeSignal, svc);
    if (result.success) {
      logInfo("DispatchTradovate", `live ${signal.action} ${contract} x${quantity} placed orderId=${result.orderId} (algo=${algo.id})`);
      return {
        ok: true, action: "placed",
        cmeSignalId,
        externalOrderId: result.orderId,
      };
    }
    // executeSignal returned a structured failure (no_active_connection, etc).
    await svc
      .from("cme_signals")
      .update({ status: "rejected", reject_reason: result.error ?? "executor_failed" })
      .eq("id", cmeSignalId);
    return {
      ok: false, action: "failed",
      cmeSignalId,
      reason: result.error ?? "executor_failed",
      error: result.error,
    };
  } catch (err) {
    // Unexpected throw — log + mark rejected, but DON'T re-throw (cron caller
    // must keep processing other algos).
    const msg = err instanceof Error ? err.message : String(err);
    logError("DispatchTradovate", {
      component: "executeSignal threw",
      message: msg,
      meta: { algoId: algo.id, cmeSignalId },
    });
    await svc
      .from("cme_signals")
      .update({ status: "rejected", reject_reason: `executor_threw: ${msg}` })
      .eq("id", cmeSignalId);
    return {
      ok: false, action: "failed",
      cmeSignalId,
      reason: "executor_threw",
      error: msg,
    };
  }
}
