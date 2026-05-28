import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchSignal, getDispatchMode, type DispatchInput } from "./index";

// Mock the cme executor — we want to verify dispatchTradovate calls it with
// the right shape in live mode, and that it does NOT call it in shadow mode.
const executeSignalMock = vi.fn();
vi.mock("@/lib/cme/order-executor", () => ({
  executeSignal: (...args: unknown[]) => executeSignalMock(...args),
}));

// Mock the position fetcher + token plumbing used by the position-awareness
// step. By default: no positions, no token issues — i.e. account is flat.
const getPositionsMock = vi.fn().mockResolvedValue([]);
const tradovateRenewMock = vi.fn().mockResolvedValue({ accessToken: "renewed", expirationTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
vi.mock("@/lib/cme/tradovate", () => ({
  getPositions:   (...args: unknown[]) => getPositionsMock(...args),
  tradovateRenew: (...args: unknown[]) => tradovateRenewMock(...args),
}));
vi.mock("@/lib/cme/vault", () => ({
  readCmeAccessToken:  vi.fn().mockResolvedValue("fake_token"),
  storeCmeAccessToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock bars-loader so tests don't try to hit Supabase historical_bars.
// Default returns empty bars → ATR path falls back to static defaults.
const loadHistoricalBarsMock = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/backtest/bars-loader", () => ({
  loadHistoricalBars: (...args: unknown[]) => loadHistoricalBarsMock(...args),
}));

// Mock the logger so tests don't pollute output.
vi.mock("@/lib/log", () => ({
  logError: vi.fn(),
  logInfo:  vi.fn(),
  logWarn:  vi.fn(),
}));

// ── Supabase client mock with a chainable query builder ─────────────────────
// Handles three patterns the dispatcher uses:
//   1. insert(...).select(...).single()     → cme_signals insert
//   2. update(...).eq(col, val)             → cme_signals status update
//   3. select(...).eq(col, val)[.eq(...)].maybeSingle()
//                                            → cme_connections + algo_cme_accounts lookups

type Behavior = {
  insertReturn?:    { data: { id: string } | null; error: { message: string } | null };
  updateError?:     { message: string } | null;
  connectionRow?:   { id: string; tradovate_account_id: number; token_expires_at: string | null } | null;
  accountRow?:      { is_paper: boolean } | null;
};
const behavior: Behavior = {};
const updateCalls: Array<{ table: string; payload: Record<string, unknown>; eqId?: string }> = [];

function makeSupabaseMock(): SupabaseClient {
  const tableBuilder = (table: string) => {
    function selectBuilder() {
      const chain = {
        eq: () => chain,
        is: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          if (table === "cme_connections") {
            return {
              data: behavior.connectionRow !== undefined
                ? behavior.connectionRow
                : { id: "conn_1", tradovate_account_id: 12345, token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
              error: null,
            };
          }
          if (table === "algo_cme_accounts") {
            return {
              data: behavior.accountRow !== undefined ? behavior.accountRow : { is_paper: true },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
      return chain;
    }
    return {
      select: () => selectBuilder(),
      insert: () => ({
        select: () => ({
          single: async () => behavior.insertReturn ?? { data: { id: "sig_test_1" }, error: null },
        }),
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: async (_col: string, value: string) => {
          updateCalls.push({ table, payload, eqId: value });
          return { error: behavior.updateError ?? null };
        },
      }),
    };
  };
  return { from: (table: string) => tableBuilder(table) } as unknown as SupabaseClient;
}

beforeEach(() => {
  executeSignalMock.mockReset();
  getPositionsMock.mockReset().mockResolvedValue([]);
  loadHistoricalBarsMock.mockReset().mockResolvedValue([]);
  updateCalls.length = 0;
  delete behavior.insertReturn;
  delete behavior.updateError;
  delete behavior.connectionRow;
  delete behavior.accountRow;
  delete process.env.DISPATCH_MODE;
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function tradovateInput(overrides: Partial<DispatchInput> = {}): DispatchInput {
  return {
    algo: {
      id: "algo_1",
      user_id: "user_1",
      platform: "Tradovate",
      parameters: { cme_account_id: "cme_1", contract: "ESH4", contracts_per_trade: 2 },
    },
    signal: { action: "BUY", lots: 1, confidence: 0.7, reason: "smc_bos_long" },
    currentBarTs: "2026-05-17T10:00:00.000Z",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("getDispatchMode", () => {
  it("defaults to 'shadow' when env var is missing", () => {
    delete process.env.DISPATCH_MODE;
    expect(getDispatchMode()).toBe("shadow");
  });

  it("returns 'live' for exact match 'live'", () => {
    process.env.DISPATCH_MODE = "live";
    expect(getDispatchMode()).toBe("live");
  });

  it("is case-insensitive for 'live'", () => {
    process.env.DISPATCH_MODE = "LIVE";
    expect(getDispatchMode()).toBe("live");
    process.env.DISPATCH_MODE = "Live";
    expect(getDispatchMode()).toBe("live");
  });

  it("trims whitespace", () => {
    process.env.DISPATCH_MODE = "  live  ";
    expect(getDispatchMode()).toBe("live");
  });

  it("returns 'shadow' for any non-'live' value (defensive)", () => {
    process.env.DISPATCH_MODE = "production";  // typo, must NOT silently flip to live
    expect(getDispatchMode()).toBe("shadow");
    process.env.DISPATCH_MODE = "";
    expect(getDispatchMode()).toBe("shadow");
  });
});

describe("dispatchSignal — routing", () => {
  it("short-circuits on HOLD without persistence", async () => {
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(
      tradovateInput({ signal: { action: "HOLD", lots: 0, confidence: 0, reason: "no_setup" } }),
      svc,
    );
    expect(res.ok).toBe(true);
    expect(res.action).toBe("skipped");
    expect(res.reason).toBe("engine_hold");
    expect(executeSignalMock).not.toHaveBeenCalled();
    expect(updateCalls).toHaveLength(0);
  });

  it("MT5 returns failed/ea_driven_platform (defense vs double-fire)", async () => {
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({ algo: { ...tradovateInput().algo, platform: "MT5" } }), svc);
    expect(res.ok).toBe(false);
    expect(res.action).toBe("failed");
    expect(res.reason).toBe("ea_driven_platform");
    expect(executeSignalMock).not.toHaveBeenCalled();
  });

  it("MT4 returns failed/ea_driven_platform too", async () => {
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({ algo: { ...tradovateInput().algo, platform: "MT4" } }), svc);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("ea_driven_platform");
  });

  it("IBKR with valid params returns shadow_logged (stub — no real executor)", async () => {
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({
      algo: {
        id: "algo_ibkr", user_id: "user_1", platform: "IBKR",
        parameters: { ibkr_account: "U1234567", underlying: "SPY", options_strategy: "covered_call" },
      },
    }), svc);
    expect(res.ok).toBe(true);
    expect(res.action).toBe("shadow_logged");
    expect(res.reason).toBe("ibkr_stub_no_executor");
  });

  it("IBKR without ibkr_account returns failed/no_ibkr_account", async () => {
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({
      algo: { id: "a", user_id: "u", platform: "IBKR", parameters: { underlying: "SPY" } },
    }), svc);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("no_ibkr_account");
  });

  it("unknown platform returns unsupported_platform with the bad value in the error", async () => {
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({ algo: { ...tradovateInput().algo, platform: "XYZ" } }), svc);
    expect(res.reason).toBe("unsupported_platform");
    expect(res.error).toContain("XYZ");
  });
});

describe("dispatchSignal — Tradovate", () => {
  it("shadow mode: persists signal as skipped, does NOT call executeSignal", async () => {
    process.env.DISPATCH_MODE = "shadow";
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput(), svc);

    expect(res.ok).toBe(true);
    expect(res.action).toBe("shadow_logged");
    expect(res.cmeSignalId).toBe("sig_test_1");
    expect(res.reason).toBe("shadow_mode");
    expect(executeSignalMock).not.toHaveBeenCalled();

    // The cme_signals update should have flipped status to skipped.
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].table).toBe("cme_signals");
    expect(updateCalls[0].payload).toMatchObject({ status: "skipped", reject_reason: "shadow_mode" });
    expect(updateCalls[0].eqId).toBe("sig_test_1");
  });

  it("live mode: calls executeSignal with composed args and returns placed", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockResolvedValue({ success: true, orderId: 99999 });
    const svc = makeSupabaseMock();

    const res = await dispatchSignal(tradovateInput(), svc);

    expect(res.ok).toBe(true);
    expect(res.action).toBe("placed");
    expect(res.externalOrderId).toBe(99999);

    expect(executeSignalMock).toHaveBeenCalledTimes(1);
    const passedSignal = executeSignalMock.mock.calls[0][0];
    expect(passedSignal).toMatchObject({
      id: "sig_test_1",
      userId: "user_1",
      algorithmId: "algo_1",
      cmeAccountId: "cme_1",
      contract: "ESH4",
      direction: "BUY",
      quantity: 2,
    });
  });

  it("live mode: executor returns failure → status flipped to rejected, result has reason", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockResolvedValue({ success: false, error: "no_active_connection" });
    const svc = makeSupabaseMock();

    const res = await dispatchSignal(tradovateInput(), svc);

    expect(res.ok).toBe(false);
    expect(res.action).toBe("failed");
    expect(res.reason).toBe("no_active_connection");
    expect(updateCalls.some((u) => u.payload.status === "rejected")).toBe(true);
  });

  it("live mode: executor THROWS → caught, status='rejected', NO re-throw", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockRejectedValue(new Error("network ECONNRESET"));
    const svc = makeSupabaseMock();

    const res = await dispatchSignal(tradovateInput(), svc);

    expect(res.ok).toBe(false);
    expect(res.action).toBe("failed");
    expect(res.reason).toBe("executor_threw");
    expect(res.error).toContain("ECONNRESET");
    // Updated to rejected with prefix-noting the throw.
    const rejection = updateCalls.find((u) => u.payload.status === "rejected");
    expect(rejection?.payload.reject_reason).toContain("executor_threw");
  });

  it("missing cme_account_id in parameters → failed/no_cme_account, no insert attempted", async () => {
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({
      algo: { id: "a", user_id: "u", platform: "Tradovate", parameters: { contract: "ESH4" } },
    }), svc);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("no_cme_account");
    expect(executeSignalMock).not.toHaveBeenCalled();
    expect(updateCalls).toHaveLength(0);
  });

  it("missing contract in parameters → failed/no_contract", async () => {
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({
      algo: { id: "a", user_id: "u", platform: "Tradovate", parameters: { cme_account_id: "cme_1" } },
    }), svc);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("no_contract");
  });

  it("falls back to leg_a_instrument when explicit contract is missing", async () => {
    process.env.DISPATCH_MODE = "shadow";
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({
      algo: {
        id: "a", user_id: "u", platform: "Tradovate",
        parameters: { cme_account_id: "cme_1", leg_a_instrument: "NQH4" },
      },
    }), svc);
    expect(res.ok).toBe(true);
    expect(res.action).toBe("shadow_logged");
  });

  it("insert failure → failed/persist_failed, executor never called", async () => {
    behavior.insertReturn = { data: null, error: { message: "constraint_violation_xyz" } };
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput(), svc);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("persist_failed");
    expect(res.error).toContain("constraint_violation_xyz");
    expect(executeSignalMock).not.toHaveBeenCalled();
  });

  it("invalid contracts_per_trade defaults to 1 (defensive numeric coercion)", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockResolvedValue({ success: true, orderId: 1 });
    const svc = makeSupabaseMock();
    await dispatchSignal(tradovateInput({
      algo: {
        id: "a", user_id: "u", platform: "Tradovate",
        parameters: { cme_account_id: "cme_1", contract: "ESH4", contracts_per_trade: "garbage" },
      },
    }), svc);
    expect(executeSignalMock.mock.calls[0][0].quantity).toBe(1);
  });
});

