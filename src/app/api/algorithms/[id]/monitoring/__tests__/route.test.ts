/**
 * Pure-builder tests for /api/algorithms/[id]/monitoring.
 *
 * The route handler itself is harder to test (Supabase client, auth context,
 * RLS), so we factor the data shaping into pure functions and exercise those.
 * The aggregate behavior of the endpoint is covered by a smoke test on
 * production data after deploy.
 */

import { describe, it, expect } from "vitest";
import {
  buildRegimeDistribution,
  buildRecentTrades,
  buildPerStrategyStats,
  buildTopSkipReasons,
  normalizeSkipReason,
} from "../route";

describe("buildRegimeDistribution", () => {
  it("returns empty array when no rows", () => {
    expect(buildRegimeDistribution([])).toEqual([]);
  });

  it("dedupes by tick (last_heartbeat_at) so 4 runners on the same tick count once", () => {
    const tick = "2026-06-22T00:00:00Z";
    const rows = [
      { regime: "RANGE_HIGH", last_heartbeat_at: tick },
      { regime: "RANGE_HIGH", last_heartbeat_at: tick },
      { regime: "RANGE_HIGH", last_heartbeat_at: tick },
      { regime: "RANGE_HIGH", last_heartbeat_at: tick },
    ];
    const result = buildRegimeDistribution(rows);
    expect(result).toHaveLength(1);
    expect(result[0].regime).toBe("RANGE_HIGH");
    expect(result[0].pct).toBe(1);
  });

  it("aggregates pct across distinct ticks", () => {
    const rows = [
      { regime: "RANGE_HIGH", last_heartbeat_at: "t1" },
      { regime: "RANGE_HIGH", last_heartbeat_at: "t2" },
      { regime: "RANGE_HIGH", last_heartbeat_at: "t3" },
      { regime: "DEAD", last_heartbeat_at: "t4" },
    ];
    const result = buildRegimeDistribution(rows);
    expect(result.find((r) => r.regime === "RANGE_HIGH")?.pct).toBe(0.75);
    expect(result.find((r) => r.regime === "DEAD")?.pct).toBe(0.25);
  });

  it("sorts by pct descending — dominant regime first", () => {
    const rows = [
      { regime: "DEAD", last_heartbeat_at: "t1" },
      { regime: "RANGE_HIGH", last_heartbeat_at: "t2" },
      { regime: "RANGE_HIGH", last_heartbeat_at: "t3" },
    ];
    const result = buildRegimeDistribution(rows);
    expect(result[0].regime).toBe("RANGE_HIGH");
    expect(result[1].regime).toBe("DEAD");
  });

  it("excludes regimes with zero ticks", () => {
    const rows = [{ regime: "RANGE_HIGH", last_heartbeat_at: "t1" }];
    const result = buildRegimeDistribution(rows);
    expect(result.every((r) => r.pct > 0)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("computes hours as ticks × 15 / 3600", () => {
    const rows = Array.from({ length: 240 }, (_, i) => ({
      regime: "RANGE_HIGH",
      last_heartbeat_at: `tick-${i}`,
    }));
    // 240 ticks × 15s = 3600s = 1h
    const result = buildRegimeDistribution(rows);
    expect(result[0].hours).toBe(1);
  });

  it("skips rows without last_heartbeat_at", () => {
    const rows = [
      { regime: "RANGE_HIGH", last_heartbeat_at: "t1" },
      { regime: "RANGE_HIGH", last_heartbeat_at: null },
    ];
    expect(buildRegimeDistribution(rows)).toHaveLength(1);
  });

  it("treats null/unknown regimes as UNKNOWN and excludes them from output", () => {
    const rows = [
      { regime: null, last_heartbeat_at: "t1" },
      { regime: "RANGE_HIGH", last_heartbeat_at: "t2" },
    ];
    const result = buildRegimeDistribution(rows);
    // Only RANGE_HIGH is emitted; UNKNOWN bucket is internal
    expect(result.map((r) => r.regime)).toEqual(["RANGE_HIGH"]);
    expect(result[0].pct).toBe(0.5); // 1 of 2 ticks
  });
});

describe("buildRecentTrades", () => {
  it("returns empty when no rows", () => {
    expect(buildRecentTrades([])).toEqual([]);
  });

  it("normalizes direction to BUY|SELL only", () => {
    const result = buildRecentTrades([
      {
        id: "1", symbol: "BTC-USD", strategy_id: "A", direction: "BUY",
        entry_price: 100, exit_price: 110, pnl_usd: 5, exit_reason: "TP",
        opened_at: "t", closed_at: "t2", regime: "RANGE_HIGH", status: "CLOSED",
      },
      {
        id: "2", symbol: "ETH-USD", strategy_id: "B", direction: "WEIRD",
        entry_price: null, exit_price: null, pnl_usd: null, exit_reason: null,
        opened_at: "t", closed_at: null, regime: null, status: "OPEN",
      },
    ]);
    expect(result[0].direction).toBe("BUY");
    expect(result[1].direction).toBe("BUY"); // fallback for non-SELL
  });

  it("coerces numeric strings to numbers", () => {
    const result = buildRecentTrades([
      {
        id: "1", symbol: "BTC-USD", strategy_id: "M", direction: "SELL",
        entry_price: "100.5" as unknown as number, exit_price: 95, pnl_usd: -5.5,
        exit_reason: "SL", opened_at: "t", closed_at: "t2", regime: "RANGE_LOW", status: "CLOSED",
      },
    ]);
    expect(result[0].entryPrice).toBe(100.5);
    expect(result[0].pnlUsd).toBe(-5.5);
    expect(result[0].direction).toBe("SELL");
  });

  it("returns null for non-finite price fields", () => {
    const result = buildRecentTrades([
      {
        id: "1", symbol: "BTC-USD", strategy_id: "A", direction: "BUY",
        entry_price: null, exit_price: null, pnl_usd: null, exit_reason: null,
        opened_at: "t", closed_at: null, regime: null, status: "OPEN",
      },
    ]);
    expect(result[0].entryPrice).toBeNull();
    expect(result[0].pnlUsd).toBeNull();
  });
});

describe("buildPerStrategyStats", () => {
  it("returns zeroed stats for all 4 strategies when no rows", () => {
    const result = buildPerStrategyStats([], null);
    expect(result.A.enters).toBe(0);
    expect(result.B.enters).toBe(0);
    expect(result.M.enters).toBe(0);
    expect(result.P.enters).toBe(0);
    expect(Object.values(result).every((s) => !s.isCurrentlyDispatched)).toBe(true);
  });

  it("counts ENTERs and EXITs per strategy", () => {
    const result = buildPerStrategyStats(
      [
        { strategy_id: "A", kind: "ENTER", meta: null, created_at: "t1" },
        { strategy_id: "A", kind: "ENTER", meta: null, created_at: "t2" },
        { strategy_id: "A", kind: "EXIT", meta: { pnlUsd: 10 }, created_at: "t3" },
        { strategy_id: "B", kind: "ENTER", meta: null, created_at: "t4" },
      ],
      null,
    );
    expect(result.A.enters).toBe(2);
    expect(result.A.exits).toBe(1);
    expect(result.B.enters).toBe(1);
  });

  it("computes winRate = wins / exits, 0 on no exits", () => {
    const result = buildPerStrategyStats(
      [
        { strategy_id: "M", kind: "EXIT", meta: { pnlUsd: 10 }, created_at: "t1" },
        { strategy_id: "M", kind: "EXIT", meta: { pnlUsd: -5 }, created_at: "t2" },
        { strategy_id: "M", kind: "EXIT", meta: { pnlUsd: 8 }, created_at: "t3" },
      ],
      null,
    );
    expect(result.M.winRate).toBeCloseTo(2 / 3, 3);
  });

  it("computes pnlR as sum(pnlUsd) / $5", () => {
    const result = buildPerStrategyStats(
      [
        { strategy_id: "A", kind: "EXIT", meta: { pnlUsd: 10 }, created_at: "t1" },
        { strategy_id: "A", kind: "EXIT", meta: { pnlUsd: -5 }, created_at: "t2" },
      ],
      null,
    );
    expect(result.A.pnlR).toBe(1); // ( 10 + -5 ) / 5 = 1
  });

  it("flags isCurrentlyDispatched on the strategy mapped to the current regime", () => {
    const result = buildPerStrategyStats([], "RANGE_LOW");
    expect(result.M.isCurrentlyDispatched).toBe(true);
    expect(result.A.isCurrentlyDispatched).toBe(false);
  });

  it("does not flag anyone when regime is DEAD (pause)", () => {
    const result = buildPerStrategyStats([], "DEAD");
    expect(Object.values(result).every((s) => !s.isCurrentlyDispatched)).toBe(true);
  });

  it("ignores rows with unknown strategy_id", () => {
    const result = buildPerStrategyStats(
      [{ strategy_id: "Z" as unknown as string, kind: "ENTER", meta: null, created_at: "t1" }],
      null,
    );
    expect(result.A.enters).toBe(0);
  });
});

describe("buildTopSkipReasons", () => {
  it("returns empty when no rows", () => {
    expect(buildTopSkipReasons([])).toEqual([]);
  });

  it("groups by normalized reason and sorts by count desc", () => {
    const rows = [
      { reason: "liquidity-sweep: not detected", strategy_id: "A", created_at: "t" },
      { reason: "liquidity-sweep: not detected", strategy_id: "A", created_at: "t" },
      { reason: "liquidity-sweep: not detected", strategy_id: "A", created_at: "t" },
      { reason: "mtf bias=BUY conf=0.10 (need >=0.15 BUY/SELL)", strategy_id: "A", created_at: "t" },
      { reason: "mtf bias=SELL conf=0.12 (need >=0.15 BUY/SELL)", strategy_id: "A", created_at: "t" },
    ];
    const result = buildTopSkipReasons(rows);
    expect(result[0].count).toBe(3);
    expect(result[0].reason).toBe("liquidity-sweep: not detected");
    expect(result[1].count).toBe(2);
    expect(result[1].reason).toBe("mtf confidence below floor");
  });

  it("caps at 8 entries", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      reason: `unique-reason-${i}`,
      strategy_id: "A",
      created_at: "t",
    }));
    expect(buildTopSkipReasons(rows)).toHaveLength(8);
  });
});

describe("normalizeSkipReason", () => {
  const cases: Array<[string, string]> = [
    ["mtf bias=BUY conf=0.12 (need >=0.15 BUY/SELL)", "mtf confidence below floor"],
    ["liquidity-sweep: not detected", "liquidity-sweep: not detected"],
    ["symbol cap reached (17/33)", "symbol cap reached"],
    ["premium-discount: macro=PREMIUM_micro=PREMIUM", "premium-discount mismatch"],
    ["warming up (cb=5, bn=8)", "warming up"],
    ["regime=DEAD → pause (no actionable market)", "regime=DEAD → pause"],
    ["symbol locked by other strategy", "symbol locked by other strategy"],
    ["", ""],
  ];
  for (const [input, expected] of cases) {
    it(`normalizes "${input.slice(0, 40)}..." → "${expected}"`, () => {
      expect(normalizeSkipReason(input)).toBe(expected);
    });
  }
});
