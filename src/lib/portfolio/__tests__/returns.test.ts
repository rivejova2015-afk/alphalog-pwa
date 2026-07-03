import { describe, it, expect } from "vitest";
import {
  loadAlgorithmReturns,
  buildCalendar,
  alignReturnsToCalendar,
  countActiveDays,
  type DailyReturn,
} from "../returns";

type TableData = Record<string, unknown>;

function makeMockSupabase(tables: Record<string, TableData | TableData[] | null>) {
  return {
    from(table: string) {
      const data = tables[table];
      const chain = {
        select: () => chain,
        eq: () => chain,
        not: () => chain,
        gte: () => chain,
        is: () => chain,
        maybeSingle: async () => ({ data: data ?? null, error: null }),
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: Array.isArray(data) ? data : data ? [data] : [], error: null }),
      };
      return chain;
    },
  } as never;
}

describe("loadAlgorithmReturns — futures (CME)", () => {
  it("agrega pnl_usd - commission_usd por día, normalizado por funded_amount", async () => {
    const svc = makeMockSupabase({
      algo_cme_accounts: { funded_amount: 50000 },
      cme_trades_propfirm: [
        { pnl_usd: 500, commission_usd: 10, fill_timestamp: "2026-06-15T14:00:00Z" },
        { pnl_usd: 300, commission_usd: 5, fill_timestamp: "2026-06-15T18:00:00Z" }, // mismo día
        { pnl_usd: -200, commission_usd: 5, fill_timestamp: "2026-06-16T14:00:00Z" },
      ],
    });
    const result = await loadAlgorithmReturns(
      svc,
      { id: "algo-1", market_type: "futures", parameters: { cme_account_id: "cme-1" } },
      30,
    );
    const byDate = new Map(result.map((r) => [r.date, r.returnPct]));
    // día 15: (500-10)+(300-5) = 785 / 50000 = 0.0157
    expect(byDate.get("2026-06-15")).toBeCloseTo(785 / 50000, 6);
    expect(byDate.get("2026-06-16")).toBeCloseTo(-205 / 50000, 6);
  });

  it("sin cme_account_id en parameters → []", async () => {
    const svc = makeMockSupabase({});
    const result = await loadAlgorithmReturns(svc, { id: "a", market_type: "futures", parameters: {} }, 30);
    expect(result).toEqual([]);
  });

  it("sin funded_amount (cuenta no encontrada) → []", async () => {
    const svc = makeMockSupabase({ algo_cme_accounts: null, cme_trades_propfirm: [] });
    const result = await loadAlgorithmReturns(
      svc,
      { id: "a", market_type: "futures", parameters: { cme_account_id: "cme-1" } },
      30,
    );
    expect(result).toEqual([]);
  });
});

describe("loadAlgorithmReturns — forex (MT5)", () => {
  it("resuelve via algorithm_deployments → bot_accounts → accounts, agrega por exit_date", async () => {
    const svc = makeMockSupabase({
      algorithm_deployments: { bot_account_id: "ba-1" },
      bot_accounts: { app_account_id: "acc-1" },
      accounts: { account_size: 10000 },
      trades: [
        { pnl: 100, exit_date: "2026-06-10" },
        { pnl: -50, exit_date: "2026-06-10" },
        { pnl: 200, exit_date: "2026-06-11" },
      ],
    });
    const result = await loadAlgorithmReturns(svc, { id: "a", market_type: "forex", parameters: {} }, 30);
    const byDate = new Map(result.map((r) => [r.date, r.returnPct]));
    expect(byDate.get("2026-06-10")).toBeCloseTo(50 / 10000, 6);
    expect(byDate.get("2026-06-11")).toBeCloseTo(200 / 10000, 6);
  });

  it("sin deployment activo → []", async () => {
    const svc = makeMockSupabase({ algorithm_deployments: null });
    const result = await loadAlgorithmReturns(svc, { id: "a", market_type: "forex", parameters: {} }, 30);
    expect(result).toEqual([]);
  });

  it("sin account_size → []", async () => {
    const svc = makeMockSupabase({
      algorithm_deployments: { bot_account_id: "ba-1" },
      bot_accounts: { app_account_id: "acc-1" },
      accounts: { account_size: 0 },
    });
    const result = await loadAlgorithmReturns(svc, { id: "a", market_type: "forex", parameters: {} }, 30);
    expect(result).toEqual([]);
  });
});

describe("loadAlgorithmReturns — crypto (coinarb)", () => {
  it("lee coinarb_daily_stats pre-agregada, normaliza por capital_start_usd de cada fila", async () => {
    const svc = makeMockSupabase({
      coinarb_daily_stats: [
        { day_utc: "2026-06-15", total_pnl_usd: 5, capital_start_usd: 100 },
        { day_utc: "2026-06-16", total_pnl_usd: -2, capital_start_usd: 105 },
      ],
    });
    const result = await loadAlgorithmReturns(svc, { id: "a667d400", market_type: "crypto", parameters: {} }, 30);
    const byDate = new Map(result.map((r) => [r.date, r.returnPct]));
    expect(byDate.get("2026-06-15")).toBeCloseTo(0.05, 6);
    expect(byDate.get("2026-06-16")).toBeCloseTo(-2 / 105, 6);
  });
});

describe("loadAlgorithmReturns — options", () => {
  it("sin path de ejecución real → []", async () => {
    const svc = makeMockSupabase({});
    const result = await loadAlgorithmReturns(svc, { id: "a", market_type: "options", parameters: {} }, 30);
    expect(result).toEqual([]);
  });
});

describe("buildCalendar", () => {
  it("genera N días terminando hoy", () => {
    const cal = buildCalendar(5);
    expect(cal).toHaveLength(5);
    const today = new Date().toISOString().slice(0, 10);
    expect(cal[cal.length - 1]).toBe(today);
  });
});

describe("alignReturnsToCalendar", () => {
  it("mapea returns dispersos al calendario, rellenando 0 en días sin trade", () => {
    const calendar = ["2026-06-14", "2026-06-15", "2026-06-16"];
    const returns: DailyReturn[] = [{ date: "2026-06-15", returnPct: 0.02 }];
    const aligned = alignReturnsToCalendar(returns, calendar);
    expect(aligned).toEqual([0, 0.02, 0]);
  });
});

describe("countActiveDays", () => {
  it("cuenta días con retorno distinto de 0", () => {
    const returns: DailyReturn[] = [
      { date: "d1", returnPct: 0.01 },
      { date: "d2", returnPct: 0 },
      { date: "d3", returnPct: -0.02 },
    ];
    expect(countActiveDays(returns)).toBe(2);
  });
});