describe("dispatchTradovate — position awareness (Sprint E)", () => {
  it("skips BUY when account is already net long", async () => {
    process.env.DISPATCH_MODE = "live";
    getPositionsMock.mockResolvedValue([{ netPos: 2, accountId: 12345 }]);
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({
      signal: { action: "BUY", lots: 1, confidence: 0.7, reason: "smc_bos_long" },
    }), svc);

    expect(res.ok).toBe(true);
    expect(res.action).toBe("skipped");
    expect(res.reason).toBe("already_long");
    expect(executeSignalMock).not.toHaveBeenCalled();
    // No cme_signals row should be inserted when we short-circuit on
    // position-aware skip — the audit row is reserved for actual dispatch
    // attempts that reached the persistence step.
    expect(updateCalls).toHaveLength(0);
  });

  it("skips SELL when account is already net short", async () => {
    process.env.DISPATCH_MODE = "live";
    getPositionsMock.mockResolvedValue([{ netPos: -3, accountId: 12345 }]);
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({
      signal: { action: "SELL", lots: 1, confidence: 0.7, reason: "smc_bos_short" },
    }), svc);

    expect(res.ok).toBe(true);
    expect(res.reason).toBe("already_short");
    expect(executeSignalMock).not.toHaveBeenCalled();
  });

  it("REVERSES when net long and signal is SELL (Sprint F close-and-reverse)", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockResolvedValue({ success: true, orderId: 42 });
    // Account is long 2 ES, contracts_per_trade=2. SELL signal should
    // produce a single order of qty=4 (close 2 long + open 2 short).
    getPositionsMock.mockResolvedValue([{ netPos: 2, accountId: 12345 }]);
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({
      signal: { action: "SELL", lots: 1, confidence: 0.7, reason: "smc_bos_short" },
    }), svc);

    expect(res.ok).toBe(true);
    expect(res.action).toBe("placed");
    expect(executeSignalMock).toHaveBeenCalledTimes(1);
    const passed = executeSignalMock.mock.calls[0][0];
    // contracts_per_trade=2 in the default tradovateInput; netPos=2.
    // Reversal qty = abs(netPos) + contracts_per_trade = 2 + 2 = 4.
    expect(passed.quantity).toBe(4);
    expect(passed.direction).toBe("SELL");
  });

  it("PROCEEDS to dispatch when account is flat (netPos sum = 0)", async () => {
    process.env.DISPATCH_MODE = "shadow";
    getPositionsMock.mockResolvedValue([
      { netPos: 2,  accountId: 12345 },
      { netPos: -2, accountId: 12345 },  // netted out
    ]);
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput(), svc);
    expect(res.action).toBe("shadow_logged");
  });

  it("fail-open: getPositions throws → proceeds with the dispatch", async () => {
    process.env.DISPATCH_MODE = "shadow";
    getPositionsMock.mockRejectedValue(new Error("network timeout"));
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput(), svc);
    // Network failure shouldn't halt the dispatch — better to risk a duplicate
    // than to silently stop emitting signals.
    expect(res.ok).toBe(true);
    expect(res.action).toBe("shadow_logged");
  });

  it("skips position check when there's no active CME connection (failure-open)", async () => {
    process.env.DISPATCH_MODE = "shadow";
    behavior.connectionRow = null;
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput(), svc);
    // No connection means we can't check positions — proceed and let the
    // executor handle it (which it will, by also failing on no_active_connection).
    expect(res.action).toBe("shadow_logged");
    expect(getPositionsMock).not.toHaveBeenCalled();
  });
});

