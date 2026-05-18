import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dispatchSignal, getDispatchMode, type DispatchInput } from "./index";

// Mock the cme executor — we want to verify dispatchTradovate calls it with
// the right shape in live mode, and that it does NOT call it in shadow mode.
const executeSignalMock = vi.fn();
vi.mock("@/lib/cme/order-executor", () => ({
  executeSignal: (...args: unknown[]) => executeSignalMock(...args),
}));

// Mock the logger so tests don't pollute output.
vi.mock("@/lib/log", () => ({
  logError: vi.fn(),
  logInfo:  vi.fn(),
  logWarn:  vi.fn(),
}));

// ── Supabase client mock with a chainable query builder ─────────────────────
// Just enough to satisfy insert→select→single AND update→eq calls. Returns
// configurable responses per call type via the `cmeSignalsBehavior` object.

type Behavior = {
  insertReturn?: { data: { id: string } | null; error: { message: string } | null };
  updateError?: { message: string } | null;
};
const behavior: Behavior = {};
const updateCalls: Array<{ table: string; payload: Record<string, unknown>; eqId?: string }> = [];

function makeSupabaseMock(): SupabaseClient {
  const tableBuilder = (table: string) => ({
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
  });
  return { from: (table: string) => tableBuilder(table) } as unknown as SupabaseClient;
}

beforeEach(() => {
  executeSignalMock.mockReset();
  updateCalls.length = 0;
  delete behavior.insertReturn;
  delete behavior.updateError;
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
