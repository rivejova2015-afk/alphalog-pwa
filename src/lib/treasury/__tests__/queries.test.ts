// Unit tests for src/lib/treasury/queries.ts.
//
// Server-side data fetching wrappers que devuelven [] o null en error
// (fail-soft). Test las funciones más críticas; el resto son wrappers
// idénticos en shape (mismo error handling).
// Patterns under test:
//   - .from(table).select(...).is(...).order(...).eq(...).single()
//   - Single-row con PGRST116 (no rows) → null silencioso (no log)
//   - Non-PGRST116 error → log + null
//   - List queries → [] en error
//   - upsertTreasuryConfig: existing → update path, missing → insert path

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { createClientMock, fromMock, logErrorMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  fromMock:         vi.fn(),
  logErrorMock:     vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
vi.mock("@/lib/log", () => ({
  logError: logErrorMock, logInfo: vi.fn(), logWarn: vi.fn(),
}));

let q: typeof import("../queries");
beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  createClientMock.mockReturnValue({ from: fromMock });
  q = await import("../queries");
});

function makeListChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "in", "order", "limit"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeSingleChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "in", "order"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

function makeMutationChain(result: { data?: unknown; error?: unknown }) {
  const proxy: Record<string, unknown> = {};
  proxy.update = () => proxy;
  proxy.insert = () => proxy;
  proxy.eq     = () => proxy;
  proxy.select = () => proxy;
  proxy.single = () => Promise.resolve(result);
  return proxy;
}

describe("getAccounts / getAccountsByIds / getAccount", () => {
  beforeEach(() => {
    fromMock.mockReset();
    logErrorMock.mockReset();
  });

  it("getAccounts returns [] cuando supabase tira error", async () => {
    fromMock.mockReturnValue(makeListChain({ data: null, error: { message: "rls denied" } }));
    const result = await q.getAccounts();
    expect(result).toEqual([]);
    expect(logErrorMock).toHaveBeenCalled();
  });

  it("getAccounts returns data cuando OK", async () => {
    const rows = [{ id: "a1", name: "Main", account_size: 10000, current_balance: 12000, withdrawals_enabled: true }];
    fromMock.mockReturnValue(makeListChain({ data: rows, error: null }));
    const result = await q.getAccounts();
    expect(result).toEqual(rows);
  });

  it("getAccountsByIds returns [] sin hits DB cuando ids está vacío (early exit)", async () => {
    const result = await q.getAccountsByIds([]);
    expect(result).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("getAccountsByIds returns rows cuando ids no vacío", async () => {
    const rows = [{ id: "a1", name: "Main" }];
    fromMock.mockReturnValue(makeListChain({ data: rows, error: null }));
    const result = await q.getAccountsByIds(["a1"]);
    expect(result).toEqual(rows);
  });

  it("getAccount PGRST116 (no rows) → null silencioso (no log)", async () => {
    fromMock.mockReturnValue(makeSingleChain({ data: null, error: { code: "PGRST116", message: "no rows" } }));
    const result = await q.getAccount("missing-id");
    expect(result).toBeNull();
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("getAccount non-PGRST116 error → log + null", async () => {
    fromMock.mockReturnValue(makeSingleChain({ data: null, error: { code: "OTHER", message: "rls boom" } }));
    const result = await q.getAccount("a1");
    expect(result).toBeNull();
    expect(logErrorMock).toHaveBeenCalled();
  });

  it("getAccount returns row cuando OK", async () => {
    const row = { id: "a1", name: "Main", account_size: 10000, current_balance: 12000 };
    fromMock.mockReturnValue(makeSingleChain({ data: row, error: null }));
    const result = await q.getAccount("a1");
    expect(result).toEqual(row);
  });
});

describe("getTreasuryConfig / getTreasuryConfigs", () => {
  beforeEach(() => {
    fromMock.mockReset();
    logErrorMock.mockReset();
  });

  it("getTreasuryConfig PGRST116 → null silencioso", async () => {
    fromMock.mockReturnValue(makeSingleChain({ data: null, error: { code: "PGRST116", message: "no rows" } }));
    expect(await q.getTreasuryConfig("a1")).toBeNull();
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("getTreasuryConfigs returns [] en error", async () => {
    fromMock.mockReturnValue(makeListChain({ data: null, error: { message: "boom" } }));
    expect(await q.getTreasuryConfigs()).toEqual([]);
  });

  it("getTreasuryConfigs returns rows cuando OK", async () => {
    const rows = [{ id: "c1", account_id: "a1", withdrawal_day: 15 }];
    fromMock.mockReturnValue(makeListChain({ data: rows, error: null }));
    expect(await q.getTreasuryConfigs()).toEqual(rows);
  });
});

describe("upsertTreasuryConfig — branches", () => {
  beforeEach(() => {
    fromMock.mockReset();
    logErrorMock.mockReset();
  });

  it("EXISTING → update path: getTreasuryConfig returns existing → update().eq().select().single()", async () => {
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        // First .from('treasury_configs') call → getTreasuryConfig (SELECT).
        return makeSingleChain({
          data: { id: "c1", account_id: "a1", withdrawal_day: 1, split_mode: "growth" },
          error: null,
        });
      }
      // Second .from('treasury_configs') call → UPDATE.
      return makeMutationChain({
        data: { id: "c1", account_id: "a1", withdrawal_day: 20, split_mode: "safe" },
        error: null,
      });
    });

    const result = await q.upsertTreasuryConfig("a1", { withdrawal_day: 20, split_mode: "safe" });
    expect(result).toMatchObject({ withdrawal_day: 20, split_mode: "safe" });
  });

  it("MISSING → insert path: getTreasuryConfig PGRST116 → insert().select().single()", async () => {
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        // getTreasuryConfig returns null (PGRST116).
        return makeSingleChain({ data: null, error: { code: "PGRST116", message: "no rows" } });
      }
      // INSERT path.
      return makeMutationChain({
        data: { id: "c-new", account_id: "a1", withdrawal_day: 15, split_mode: "growth" },
        error: null,
      });
    });

    const result = await q.upsertTreasuryConfig("a1", { withdrawal_day: 15 });
    expect(result).toMatchObject({ id: "c-new", account_id: "a1" });
  });

  it("update error → null + log", async () => {
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        return makeSingleChain({ data: { id: "c1", account_id: "a1" }, error: null });
      }
      return makeMutationChain({ data: null, error: { message: "constraint boom" } });
    });
    const result = await q.upsertTreasuryConfig("a1", { withdrawal_day: 20 });
    expect(result).toBeNull();
    expect(logErrorMock).toHaveBeenCalled();
  });

  it("insert error → null + log", async () => {
    let call = 0;
    fromMock.mockImplementation(() => {
      call++;
      if (call === 1) {
        return makeSingleChain({ data: null, error: { code: "PGRST116", message: "no rows" } });
      }
      return makeMutationChain({ data: null, error: { message: "rls boom" } });
    });
    const result = await q.upsertTreasuryConfig("a1", { withdrawal_day: 20 });
    expect(result).toBeNull();
    expect(logErrorMock).toHaveBeenCalled();
  });
});

