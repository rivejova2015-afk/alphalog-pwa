// Tradovate dispatcher — bridges engine v1 signals to Tradovate execution.
//
// Sprint E:
//   - Position awareness: skip BUY if account is already net-long; skip SELL
//     if already net-short. Prevents infinite stacking when a recurring signal
//     fires bar-after-bar.
//   - ATR-derived SL/TP: compute ATR(14) on M15, convert to ticks using
//     per-contract tick size from src/lib/cme/tick-sizes.ts. Multipliers come
//     from algo.parameters.{sl_atr_mult,tp_atr_mult} with sensible defaults.
//   - When ATR isn't computable (insufficient bars or unknown tick size), we
//     fall back to static defaults + log a warn — failure-open so the
//     dispatcher keeps producing audit rows.
//
// Sprint A scope (kill-switch):
//   Live mode runs checkOrderRisk (circuit breaker + max_positions + manual
//   position + market hours + propfirm rules) right before handing off to
//   executeSignal() — blocks the order instead of just producing an audit row.
//
// All failure paths return a structured DispatchResult — never throw. The
// cron caller depends on this to keep processing other algos after one fails.

import type { SupabaseClient } from "@supabase/supabase-js";
import { executeSignal, type CmeSignal } from "@/lib/cme/order-executor";
import { getPositions, getCashBalance, tradovateRenew } from "@/lib/cme/tradovate";
import { readCmeAccessToken, storeCmeAccessToken } from "@/lib/cme/vault";
import { tickSizeFor, rootSymbolOf } from "@/lib/cme/tick-sizes";
import { tickValueFor } from "@/lib/cme/tick-values";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { computeAtrFromBars } from "./atr";
import { computeKellyContracts } from "../position-sizing/kelly";
import { checkOrderRisk } from "@/lib/cme/risk-manager";
import { logError, logInfo, logWarn } from "@/lib/log";
import { getDispatchMode, type DispatchInput, type DispatchResult } from "./types";

// Fallback when ATR or tick size are unavailable (cold start, unknown contract).
// Conservative enough that an honest shadow run validates the pipeline without
// absurd risk if/when the user flips DISPATCH_MODE=live.
const DEFAULT_SL_TICKS = 20;
const DEFAULT_TP_TICKS = 40;

// Industry-standard ATR multipliers when the algo doesn't override.
const DEFAULT_SL_ATR_MULT = 1.5;
const DEFAULT_TP_ATR_MULT = 3.0;   // RR 1:2

// How far back to look when computing ATR. M15 × 3 days = ~288 bars during
// futures sessions — way more than the 14 needed for the seed.
const ATR_LOOKBACK_DAYS = 3;

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

/**
 * Sum netPos across all open positions for this account.
 *   > 0 → net long
 *   < 0 → net short
 *   = 0 → flat or no positions
 *
 * Failure-open: returns 0 (treat as flat) and logs a warn if the Tradovate
 * fetch throws. Better to occasionally place a duplicate trade than to halt
 * the dispatcher on a transient network blip.
 */
