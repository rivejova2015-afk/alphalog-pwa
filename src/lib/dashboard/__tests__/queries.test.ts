import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockState {
  accounts: Array<Record<string, unknown>> | null;
  accountsError: { message: string } | null;
  trades: Array<Record<string, unknown>> | null;
  tradesError: { message: string } | null;
  setups: Array<Record<string, unknown>> | null;
  setupsError: { message: string } | null;
  categories: Array<Record<string, unknown>> | null;
}

let state: MockState;

function setupChain(table: string) {
  const chain: Record<string, unknown> = {};
  chain.select = function () { return chain; };
  chain.eq = function () { return chain; };
  chain.is = function () { return chain; };
  chain.not = function () { return chain; };
  chain.in = function () { return chain; };
  chain.then = function (resolve: (v: unknown) => unknown) {
    if (table === "accounts") return resolve({ data: state.accounts, error: state.accountsError });
    if (table === "trades") return resolve({ data: state.trades, error: state.tradesError });
    if (table === "setups") return resolve({ data: state.setups, error: state.setupsError });
    if (table === "account_categories") return resolve({ data: state.categories, error: null });
    return resolve({ data: null, error: null });
  };
  return chain;
}

// `accounts` + `trades` are in-scope (own Postgres) — getAccountGroups and
// getPerformanceMetrics now read them via getPgClient() instead of the
// injected Supabase client. `setups` and `account_categories` stay on
// Supabase (out of scope for this migration). Both mocks share the same
// `state` object / `setupChain` helper so existing fixtures keep working.
vi.mock("@/lib/pg/client", () => ({
  getPgClient: () => ({
    from: (table: string) => setupChain(table),
  }),
}));

// Mock supabase server before importing
const mockSupabase = {
  from: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(mockSupabase),
}));

import { getAccountGroups, getPerformanceMetrics } from "../queries";

