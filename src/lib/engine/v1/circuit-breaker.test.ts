import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { checkBreaker } from "./circuit-breaker";

// Pin "now" to 2026-06-15 12:00 UTC — middle of the day so 1h-ago and 24h-ago
// don't accidentally cross the UTC midnight boundary on the daily window check.
const FIXED_NOW = new Date("2026-06-15T12:00:00.000Z").getTime();

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

// Type the breaker config narrowly. Mirrors
// EngineConfig['modules']['circuit_breaker'].
type BreakerCfg = {
  enabled: boolean;
  consecutive_losses: number;
  daily_dd_pct: number;
  weekly_dd_pct: number;
};

function cfg(over: Partial<BreakerCfg> = {}): BreakerCfg {
  return {
    enabled: true,
    consecutive_losses: 3,
    daily_dd_pct: 2,
    weekly_dd_pct: 5,
    ...over,
  };
}

// Minimal Supabase mock for the .from().select().eq().eq().gte().order().limit() chain.
function mockSupabase(rows: Array<{ pnl: number | null; closed_at: string | null }>, error: { message: string } | null = null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: () => Promise.resolve({ data: error ? null : rows, error }),
  };
  return {
    from: () => chain,
  } as never;
}

function trade(pnl: number, hoursAgo = 1): { pnl: number | null; closed_at: string } {
  return { pnl, closed_at: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString() };
}

describe("checkBreaker", () => {
  it("returns tripped=false when disabled (zero database calls)", async () => {
    const result = await checkBreaker(mockSupabase([]), "algo-1", cfg({ enabled: false }), 10_000);
    expect(result).toEqual({ tripped: false });
  });

  it("returns tripped=false (fail-open) when supabase query errors", async () => {
    const result = await checkBreaker(
      mockSupabase([], { message: "PGRST: temporary" }),
      "algo-1",
      cfg(),
      10_000,
    );
    expect(result.tripped).toBe(false);
    expect(result.reason).toBe("breaker_query_failed");
  });

  it("trips on N consecutive losses (most recent first)", async () => {
    // 3 losses in a row from the head of the array.
    const trades = [trade(-50, 1), trade(-30, 2), trade(-20, 3), trade(100, 4)];
    const result = await checkBreaker(mockSupabase(trades), "algo-1", cfg({ consecutive_losses: 3 }), 10_000);
    expect(result.tripped).toBe(true);
    expect(result.reason).toMatch(/^consecutive_losses:3/);
    expect(result.consecutive_loss_count).toBe(3);
  });

  it("does NOT trip when losses are interrupted by a win", async () => {
    const trades = [trade(-50, 1), trade(50, 2), trade(-30, 3), trade(-20, 4)];
    const result = await checkBreaker(mockSupabase(trades), "algo-1", cfg({ consecutive_losses: 3 }), 10_000);
    expect(result.tripped).toBe(false);
  });

  it("trips on daily drawdown beyond threshold", async () => {
    // 3% loss on 10k equity → breaches the 2% daily threshold.
    // consecutive_losses pumped to 999 so it doesn't trip first.
    const trades = [trade(-300, 1)];
    const result = await checkBreaker(
      mockSupabase(trades),
      "algo-1",
      cfg({ daily_dd_pct: 2, consecutive_losses: 999 }),
      10_000,
    );
    expect(result.tripped).toBe(true);
    expect(result.reason).toMatch(/^daily_dd:/);
  });

  it("does NOT trip when daily drawdown is within threshold", async () => {
    const trades = [trade(-150, 1)];  // 1.5% on 10k — under 2%
    const result = await checkBreaker(
      mockSupabase(trades),
      "algo-1",
      cfg({ daily_dd_pct: 2, consecutive_losses: 999 }),
      10_000,
    );
    expect(result.tripped).toBe(false);
  });

  it("trips on weekly drawdown beyond threshold", async () => {
    // Trades spread across the week summing to -7% on 10k equity → trips 5% weekly.
    // consecutive_losses pumped to 999 so the loss streak doesn't trip first.
    const trades = [
      trade(-200, 24),   // 1 day ago
      trade(-300, 48),   // 2 days ago
      trade(-200, 96),   // 4 days ago
    ];
    const result = await checkBreaker(
      mockSupabase(trades),
      "algo-1",
      cfg({ daily_dd_pct: 99, weekly_dd_pct: 5, consecutive_losses: 999 }),
      10_000,
    );
    expect(result.tripped).toBe(true);
    expect(result.reason).toMatch(/^weekly_dd:/);
  });

  it("includes daily_pnl and weekly_pnl in the non-tripped result", async () => {
    const trades = [trade(50, 1), trade(-30, 24)];
    const result = await checkBreaker(mockSupabase(trades), "algo-1", cfg(), 10_000);
    expect(result.tripped).toBe(false);
    expect(result.daily_pnl).toBe(50);   // only the 1h-ago trade is "today"
    expect(result.weekly_pnl).toBe(20);  // 50 + (-30)
  });

  it("skips trades with null closed_at when summing PnL (defensive)", async () => {
    const trades = [
      { pnl: 100, closed_at: null },
      trade(-50, 1),
    ];
    const result = await checkBreaker(mockSupabase(trades), "algo-1", cfg(), 10_000);
    expect(result.weekly_pnl).toBe(-50);  // null-dated trade excluded from aggregate
  });

  it("guards against equity=0 (avoid division by zero in dd_pct)", async () => {
    const trades = [trade(-100, 1)];
    const result = await checkBreaker(mockSupabase(trades), "algo-1", cfg(), 0);
    // safeEquity = max(1, 0) = 1 → dailyDd = -10000% → trips
    expect(result.tripped).toBe(true);
  });

  it("returns clean state when no trades exist", async () => {
    const result = await checkBreaker(mockSupabase([]), "algo-1", cfg(), 10_000);
    expect(result.tripped).toBe(false);
    expect(result.daily_pnl).toBe(0);
    expect(result.weekly_pnl).toBe(0);
    expect(result.consecutive_loss_count).toBe(0);
  });
});
