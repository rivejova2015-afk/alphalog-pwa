import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock vault + tradovate BEFORE importing the module under test.
const mockReadToken = vi.fn();
const mockStoreToken = vi.fn();
const mockRenew = vi.fn();
const mockPlaceOrder = vi.fn();

vi.mock("../vault", () => ({
  readCmeAccessToken: (...args: unknown[]) => mockReadToken(...args),
  storeCmeAccessToken: (...args: unknown[]) => mockStoreToken(...args),
}));

vi.mock("../tradovate", () => ({
  tradovateRenew: (...args: unknown[]) => mockRenew(...args),
  placeMarketOrder: (...args: unknown[]) => mockPlaceOrder(...args),
}));

import { executeSignal, type CmeSignal } from "../order-executor";

type Row = Record<string, unknown> | null;

// Vitest 4 widens vi.fn()'s default type to Mock<Procedure | Constructable>,
// which TS can't disambiguate at the call site (state.insertTrade(payload) →
// TS2348). Use the explicit signature form so the mock is a plain function
// type while preserving .toHaveBeenCalledWith() helpers.
type MockedFn = ReturnType<typeof vi.fn<(payload: unknown) => void>>;

interface MockState {
  connection: Row;
  account: Row;
  insertTrade: MockedFn;
  updateSignal: MockedFn;
  updateConnection: MockedFn;
}

let state: MockState;

function makeMockSupabase() {
  return {
    from(table: string) {
      const chain = {
        _table: table,
        _eqCount: 0,
        select() { return chain; },
        eq() { chain._eqCount++; return chain; },
        async maybeSingle() {
          if (table === "cme_connections") return { data: state.connection, error: null };
          if (table === "algo_cme_accounts") return { data: state.account, error: null };
          return { data: null, error: null };
        },
        insert(payload: unknown) {
          if (table === "cme_trades_propfirm") state.insertTrade(payload);
          return Promise.resolve({ error: null });
        },
        update(payload: unknown) {
          if (table === "cme_signals") state.updateSignal(payload);
          if (table === "cme_connections") state.updateConnection(payload);
          return {
            eq() { return Promise.resolve({ error: null }); },
          };
        },
      };
      return chain;
    },
  };
}

const SIGNAL: CmeSignal = {
  id: "sig-1",
  userId: "user-1",
  cmeAccountId: "acc-1",
  contract: "ES",
  direction: "BUY",
  quantity: 1,
  stopLossTicks: 8,
  takeProfitTicks: 12,
  algorithmId: "algo-1",
};

describe("order-executor", () => {
  beforeEach(() => {
    mockReadToken.mockReset();
    mockStoreToken.mockReset().mockResolvedValue(undefined);
    mockRenew.mockReset();
    mockPlaceOrder.mockReset();
    state = {
      connection: {
        id: "conn-1",
        tradovate_account_id: 99,
        tradovate_account_spec: "spec-x",
        token_expires_at: "2027-01-01T00:00:00Z", // far in future
        broker_type: "tradovate",
      },
      account: { is_paper: true },
      insertTrade: vi.fn(),
      updateSignal: vi.fn(),
      updateConnection: vi.fn(),
    };
  });

  it("happy path: lee token → place order → inserta trade → marca signal executed", async () => {
    mockReadToken.mockResolvedValue("valid-token");
    mockPlaceOrder.mockResolvedValue({ orderId: 7777, status: "Working" });

    const result = await executeSignal(SIGNAL, makeMockSupabase() as never);

    expect(result.success).toBe(true);
    expect(result.orderId).toBe(7777);
    expect(mockPlaceOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "valid-token",
        isPaper: true,
        action: "Buy",
        symbol: "ES",
        qty: 1,
        slTicks: 8,
        tpTicks: 12,
      }),
    );
    expect(state.insertTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        cme_account_id: "acc-1",
        connection_id: "conn-1",
        algorithm_id: "algo-1",
        signal_id: "sig-1",
        status: "filled",
        broker_order_id: "7777",
      }),
    );
    expect(state.updateSignal).toHaveBeenCalledWith(
      expect.objectContaining({ status: "executed" }),
    );
  });

  it("retorna no_active_connection cuando no hay connection row", async () => {
    state.connection = null;
    const result = await executeSignal(SIGNAL, makeMockSupabase() as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe("no_active_connection");
    expect(mockPlaceOrder).not.toHaveBeenCalled();
  });

  it("retorna no_vault_token cuando readCmeAccessToken devuelve null", async () => {
    mockReadToken.mockResolvedValue(null);
    const result = await executeSignal(SIGNAL, makeMockSupabase() as never);
    expect(result.success).toBe(false);
    expect(result.error).toBe("no_vault_token");
    expect(mockPlaceOrder).not.toHaveBeenCalled();
  });

  it("renueva token cuando expira en <10min", async () => {
    state.connection = { ...state.connection!, token_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() };
    mockReadToken.mockResolvedValue("old-token");
    mockRenew.mockResolvedValue({ accessToken: "fresh-token", expirationTime: "2027-01-01T00:00:00Z" });
    mockPlaceOrder.mockResolvedValue({ orderId: 1, status: "Working" });

    await executeSignal(SIGNAL, makeMockSupabase() as never);

    expect(mockRenew).toHaveBeenCalledWith("old-token", true);
    expect(mockStoreToken).toHaveBeenCalledWith("conn-1", "fresh-token");
    expect(state.updateConnection).toHaveBeenCalledWith(
      expect.objectContaining({ token_expires_at: "2027-01-01T00:00:00Z" }),
    );
    // Place order uses the new token
    expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({ token: "fresh-token" }));
  });

  it("usa token existente si la renovación falla", async () => {
    state.connection = { ...state.connection!, token_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() };
    mockReadToken.mockResolvedValue("old-token");
    mockRenew.mockRejectedValue(new Error("renew failed"));
    mockPlaceOrder.mockResolvedValue({ orderId: 2, status: "Working" });

    const result = await executeSignal(SIGNAL, makeMockSupabase() as never);
    expect(result.success).toBe(true);
    expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({ token: "old-token" }));
  });

  it("retorna error cuando placeMarketOrder lanza", async () => {
    mockReadToken.mockResolvedValue("valid");
    mockPlaceOrder.mockRejectedValue(new Error("Tradovate 503"));
    const result = await executeSignal(SIGNAL, makeMockSupabase() as never);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Tradovate 503");
    expect(state.insertTrade).not.toHaveBeenCalled();
  });

  it("invierte action a 'Sell' cuando direction es SELL", async () => {
    mockReadToken.mockResolvedValue("valid");
    mockPlaceOrder.mockResolvedValue({ orderId: 3, status: "Working" });

    await executeSignal({ ...SIGNAL, direction: "SELL" }, makeMockSupabase() as never);

    expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({ action: "Sell" }));
    expect(state.insertTrade).toHaveBeenCalledWith(expect.objectContaining({ direction: "SELL" }));
  });

  it("usa isPaper=false cuando algo_cme_accounts.is_paper es false", async () => {
    state.account = { is_paper: false };
    mockReadToken.mockResolvedValue("valid");
    mockPlaceOrder.mockResolvedValue({ orderId: 4, status: "Working" });

    await executeSignal(SIGNAL, makeMockSupabase() as never);

    expect(mockPlaceOrder).toHaveBeenCalledWith(expect.objectContaining({ isPaper: false }));
  });
});