async function netAccountPosition(
  svc: SupabaseClient,
  algoId: string,
  cmeAccountId: string,
  userId: string,
): Promise<{ netPos: number; checked: boolean; reason?: string }> {
  const { data: conn } = await svc
    .from("cme_connections")
    .select("id, tradovate_account_id, token_expires_at")
    .eq("user_id", userId)
    .eq("cme_account_id", cmeAccountId)
    .eq("status", "connected")
    .maybeSingle();
  if (!conn) return { netPos: 0, checked: false, reason: "no_active_connection" };

  const { data: acct } = await svc
    .from("algo_cme_accounts")
    .select("is_paper")
    .eq("id", cmeAccountId)
    .maybeSingle();
  const isPaper = acct?.is_paper ?? true;

  let token = await readCmeAccessToken(conn.id);
  if (!token) return { netPos: 0, checked: false, reason: "no_vault_token" };

  // If token expires within 10 minutes, renew before the position fetch — the
  // executor will need a fresh token anyway, so this avoids a second renewal.
  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
  const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000);
  if (expiresAt && expiresAt < tenMinFromNow) {
    try {
      const renewed = await tradovateRenew(token, isPaper);
      token = renewed.accessToken;
      await storeCmeAccessToken(conn.id, token);
      await svc.from("cme_connections").update({ token_expires_at: renewed.expirationTime }).eq("id", conn.id);
    } catch (err) {
      logWarn("DispatchTradovate", "token renew failed (using existing)", {
        component: "netAccountPosition",
        meta: { algoId, error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  try {
    const positions = await getPositions(token, conn.tradovate_account_id as number, isPaper);
    const netPos = positions.reduce((sum, p) => sum + (p.netPos ?? 0), 0);
    return { netPos, checked: true };
  } catch (err) {
    logWarn("DispatchTradovate", "getPositions failed (proceeding as flat)", {
      component: "netAccountPosition",
      meta: { algoId, error: err instanceof Error ? err.message : String(err) },
    });
    return { netPos: 0, checked: false, reason: "getPositions_failed" };
  }
}

/**
 * Compute SL/TP in ticks using ATR(14) on M15 bars. Falls back to static
 * defaults if anything is missing — never throws, never blocks the dispatch.
 */
async function computeSlTpTicks(
  svc: SupabaseClient,
  symbol: string,
  params: Record<string, unknown>,
): Promise<{ slTicks: number; tpTicks: number; method: "atr" | "static" }> {
  const slMult = num(params.sl_atr_mult, DEFAULT_SL_ATR_MULT);
  const tpMult = num(params.tp_atr_mult, DEFAULT_TP_ATR_MULT);
  // Allow per-algo overrides of the static defaults too.
  const slStatic = Math.max(1, Math.round(num(params.sl_ticks, DEFAULT_SL_TICKS)));
  const tpStatic = Math.max(1, Math.round(num(params.tp_ticks, DEFAULT_TP_TICKS)));

  const tickSize = tickSizeFor(symbol);
  if (tickSize == null) {
    logWarn("DispatchTradovate", `no tick size for ${symbol} — using static SL/TP`, {
      component: "computeSlTpTicks",
    });
    return { slTicks: slStatic, tpTicks: tpStatic, method: "static" };
  }

  try {
    const now = Date.now();
    const to = new Date(now).toISOString();
    const from = new Date(now - ATR_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const bars = await loadHistoricalBars(svc, symbol, "M15", from, to);
    const atr = computeAtrFromBars(bars, 14);
    if (atr == null || atr <= 0) {
      logWarn("DispatchTradovate", `ATR unavailable for ${symbol} — using static SL/TP`, {
        component: "computeSlTpTicks",
        meta: { barsLoaded: bars.length },
      });
      return { slTicks: slStatic, tpTicks: tpStatic, method: "static" };
    }

    const slTicks = Math.max(1, Math.round((atr * slMult) / tickSize));
    const tpTicks = Math.max(1, Math.round((atr * tpMult) / tickSize));
    return { slTicks, tpTicks, method: "atr" };
  } catch (err) {
    logWarn("DispatchTradovate", "ATR fetch failed — using static SL/TP", {
      component: "computeSlTpTicks",
      meta: { symbol, error: err instanceof Error ? err.message : String(err) },
    });
    return { slTicks: slStatic, tpTicks: tpStatic, method: "static" };
  }
}

/**
 * Fetch the account's current netLiq from Tradovate to feed Kelly sizing.
 * Returns null on any failure — Kelly path will fall back to manual qty.
 *
 * Reuses the same connection row + token-renewal pattern as netAccountPosition,
 * but doesn't share state with it to keep both flows independently failure-open.
 */
async function fetchAccountEquity(
  svc: SupabaseClient,
  cmeAccountId: string,
  userId: string,
): Promise<number | null> {
  try {
    const { data: conn } = await svc
      .from("cme_connections")
      .select("id, tradovate_account_id, token_expires_at")
      .eq("user_id", userId)
      .eq("cme_account_id", cmeAccountId)
      .eq("status", "connected")
      .maybeSingle();
    if (!conn) return null;

    const { data: acct } = await svc
      .from("algo_cme_accounts")
      .select("is_paper")
      .eq("id", cmeAccountId)
      .maybeSingle();
    const isPaper = acct?.is_paper ?? true;

    let token = await readCmeAccessToken(conn.id);
    if (!token) return null;

    const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
    const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000);
    if (expiresAt && expiresAt < tenMinFromNow) {
      try {
        const renewed = await tradovateRenew(token, isPaper);
        token = renewed.accessToken;
        await storeCmeAccessToken(conn.id, token);
        await svc.from("cme_connections").update({ token_expires_at: renewed.expirationTime }).eq("id", conn.id);
      } catch {
        // Fall through with stale token — getCashBalance will fail and we return null.
      }
    }

    const balance = await getCashBalance(token, conn.tradovate_account_id as number, isPaper);
    return balance.netLiq;
  } catch {
    return null;
  }
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

  const proposedQty = Math.max(1, Math.round(num(params.contracts_per_trade, 1)));
  let quantity = proposedQty;
  let isReversal = false;
  let priorNetPos = 0;

  // Position awareness — skip if already in proposed direction; if opposite,
  // REVERSE with a single market order (close existing + open new). Failure-
  // open: if getPositions throws (network blip), we proceed without the
  // guard. An occasional duplicate beats a halted dispatcher.
  //
  // Per-algo opt-out: algo.parameters.reverse_on_opposite_signal === false
  // disables reversal — opposite-direction signals are then skipped (the
  // open position lingers until manually closed).
  const pos = await netAccountPosition(svc, algo.id, cmeAccountId, algo.user_id);
  if (pos.checked && pos.netPos !== 0) {
    const sameDirection =
      (pos.netPos > 0 && signal.action === "BUY") ||
      (pos.netPos < 0 && signal.action === "SELL");

    if (sameDirection) {
      const reason = pos.netPos > 0 ? "already_long" : "already_short";
      logInfo("DispatchTradovate", `skip ${signal.action} ${contract} — ${reason} netPos=${pos.netPos} (algo=${algo.id})`);
      return { ok: true, action: "skipped", reason };
    }

    const reverseEnabled = params.reverse_on_opposite_signal !== false;
    if (!reverseEnabled) {
      logInfo("DispatchTradovate", `skip ${signal.action} ${contract} — opposite_signal_no_reverse netPos=${pos.netPos} (algo=${algo.id})`);
      return { ok: true, action: "skipped", reason: "opposite_signal_no_reverse" };
    }

    // Reverse: one market order to flatten + open in the new direction.
    quantity = Math.abs(pos.netPos) + proposedQty;
    isReversal = true;
    priorNetPos = pos.netPos;
  }

  // ATR-derived SL/TP with static fallback. Always returns a valid tick pair.
  const rootSym = rootSymbolOf(contract);
  const { slTicks, tpTicks, method } = await computeSlTpTicks(svc, rootSym, params);

  // Kelly position sizing — opt-in via algo.parameters.kelly_enabled.
  // When enabled, override `quantity` with `floor(equity × f × frac / risk)`.
  // Requires backtest-derived stats persisted in algo.parameters. Failure-open:
  // any missing input or fetch failure falls back to the manual quantity.
  let sizingMethod: string = "manual";
  if (params.kelly_enabled === true && !isReversal) {
    const tickValue = tickValueFor(rootSym);
    const winRate   = num(params.kelly_win_rate, NaN);
    const avgWin    = num(params.kelly_avg_win_usd, NaN);
    const avgLoss   = num(params.kelly_avg_loss_usd, NaN);
    const frac      = num(params.kelly_fraction, 0.5);
    const minK      = Math.max(0, Math.round(num(params.kelly_min_contracts, 1)));
    const maxK      = Math.max(minK, Math.round(num(params.kelly_max_contracts, 10)));

    if (tickValue == null || !Number.isFinite(winRate) || !Number.isFinite(avgWin) || !Number.isFinite(avgLoss)) {
      logWarn("DispatchTradovate", `Kelly skipped: missing inputs (tickValue=${tickValue}, winRate=${winRate}, avgWin=${avgWin}, avgLoss=${avgLoss}) — using manual qty`, {
        component: "kelly", meta: { algoId: algo.id },
      });
    } else {
      const equity = await fetchAccountEquity(svc, cmeAccountId, algo.user_id);
      if (equity == null || equity <= 0) {
        logWarn("DispatchTradovate", `Kelly skipped: equity fetch returned ${equity} — using manual qty`, {
          component: "kelly", meta: { algoId: algo.id },
        });
      } else {
        const kelly = computeKellyContracts({
          equityUSD:       equity,
          winRate,
          avgWinUSD:       avgWin,
          avgLossUSD:      avgLoss,
          slTicks,
          tickValueUSD:    tickValue,
          fractionalKelly: frac,
          minContracts:    minK,
          maxContracts:    maxK,
        });

        if (kelly.contracts > 0) {
          quantity = kelly.contracts;
          sizingMethod = `kelly(${kelly.method},f*=${kelly.rawFraction.toFixed(3)},applied=${kelly.appliedFraction.toFixed(3)},risk=$${kelly.dollarRiskUSD.toFixed(0)})`;
        } else {
          // Negative edge or invalid → skip the trade entirely.
          logInfo("DispatchTradovate", `skip ${signal.action} ${contract} — kelly_${kelly.method} (f*=${kelly.rawFraction.toFixed(3)}, algo=${algo.id})`);
          return { ok: true, action: "skipped", reason: `kelly_${kelly.method}` };
        }
      }
    }
  }

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
  const reversalTag = isReversal ? ` reverse_from_netPos=${priorNetPos}` : "";

  if (mode === "shadow") {
    // For reversals, surface that fact in the Shadow Inbox so the user can
    // distinguish a fresh entry from a flip. The reject_reason becomes
    // "shadow_mode (reverse from netPos=X)" — rendered in the inbox column.
    const rejectReason = isReversal
      ? `shadow_mode (reverse from netPos=${priorNetPos})`
      : "shadow_mode";
    const { error: updErr } = await svc
      .from("cme_signals")
      .update({ status: "skipped", reject_reason: rejectReason })
      .eq("id", cmeSignalId);
    if (updErr) {
      logError("DispatchTradovate", {
        component: "shadow update",
        message: updErr.message,
        meta: { algoId: algo.id, cmeSignalId },
      });
    }
    logInfo("DispatchTradovate", `shadow ${signal.action} ${contract} x${quantity} SL=${slTicks}t TP=${tpTicks}t sizing=${sizingMethod} (${method}${reversalTag}, algo=${algo.id})`);
    return {
      ok: true, action: "shadow_logged",
      cmeSignalId,
      reason: rejectReason,
    };
  }

  // Live mode — antes de delegar al executor, corremos checkOrderRisk para
  // que el kill-switch (circuit_breaker, max_positions, manual_position,
  // market_hours, propfirm rules, account_not_connected) bloquee la orden
  // ANTES de tocar Tradovate. Sin esto, una caída del PnL diario debajo del
  // umbral seguiría colocando órdenes.
  const risk = await checkOrderRisk({
    userId: algo.user_id,
    cmeAccountId,
    direction: signal.action,
    quantity,
  });
  if (!risk.allowed) {
    const reason = risk.reason ?? "risk_denied";
    await svc
      .from("cme_signals")
      .update({ status: "rejected", reject_reason: reason })
      .eq("id", cmeSignalId);
    logInfo("DispatchTradovate", `risk denied ${signal.action} ${contract} x${quantity} reason=${reason} (algo=${algo.id})`);
    return {
      ok: false, action: "failed",
      cmeSignalId,
      reason,
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
      logInfo("DispatchTradovate", `live ${signal.action} ${contract} x${quantity} placed orderId=${result.orderId} SL=${slTicks}t TP=${tpTicks}t sizing=${sizingMethod} (${method}${reversalTag}, algo=${algo.id})`);
      return {
        ok: true, action: "placed",
        cmeSignalId,
        externalOrderId: result.orderId,
      };
    }
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
