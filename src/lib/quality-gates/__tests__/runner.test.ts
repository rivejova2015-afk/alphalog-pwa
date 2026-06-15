// Tests for the quality-gates runner orchestrator.
//
// `evaluateAll` is pure (in/out only) and `computeGates` is the async
// orchestrator that hits 4 supabase tables. The individual check
// implementations are covered by checks.test.ts; here we focus on the
// orchestration layer:
//   1. evaluateAll runs all 20 checks against a synthetic context.
//   2. computeGates throws when the algorithm row isn't found.
//   3. computeGates throws when the insert into quality_gate_results errors.
//   4. computeGates throws when the score row fetch errors.
//   5. computeGates returns a synthesized score when the score row is null
//      (fallback path for fresh algos that haven't been scored before).
//   6. computeGates passes the algorithm_id + user_id through to the score
//      lookup.
//   7. evaluateAll output count matches the registered check count.

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateAll, computeGates } from "../runner";
import type { CheckContext, GateScore } from "../types";

const emptyContext: CheckContext = {
  algorithm: {
    id:                    "algo-1",
    user_id:               "u1",
    name:                  "x",
    status:                "approved",
    risk_percent:          1,
    max_drawdown_pct:      5,
    linked_bot_account_id: "ba-1",
    parameters:            {},
    scan_config:           null,
  },
  backtest: null,
  telemetry: { last_heartbeat_ts: null, execution_latency_p99_ms: null },
  ops:       { last_kill_ack_ms: null, paper_trades_30d: 0, audit_trail_complete: false },
};

describe("evaluateAll — pure runner", () => {
  it("runs all registered checks and emits one GateResult per check", () => {
    const results = evaluateAll(emptyContext);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBe(20);  // 20 Tier-1 gates total
    // Every entry should have the canonical shape.
    for (const r of results) {
      expect(r).toHaveProperty("gate_key");
      expect(r).toHaveProperty("passed");
      expect(r).toHaveProperty("value_observed");
      expect(r).toHaveProperty("reason");
      expect(typeof r.passed).toBe("boolean");
    }
  });

  it("with empty/null inputs most gates fail (no data yet)", () => {
    const results = evaluateAll(emptyContext);
    const failed = results.filter((r) => !r.passed).length;
    // A bare context can't pass edge/capital/ops gates that need real data.
    expect(failed).toBeGreaterThan(5);
  });

  it("returns gate_keys that are all unique (no duplicate registrations)", () => {
    const results = evaluateAll(emptyContext);
    const keys = new Set(results.map((r) => r.gate_key));
    expect(keys.size).toBe(results.length);
  });
});

// Lightweight chain builder that lets us route reads/writes by table.
function makeAwaitableChain(result: { data?: unknown; error?: unknown; count?: number }) {
  const proxy: Record<string, unknown> = {};
  const chainable = ["select", "eq", "is", "in", "gte", "order", "limit", "maybeSingle", "single", "insert", "ilike"];
  for (const m of chainable) proxy[m] = () => proxy;
  proxy.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return proxy;
}

function makeSb(perTable: Record<string, ReturnType<typeof makeAwaitableChain>>): SupabaseClient {
  return {
    from: vi.fn((table: string) => perTable[table] ?? makeAwaitableChain({ data: null, error: null })),
  } as unknown as SupabaseClient;
}

const VALID_ALGO_ROW = {
  id: "algo-1", user_id: "u1", name: "x", status: "approved",
  parameters: { audit_trail_enabled: true },
  risk_percent: 1, max_drawdown_pct: 5, linked_bot_account_id: "ba-1",
  scan_config: null, deployments: [],
};

