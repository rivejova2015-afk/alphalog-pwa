// Integration test para /api/cron/cme/execution-tick POST handler.
//
// Cron que cada minuto busca slices pendientes de TWAP/VWAP/IS cuyo
// scheduled_at ya pasó y las coloca. Covers:
//   1. 401 sin x-cron-secret válido.
//   2. Sin slices vencidas → {checked:0, placed:0, rejected:0, failed:0}.
//   3. checkOrderRisk deniega una slice → rejected + finalizeParentIfDone.
//   4. executeSignal exitoso → placed + finalizeParentIfDone.
//   5. executeSignal falla (success:false) → rejected.
//   6. executeSignal throws → capturado, failed, loop continúa con la siguiente.

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const checkOrderRiskMock = vi.fn();
const executeSignalMock = vi.fn();
const finalizeParentIfDoneMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/cme/risk-manager", () => ({
  checkOrderRisk: (...args: unknown[]) => checkOrderRiskMock(...args),
}));
vi.mock("@/lib/cme/order-executor", () => ({
  executeSignal: (...args: unknown[]) => executeSignalMock(...args),
}));
vi.mock("@/lib/cme/execution-slices", () => ({
  finalizeParentIfDone: (...args: unknown[]) => finalizeParentIfDoneMock(...args),
}));
vi.mock("@/lib/log", () => ({
  logError: vi.fn(), logInfo: vi.fn(), logWarn: vi.fn(),
}));

interface SliceRow {
  id: string;
  user_id: string;
  algorithm_id: string | null;
  cme_account_id: string;
  contract: string;
  direction: "BUY" | "SELL";
  quantity: number;
  stop_loss_ticks: number;
  take_profit_ticks: number;
  parent_signal_id: string;
}

let dueSlices: SliceRow[] = [];
const updateCalls: Array<{ id: string; payload: Record<string, unknown> }> = [];

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table !== "cme_signals") throw new Error(`unexpected table ${table}`);
      const chain = {
        select: () => chain,
        eq: () => chain,
        not: () => chain,
        lte: () => chain,
        limit: () => Promise.resolve({ data: dueSlices, error: null }),
        update: (payload: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            updateCalls.push({ id, payload });
            return { error: null };
          },
        }),
      };
      return chain;
    },
  }),
}));

let POST: (req: NextRequest) => Promise<Response>;
beforeAll(async () => {
  process.env.CRON_SECRET = "test-secret";
  const mod = await import("../route");
  POST = mod.POST;
});

function makeRequest(secret = "test-secret"): NextRequest {
  return new NextRequest("http://localhost/api/cron/cme/execution-tick", {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
}

function slice(overrides: Partial<SliceRow> = {}): SliceRow {
  return {
    id: "slice-1",
    user_id: "user-1",
    algorithm_id: "algo-1",
    cme_account_id: "acc-1",
    contract: "MESU6",
    direction: "BUY",
    quantity: 1,
    stop_loss_ticks: 20,
    take_profit_ticks: 40,
    parent_signal_id: "parent-1",
    ...overrides,
  };
}

describe("POST /api/cron/cme/execution-tick", () => {
  beforeEach(() => {
    dueSlices = [];
    updateCalls.length = 0;
    checkOrderRiskMock.mockReset().mockResolvedValue({ allowed: true });
    executeSignalMock.mockReset().mockResolvedValue({ success: true, orderId: 1 });
    finalizeParentIfDoneMock.mockReset().mockResolvedValue(undefined);
  });

  it("401 sin x-cron-secret válido", async () => {
    const res = await POST(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("sin slices vencidas → todo en 0", async () => {
    dueSlices = [];
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(json).toEqual({ checked: 0, placed: 0, rejected: 0, failed: 0 });
    expect(executeSignalMock).not.toHaveBeenCalled();
  });

  it("checkOrderRisk deniega → rejected, no llama executeSignal, finaliza el padre", async () => {
    dueSlices = [slice()];
    checkOrderRiskMock.mockResolvedValueOnce({ allowed: false, reason: "propfirm_news_blackout" });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(json).toEqual({ checked: 1, placed: 0, rejected: 1, failed: 0 });
    expect(executeSignalMock).not.toHaveBeenCalled();
    expect(updateCalls[0].payload).toMatchObject({ status: "rejected", reject_reason: "propfirm_news_blackout" });
    expect(finalizeParentIfDoneMock).toHaveBeenCalledWith(expect.anything(), "parent-1");
  });

  it("executeSignal exitoso → placed, finaliza el padre", async () => {
    dueSlices = [slice()];
    executeSignalMock.mockResolvedValueOnce({ success: true, orderId: 42 });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(json).toEqual({ checked: 1, placed: 1, rejected: 0, failed: 0 });
    expect(executeSignalMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "slice-1", quantity: 1, contract: "MESU6" }),
      expect.anything(),
    );
    expect(finalizeParentIfDoneMock).toHaveBeenCalledWith(expect.anything(), "parent-1");
  });

  it("executeSignal falla (success:false) → rejected", async () => {
    dueSlices = [slice()];
    executeSignalMock.mockResolvedValueOnce({ success: false, error: "no_active_connection" });
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(json).toEqual({ checked: 1, placed: 0, rejected: 0, failed: 1 });
    expect(updateCalls[0].payload).toMatchObject({ status: "rejected", reject_reason: "no_active_connection" });
  });

  it("executeSignal THROWS → capturado como failed, no rompe el loop para la siguiente slice", async () => {
    dueSlices = [slice({ id: "slice-1" }), slice({ id: "slice-2", parent_signal_id: "parent-2" })];
    executeSignalMock
      .mockRejectedValueOnce(new Error("network ECONNRESET"))
      .mockResolvedValueOnce({ success: true, orderId: 2 });

    const res = await POST(makeRequest());
    const json = await res.json();
    expect(json).toEqual({ checked: 2, placed: 1, rejected: 0, failed: 1 });
    const failedUpdate = updateCalls.find((u) => u.id === "slice-1");
    expect(failedUpdate?.payload.reject_reason).toContain("executor_threw");
  });

  it("procesa múltiples slices en la misma corrida", async () => {
    dueSlices = [
      slice({ id: "slice-1", parent_signal_id: "parent-1" }),
      slice({ id: "slice-2", parent_signal_id: "parent-1" }),
      slice({ id: "slice-3", parent_signal_id: "parent-2" }),
    ];
    const res = await POST(makeRequest());
    const json = await res.json();
    expect(json).toEqual({ checked: 3, placed: 3, rejected: 0, failed: 0 });
    expect(executeSignalMock).toHaveBeenCalledTimes(3);
    expect(finalizeParentIfDoneMock).toHaveBeenCalledTimes(3);
  });
});