describe("dispatchTradovate — ATR-derived SL/TP (Sprint E)", () => {
  function fakeBars(count: number, range: number = 2) {
    return Array.from({ length: count }, (_, i) => ({
      ts: new Date(2026, 0, 1, 0, i * 15).toISOString(),
      open: 100, high: 100 + range / 2, low: 100 - range / 2, close: 100,
      volume: 1000, spread: null,
    }));
  }

  it("uses ATR-derived ticks when bars are available", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockResolvedValue({ success: true, orderId: 1 });
    // ATR(14) with constant range 2.0 → ~2.0 in price units.
    // For ES (tickSize 0.25), slMult=1.5 → slTicks = round(2.0 * 1.5 / 0.25) = 12
    //                         tpMult=3.0 → tpTicks = round(2.0 * 3.0 / 0.25) = 24
    loadHistoricalBarsMock.mockResolvedValue(fakeBars(30, 2));
    const svc = makeSupabaseMock();
    await dispatchSignal(tradovateInput(), svc);

    expect(executeSignalMock).toHaveBeenCalledTimes(1);
    const signal = executeSignalMock.mock.calls[0][0];
    // ATR-derived: NOT the default 20/40
    expect(signal.stopLossTicks).toBe(12);
    expect(signal.takeProfitTicks).toBe(24);
  });

  it("falls back to static defaults when ATR isn't computable", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockResolvedValue({ success: true, orderId: 1 });
    loadHistoricalBarsMock.mockResolvedValue([]);  // no bars → ATR null
    const svc = makeSupabaseMock();
    await dispatchSignal(tradovateInput(), svc);

    const signal = executeSignalMock.mock.calls[0][0];
    expect(signal.stopLossTicks).toBe(20);
    expect(signal.takeProfitTicks).toBe(40);
  });

  it("falls back to static defaults when contract has no tick size mapping", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockResolvedValue({ success: true, orderId: 1 });
    loadHistoricalBarsMock.mockResolvedValue(fakeBars(30, 2));
    const svc = makeSupabaseMock();
    await dispatchSignal(tradovateInput({
      algo: {
        id: "algo_1", user_id: "user_1", platform: "Tradovate",
        parameters: { cme_account_id: "cme_1", contract: "FAKE_CONTRACT" },
      },
    }), svc);

    const signal = executeSignalMock.mock.calls[0][0];
    expect(signal.stopLossTicks).toBe(20);
    expect(signal.takeProfitTicks).toBe(40);
  });

  it("respects per-algo sl_atr_mult / tp_atr_mult overrides", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockResolvedValue({ success: true, orderId: 1 });
    loadHistoricalBarsMock.mockResolvedValue(fakeBars(30, 2));
    const svc = makeSupabaseMock();
    // ATR=2.0, sl_mult=2 → slTicks = round(2 * 2 / 0.25) = 16
    //          tp_mult=5 → tpTicks = round(2 * 5 / 0.25) = 40
    await dispatchSignal(tradovateInput({
      algo: {
        id: "algo_1", user_id: "user_1", platform: "Tradovate",
        parameters: { cme_account_id: "cme_1", contract: "ESH4", sl_atr_mult: 2, tp_atr_mult: 5 },
      },
    }), svc);

    const signal = executeSignalMock.mock.calls[0][0];
    expect(signal.stopLossTicks).toBe(16);
    expect(signal.takeProfitTicks).toBe(40);
  });
});