describe("getAccountTrades / getAllTrades", () => {
  beforeEach(() => {
    fromMock.mockReset();
    logErrorMock.mockReset();
  });

  it("getAccountTrades returns rows cuando OK", async () => {
    const trades = [{ id: "t1", account_id: "a1", pnl: 100, status: "Closed" }];
    fromMock.mockReturnValue(makeListChain({ data: trades, error: null }));
    expect(await q.getAccountTrades("a1")).toEqual(trades);
  });

  it("getAccountTrades returns [] en error", async () => {
    fromMock.mockReturnValue(makeListChain({ data: null, error: { message: "boom" } }));
    expect(await q.getAccountTrades("a1")).toEqual([]);
  });

  it("getAllTrades returns rows cuando OK", async () => {
    const trades = [
      { id: "t1", status: "Closed", pnl: 100 },
      { id: "t2", status: "Closed", pnl: -50 },
    ];
    fromMock.mockReturnValue(makeListChain({ data: trades, error: null }));
    expect(await q.getAllTrades()).toEqual(trades);
  });
});

describe("getTreasuryTransactions / getTreasuryPayouts", () => {
  beforeEach(() => {
    fromMock.mockReset();
    logErrorMock.mockReset();
  });

  it("getTreasuryTransactions returns rows cuando OK", async () => {
    const txs = [{ id: "tx1", amount: 100 }];
    fromMock.mockReturnValue(makeListChain({ data: txs, error: null }));
    expect(await q.getTreasuryTransactions()).toEqual(txs);
  });

  it("getTreasuryPayouts returns rows cuando OK", async () => {
    const payouts = [{ id: "p1", status: "planned", amount: 500 }];
    fromMock.mockReturnValue(makeListChain({ data: payouts, error: null }));
    expect(await q.getTreasuryPayouts()).toEqual(payouts);
  });

  it("getTreasuryTransactions returns [] en error", async () => {
    fromMock.mockReturnValue(makeListChain({ data: null, error: { message: "boom" } }));
    expect(await q.getTreasuryTransactions()).toEqual([]);
  });
});