describe("dashboard/queries", () => {
  beforeEach(() => {
    state = {
      accounts: [],
      accountsError: null,
      trades: [],
      tradesError: null,
      setups: [],
      setupsError: null,
      categories: [],
    };
    mockSupabase.from = vi.fn((table: string) => setupChain(table));
  });

  // ─── getAccountGroups ──────────────────────────────────────────────────────

  describe("getAccountGroups", () => {
    it("retorna [] cuando hay error en la query", async () => {
      state.accountsError = { message: "RLS denied" };
      state.accounts = null;
      const r = await getAccountGroups("user-1");
      expect(r).toEqual([]);
    });

    it("retorna [] cuando no hay accounts", async () => {
      state.accounts = [];
      const r = await getAccountGroups("user-1");
      expect(r).toEqual([]);
    });

    it("agrupa por categoría con count + totalBalance", async () => {
      state.accounts = [
        { id: "a1", current_balance: 1000, category_id: "cat-prop" },
        { id: "a2", current_balance: 2000, category_id: "cat-prop" },
        { id: "a3", current_balance: 5000, category_id: "cat-personal" },
      ];
      state.categories = [
        { id: "cat-prop", name: "PropFirm" },
        { id: "cat-personal", name: "Personal" },
      ];
      const r = await getAccountGroups("user-1");
      const propfirm = r.find((g) => g.name === "PropFirm");
      const personal = r.find((g) => g.name === "Personal");
      expect(propfirm).toEqual({ name: "PropFirm", count: 2, totalBalance: 3000 });
      expect(personal).toEqual({ name: "Personal", count: 1, totalBalance: 5000 });
    });

    it("usa 'All Accounts' como fallback cuando no hay category", async () => {
      state.accounts = [{ id: "a1", current_balance: 100, category_id: null }];
      const r = await getAccountGroups("user-1");
      expect(r[0].name).toBe("All Accounts");
    });

    it("trata current_balance null como 0", async () => {
      state.accounts = [
        { id: "a1", current_balance: null, category_id: "cat-x" },
        { id: "a2", current_balance: 100, category_id: "cat-x" },
      ];
      state.categories = [{ id: "cat-x", name: "X" }];
      const r = await getAccountGroups("user-1");
      expect(r[0].totalBalance).toBe(100);
    });
  });

  // ─── getPerformanceMetrics ─────────────────────────────────────────────────

  describe("getPerformanceMetrics", () => {
    it("retorna empty metrics cuando hay error fetching trades", async () => {
      state.tradesError = { message: "RLS denied" };
      state.trades = null;
      const r = await getPerformanceMetrics("user-1");
      expect(r.totalTrades).toBe(0);
      expect(r.winRate).toBeNull();
      expect(r.topSetup).toBeNull();
    });

    it("retorna empty metrics cuando no hay trades", async () => {
      state.trades = [];
      const r = await getPerformanceMetrics("user-1");
      expect(r.totalTrades).toBe(0);
      expect(r.winningTrades).toBe(0);
      expect(r.losingTrades).toBe(0);
      expect(r.all_time_total_pct).toBeNull();
    });

    it("calcula winRate correctamente (6/10 wins = 60%)", async () => {
      state.trades = [
        ...Array.from({ length: 6 }, (_, i) => ({ id: `w${i}`, pnl: 100, exit_date: "2026-05-15", status: "closed" })),
        ...Array.from({ length: 4 }, (_, i) => ({ id: `l${i}`, pnl: -50, exit_date: "2026-05-15", status: "closed" })),
      ];
      state.accounts = [{ account_size: 10_000 }];
      const r = await getPerformanceMetrics("user-1");
      expect(r.totalTrades).toBe(10);
      expect(r.winningTrades).toBe(6);
      expect(r.losingTrades).toBe(4);
      expect(r.winRate).toBe(60);
    });

    it("resuelve topSetup desde id → name", async () => {
      state.trades = [
        { id: "t1", pnl: 100, exit_date: "2026-05-15", setup_id: "setup-A", status: "closed" },
        { id: "t2", pnl: 100, exit_date: "2026-05-15", setup_id: "setup-A", status: "closed" },
        { id: "t3", pnl: 100, exit_date: "2026-05-15", setup_id: "setup-B", status: "closed" },
      ];
      state.setups = [
        { id: "setup-A", name: "Breakout" },
        { id: "setup-B", name: "Reversal" },
      ];
      state.accounts = [{ account_size: 1000 }];
      const r = await getPerformanceMetrics("user-1");
      expect(r.topSetup).toBe("Breakout");
    });

    it("topSetup fallback al id cuando no se encuentra el name", async () => {
      state.trades = [{ id: "t1", pnl: 100, exit_date: "2026-05-15", setup_id: "unknown-id", status: "closed" }];
      state.setups = [];
      state.accounts = [{ account_size: 1000 }];
      const r = await getPerformanceMetrics("user-1");
      expect(r.topSetup).toBe("unknown-id");
    });

    it("topSetup=null cuando ningún trade tiene setup_id", async () => {
      state.trades = [{ id: "t1", pnl: 100, exit_date: "2026-05-15", setup_id: null, status: "closed" }];
      state.accounts = [{ account_size: 1000 }];
      const r = await getPerformanceMetrics("user-1");
      expect(r.topSetup).toBeNull();
    });

    it("drawdown = |minPnl/maxPnl|*100 cuando ambos existen", async () => {
      state.trades = [
        { id: "t1", pnl: 200, exit_date: "2026-05-15", status: "closed" },
        { id: "t2", pnl: -50, exit_date: "2026-05-15", status: "closed" },
      ];
      state.accounts = [{ account_size: 1000 }];
      const r = await getPerformanceMetrics("user-1");
      // maxPnl=200, minPnl=-50 → drawdown = |-50/200|*100 = 25
      expect(r.drawdown).toBe(25);
    });

    it("drawdown=0 cuando no hay pnl positivo", async () => {
      state.trades = [
        { id: "t1", pnl: -100, exit_date: "2026-05-15", status: "closed" },
        { id: "t2", pnl: -50, exit_date: "2026-05-15", status: "closed" },
      ];
      state.accounts = [{ account_size: 1000 }];
      const r = await getPerformanceMetrics("user-1");
      expect(r.drawdown).toBe(0);
    });

    it("period percentages null cuando baseCapital=0", async () => {
      state.trades = [{ id: "t1", pnl: 100, exit_date: "2026-05-15", status: "closed" }];
      state.accounts = []; // no accounts → baseCapital = 0
      const r = await getPerformanceMetrics("user-1");
      expect(r.daily_total_pct).toBeNull();
      expect(r.weekly_total_pct).toBeNull();
      expect(r.all_time_total_pct).toBeNull();
    });

    it("period percentages se computan correctamente con baseCapital>0", async () => {
      // exit_date = hoy mismo → counts in todos los buckets
      const today = new Date().toISOString();
      state.trades = [{ id: "t1", pnl: 100, exit_date: today, status: "closed" }];
      state.accounts = [{ account_size: 1000 }];
      const r = await getPerformanceMetrics("user-1");
      // 100/1000 = 10%
      expect(r.daily_total_pct).toBe(10);
      expect(r.weekly_total_pct).toBe(10);
      expect(r.monthly_total_pct).toBe(10);
      expect(r.all_time_total_pct).toBe(10);
    });

    it("trade muy antiguo NO cuenta en daily/weekly/monthly pero sí en all-time", async () => {
      state.trades = [{ id: "old", pnl: 500, exit_date: "2020-01-01", status: "closed" }];
      state.accounts = [{ account_size: 1000 }];
      const r = await getPerformanceMetrics("user-1");
      expect(r.daily_total_pct).toBe(0);
      expect(r.weekly_total_pct).toBe(0);
      expect(r.monthly_total_pct).toBe(0);
      expect(r.all_time_total_pct).toBe(50);
    });

    it("pnl null se trata como 0", async () => {
      state.trades = [
        { id: "t1", pnl: null, exit_date: "2026-05-15", status: "closed" },
        { id: "t2", pnl: 100, exit_date: "2026-05-15", status: "closed" },
      ];
      state.accounts = [{ account_size: 1000 }];
      const r = await getPerformanceMetrics("user-1");
      expect(r.totalTrades).toBe(2);
      expect(r.winningTrades).toBe(1); // sólo t2
      expect(r.losingTrades).toBe(0); // null no es < 0
    });

    it("redondea winRate y drawdown a 2 decimales", async () => {
      state.trades = [
        ...Array.from({ length: 1 }, () => ({ id: "w", pnl: 100, exit_date: "2026-05-15", status: "closed" })),
        ...Array.from({ length: 2 }, (_, i) => ({ id: `l${i}`, pnl: -10, exit_date: "2026-05-15", status: "closed" })),
      ];
      state.accounts = [{ account_size: 1000 }];
      const r = await getPerformanceMetrics("user-1");
      // 1/3 wins = 33.333...%
      expect(r.winRate).toBe(33.33);
    });
  });
});