describe("dispatchTradovate — close-and-reverse (Sprint F)", () => {
  it("reverses long→short with combined-quantity market order", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockResolvedValue({ success: true, orderId: 7 });
    getPositionsMock.mockResolvedValue([{ netPos: 3, accountId: 12345 }]);
    const svc = makeSupabaseMock();
    await dispatchSignal(tradovateInput({
      algo: {
        id: "algo_1", user_id: "user_1", platform: "Tradovate",
        parameters: { cme_account_id: "cme_1", contract: "ESH4", contracts_per_trade: 2 },
      },
      signal: { action: "SELL", lots: 1, confidence: 0.7, reason: "smc_bos_short" },
    }), svc);

    // Reversal: abs(3) + 2 = 5 sells (3 close + 2 new short)
    expect(executeSignalMock.mock.calls[0][0].quantity).toBe(5);
    expect(executeSignalMock.mock.calls[0][0].direction).toBe("SELL");
  });

  it("reverses short→long with combined-quantity market order", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockResolvedValue({ success: true, orderId: 8 });
    getPositionsMock.mockResolvedValue([{ netPos: -4, accountId: 12345 }]);
    const svc = makeSupabaseMock();
    await dispatchSignal(tradovateInput({
      algo: {
        id: "algo_1", user_id: "user_1", platform: "Tradovate",
        parameters: { cme_account_id: "cme_1", contract: "ESH4", contracts_per_trade: 1 },
      },
      signal: { action: "BUY", lots: 1, confidence: 0.7, reason: "smc_bos_long" },
    }), svc);

    // Reversal: abs(-4) + 1 = 5 buys
    expect(executeSignalMock.mock.calls[0][0].quantity).toBe(5);
    expect(executeSignalMock.mock.calls[0][0].direction).toBe("BUY");
  });

  it("respects reverse_on_opposite_signal=false → skips instead", async () => {
    process.env.DISPATCH_MODE = "live";
    getPositionsMock.mockResolvedValue([{ netPos: 2, accountId: 12345 }]);
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({
      algo: {
        id: "algo_1", user_id: "user_1", platform: "Tradovate",
        parameters: {
          cme_account_id: "cme_1",
          contract: "ESH4",
          contracts_per_trade: 1,
          reverse_on_opposite_signal: false,
        },
      },
      signal: { action: "SELL", lots: 1, confidence: 0.7, reason: "smc_bos_short" },
    }), svc);

    expect(res.action).toBe("skipped");
    expect(res.reason).toBe("opposite_signal_no_reverse");
    expect(executeSignalMock).not.toHaveBeenCalled();
  });

  it("shadow mode reversal: tags reject_reason with netPos info", async () => {
    process.env.DISPATCH_MODE = "shadow";
    getPositionsMock.mockResolvedValue([{ netPos: 2, accountId: 12345 }]);
    const svc = makeSupabaseMock();
    const res = await dispatchSignal(tradovateInput({
      signal: { action: "SELL", lots: 1, confidence: 0.7, reason: "smc_bos_short" },
    }), svc);

    expect(res.action).toBe("shadow_logged");
    expect(res.reason).toContain("reverse from netPos=2");
    const shadowUpdate = updateCalls.find((u) => u.payload.status === "skipped");
    expect(shadowUpdate?.payload.reject_reason).toContain("reverse from netPos=2");
  });

  it("flat account + signal proceeds with proposedQty (no reversal math)", async () => {
    process.env.DISPATCH_MODE = "live";
    executeSignalMock.mockResolvedValue({ success: true, orderId: 9 });
    getPositionsMock.mockResolvedValue([]);  // empty = flat
    const svc = makeSupabaseMock();
    await dispatchSignal(tradovateInput({
      algo: {
        id: "algo_1", user_id: "user_1", platform: "Tradovate",
        parameters: { cme_account_id: "cme_1", contract: "ESH4", contracts_per_trade: 3 },
      },
      signal: { action: "BUY", lots: 1, confidence: 0.7, reason: "smc_bos_long" },
    }), svc);

    expect(executeSignalMock.mock.calls[0][0].quantity).toBe(3);
  });
});