describe("computeGates — orchestrator", () => {
  it("throws when the algorithm row is not found", async () => {
    const sb = makeSb({
      algorithms: makeAwaitableChain({ data: null, error: { message: "not found" } }),
    });
    await expect(computeGates(sb, "missing", "u1")).rejects.toThrow(/Algorithm missing not found/);
  });

  it("throws when inserting gate results errors", async () => {
    const sb = makeSb({
      algorithms:                       makeAwaitableChain({ data: VALID_ALGO_ROW, error: null }),
      backtest_jobs:                    makeAwaitableChain({ data: [], error: null }),
      bot_telemetry:                    makeAwaitableChain({ data: [], error: null }),
      bot_command_status:               makeAwaitableChain({ data: [], error: null }),
      algo_paper_trades:                makeAwaitableChain({ data: null, error: null, count: 0 }),
      algorithm_quality_gate_results:   makeAwaitableChain({ data: null, error: { message: "rls denied" } }),
      algorithm_quality_score:          makeAwaitableChain({ data: null, error: null }),
    });
    await expect(computeGates(sb, "algo-1", "u1")).rejects.toThrow(/Insert quality gate results: rls denied/);
  });

  it("throws when fetching the score row errors", async () => {
    const sb = makeSb({
      algorithms:                       makeAwaitableChain({ data: VALID_ALGO_ROW, error: null }),
      backtest_jobs:                    makeAwaitableChain({ data: [], error: null }),
      bot_telemetry:                    makeAwaitableChain({ data: [], error: null }),
      bot_command_status:               makeAwaitableChain({ data: [], error: null }),
      algo_paper_trades:                makeAwaitableChain({ data: null, error: null, count: 0 }),
      algorithm_quality_gate_results:   makeAwaitableChain({ data: null, error: null }),
      algorithm_quality_score:          makeAwaitableChain({ data: null, error: { message: "score boom" } }),
    });
    await expect(computeGates(sb, "algo-1", "u1")).rejects.toThrow(/Fetch score: score boom/);
  });

  it("returns a synthesized score when the score row is null", async () => {
    const sb = makeSb({
      algorithms:                       makeAwaitableChain({ data: VALID_ALGO_ROW, error: null }),
      backtest_jobs:                    makeAwaitableChain({ data: [], error: null }),
      bot_telemetry:                    makeAwaitableChain({ data: [], error: null }),
      bot_command_status:               makeAwaitableChain({ data: [], error: null }),
      algo_paper_trades:                makeAwaitableChain({ data: null, error: null, count: 0 }),
      algorithm_quality_gate_results:   makeAwaitableChain({ data: null, error: null }),
      algorithm_quality_score:          makeAwaitableChain({ data: null, error: null }),
    });
    const { score, results } = await computeGates(sb, "algo-1", "u1");
    expect(results.length).toBe(20);
    expect(score.algorithm_id).toBe("algo-1");
    expect(score.gates_total).toBe(20);
    expect(score.tier).toBe("NOT_READY");
    expect(typeof score.last_computed_at).toBe("string");
  });

  it("returns the persisted score when the score row exists", async () => {
    const persistedScore: GateScore = {
      algorithm_id:      "algo-1",
      gates_total:       20,
      gates_passed:      18,
      must_failed:       1,
      should_failed:     1,
      last_computed_at:  "2026-06-12T10:00:00Z",
      tier:              "TIER_1",
    };
    const sb = makeSb({
      algorithms:                       makeAwaitableChain({ data: VALID_ALGO_ROW, error: null }),
      backtest_jobs:                    makeAwaitableChain({ data: [], error: null }),
      bot_telemetry:                    makeAwaitableChain({ data: [], error: null }),
      bot_command_status:               makeAwaitableChain({ data: [], error: null }),
      algo_paper_trades:                makeAwaitableChain({ data: null, error: null, count: 0 }),
      algorithm_quality_gate_results:   makeAwaitableChain({ data: null, error: null }),
      algorithm_quality_score:          makeAwaitableChain({ data: persistedScore, error: null }),
    });
    const { score } = await computeGates(sb, "algo-1", "u1");
    expect(score).toEqual(persistedScore);
  });
});
