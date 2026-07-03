import { describe, it, expect } from "vitest";
import { edgeChecks, sharpeOos, sampleSize, walkForwardEff, oosPct, profitFactor, regimeConsistency } from "./checks/edge";
import { capitalChecks, riskPerTrade, kellyFraction, maxDrawdown, correlationCap, ddLimitsSet } from "./checks/capital";
import { microChecks, slippageRealistic, costsIncluded, latencyP99, survivorshipClean } from "./checks/micro";
import { opsChecks, heartbeatActive, killSwitchWired, auditTrail, versionPinned, forwardPaper30d } from "./checks/ops";
import type { CheckContext } from "./types";

// ─── Minimal context builders ────────────────────────────────────────────────

function baseCtx(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    algorithm: {
      id: "algo-1",
      user_id: "user-1",
      name: "TestAlgo",
      status: "paper",
      market_type: "forex",
      risk_percent: null,
      max_drawdown_pct: null,
      linked_bot_account_id: null,
      parameters: {},
      scan_config: null,
    },
    backtest: null,
    telemetry: {
      last_heartbeat_ts: null, execution_latency_p99_ms: null,
      heartbeat_applicable: true, latency_applicable: true,
    },
    ops: { last_kill_ack_ms: null, paper_trades_30d: 0, audit_trail_complete: false },
    ...overrides,
  };
}

function withBacktest(opts: {
  totalTrades?: number;
  profitFactor?: number;
  maxDrawdown?: number;
  kellyFraction?: number;
  walkForwardEfficiency?: number;
  oosPct?: number;
  sharpeOos?: number;
  regimeCv?: number;
  slippageModel?: string;
  hasSpread?: boolean;
  hasCommission?: boolean;
  hasSwap?: boolean;
  includeDelisted?: boolean;
} = {}): CheckContext["backtest"] {
  return {
    job_id: "job-1",
    config: {
      slippage_model: opts.slippageModel ?? "fixed",
      ...(opts.hasSpread !== false ? { spread: 2 } : {}),
      ...(opts.hasCommission !== false ? { commission: 7 } : {}),
      ...(opts.hasSwap !== false ? { swap_long: -0.3 } : {}),
      ...(opts.includeDelisted !== undefined ? { include_delisted: opts.includeDelisted } : {}),
    },
    metrics: {
      totalTrades: opts.totalTrades ?? 600,
      profitFactor: opts.profitFactor ?? 1.6,
      maxDrawdown: opts.maxDrawdown ?? 0.15,
      kelly_fraction: opts.kellyFraction ?? 0.2,
    },
    walk_forward: {
      efficiency: opts.walkForwardEfficiency ?? 0.7,
      oos_pct: opts.oosPct ?? 35,
      oos: { sharpe: opts.sharpeOos ?? 1.8 },
      regime_cv: opts.regimeCv ?? 0.2,
    },
    stress_tests: {
      regime_cv: opts.regimeCv ?? 0.2,
    },
    created_at: new Date().toISOString(),
  };
}

// ─── Edge checks ─────────────────────────────────────────────────────────────

describe("edgeChecks", () => {
  it("exports 6 checks", () => {
    expect(edgeChecks).toHaveLength(6);
  });

  describe("sharpeOos", () => {
    it("pasa cuando sharpe OOS >= 1.5", () => {
      const r = sharpeOos(baseCtx({ backtest: withBacktest({ sharpeOos: 1.8 }) }));
      expect(r.passed).toBe(true);
      expect(r.value_observed).toBeCloseTo(1.8);
    });
    it("falla cuando sharpe OOS < 1.5", () => {
      const r = sharpeOos(baseCtx({ backtest: withBacktest({ sharpeOos: 1.2 }) }));
      expect(r.passed).toBe(false);
    });
    it("falla cuando no hay walk_forward", () => {
      const bt = withBacktest();
      bt!.walk_forward = null;
      const r = sharpeOos(baseCtx({ backtest: bt }));
      expect(r.passed).toBe(false);
      expect(r.reason).toContain("walk-forward");
    });
    it("falla cuando no hay backtest", () => {
      const r = sharpeOos(baseCtx());
      expect(r.passed).toBe(false);
    });
  });

  describe("sampleSize", () => {
    it("pasa con >= 500 trades", () => {
      const r = sampleSize(baseCtx({ backtest: withBacktest({ totalTrades: 700 }) }));
      expect(r.passed).toBe(true);
    });
    it("falla con < 500 trades", () => {
      const r = sampleSize(baseCtx({ backtest: withBacktest({ totalTrades: 300 }) }));
      expect(r.passed).toBe(false);
    });
    it("falla sin backtest", () => {
      expect(sampleSize(baseCtx()).passed).toBe(false);
    });
  });

  describe("walkForwardEff", () => {
    it("pasa con efficiency >= 0.5", () => {
      expect(walkForwardEff(baseCtx({ backtest: withBacktest({ walkForwardEfficiency: 0.7 }) })).passed).toBe(true);
    });
    it("falla con efficiency < 0.5", () => {
      expect(walkForwardEff(baseCtx({ backtest: withBacktest({ walkForwardEfficiency: 0.3 }) })).passed).toBe(false);
    });
  });

  describe("oosPct", () => {
    it("pasa con oos_pct >= 30", () => {
      expect(oosPct(baseCtx({ backtest: withBacktest({ oosPct: 40 }) })).passed).toBe(true);
    });
    it("falla con oos_pct < 30", () => {
      expect(oosPct(baseCtx({ backtest: withBacktest({ oosPct: 25 }) })).passed).toBe(false);
    });
  });

  describe("profitFactor", () => {
    it("pasa con PF >= 1.4", () => {
      expect(profitFactor(baseCtx({ backtest: withBacktest({ profitFactor: 1.6 }) })).passed).toBe(true);
    });
    it("falla con PF < 1.4", () => {
      expect(profitFactor(baseCtx({ backtest: withBacktest({ profitFactor: 1.2 }) })).passed).toBe(false);
    });
  });

  describe("regimeConsistency", () => {
    it("pasa con regime_cv <= 0.3", () => {
      expect(regimeConsistency(baseCtx({ backtest: withBacktest({ regimeCv: 0.2 }) })).passed).toBe(true);
    });
    it("falla con regime_cv > 0.3", () => {
      expect(regimeConsistency(baseCtx({ backtest: withBacktest({ regimeCv: 0.5 }) })).passed).toBe(false);
    });
    it("falla sin stress_tests", () => {
      const bt = withBacktest();
      bt!.stress_tests = null;
      expect(regimeConsistency(baseCtx({ backtest: bt })).passed).toBe(false);
    });
  });
});

// ─── Capital checks ───────────────────────────────────────────────────────────

describe("capitalChecks", () => {
  it("exports 5 checks", () => {
    expect(capitalChecks).toHaveLength(5);
  });

  describe("riskPerTrade", () => {
    it("pasa cuando risk_percent <= 1%", () => {
      const ctx = baseCtx();
      ctx.algorithm.risk_percent = 0.5;
      expect(riskPerTrade(ctx).passed).toBe(true);
    });
    it("pasa cuando está en parameters.risk_percent", () => {
      const ctx = baseCtx();
      ctx.algorithm.parameters = { risk_percent: 0.8 };
      expect(riskPerTrade(ctx).passed).toBe(true);
    });
    it("falla cuando risk_percent > 1%", () => {
      const ctx = baseCtx();
      ctx.algorithm.risk_percent = 2.0;
      expect(riskPerTrade(ctx).passed).toBe(false);
    });
    it("falla cuando no está configurado", () => {
      expect(riskPerTrade(baseCtx()).passed).toBe(false);
    });
  });

  describe("kellyFraction", () => {
    it("pasa con kelly <= 0.25 en backtest metrics", () => {
      expect(kellyFraction(baseCtx({ backtest: withBacktest({ kellyFraction: 0.2 }) })).passed).toBe(true);
    });
    it("falla con kelly > 0.25", () => {
      expect(kellyFraction(baseCtx({ backtest: withBacktest({ kellyFraction: 0.35 }) })).passed).toBe(false);
    });
    it("pasa con kelly en parameters", () => {
      const ctx = baseCtx();
      ctx.algorithm.parameters = { kelly_fraction: 0.15 };
      expect(kellyFraction(ctx).passed).toBe(true);
    });
    it("falla sin kelly en ningún lado", () => {
      expect(kellyFraction(baseCtx()).passed).toBe(false);
    });
  });

  describe("maxDrawdown", () => {
    it("pasa con DD < 20% (fracción)", () => {
      expect(maxDrawdown(baseCtx({ backtest: withBacktest({ maxDrawdown: 0.15 }) })).passed).toBe(true);
    });
    it("pasa con DD < 20% (porcentaje directo)", () => {
      expect(maxDrawdown(baseCtx({ backtest: withBacktest({ maxDrawdown: 18 }) })).passed).toBe(true);
    });
    it("falla con DD >= 20%", () => {
      expect(maxDrawdown(baseCtx({ backtest: withBacktest({ maxDrawdown: 0.25 }) })).passed).toBe(false);
    });
    it("pasa con max_drawdown_pct en algorithm", () => {
      const ctx = baseCtx();
      ctx.algorithm.max_drawdown_pct = 15;
      expect(maxDrawdown(ctx).passed).toBe(true);
    });
  });

  describe("correlationCap", () => {
    it("pasa con max_correlation <= 0.7", () => {
      const ctx = baseCtx();
      ctx.algorithm.parameters = { max_correlation: 0.5 };
      expect(correlationCap(ctx).passed).toBe(true);
    });
    it("falla con max_correlation > 0.7", () => {
      const ctx = baseCtx();
      ctx.algorithm.parameters = { max_correlation: 0.8 };
      expect(correlationCap(ctx).passed).toBe(false);
    });
    it("falla sin max_correlation", () => {
      expect(correlationCap(baseCtx()).passed).toBe(false);
    });
  });

  describe("ddLimitsSet", () => {
    it("pasa con daily_dd_limit definido", () => {
      const ctx = baseCtx();
      ctx.algorithm.parameters = { daily_dd_limit: 5 };
      expect(ddLimitsSet(ctx).passed).toBe(true);
    });
    it("falla sin daily_dd_limit", () => {
      expect(ddLimitsSet(baseCtx()).passed).toBe(false);
    });
    it("falla con daily_dd_limit = 0", () => {
      const ctx = baseCtx();
      ctx.algorithm.parameters = { daily_dd_limit: 0 };
      expect(ddLimitsSet(ctx).passed).toBe(false);
    });
  });
});

// ─── Micro checks ─────────────────────────────────────────────────────────────

describe("microChecks", () => {
  it("exports 4 checks", () => {
    expect(microChecks).toHaveLength(4);
  });

  describe("slippageRealistic", () => {
    it("pasa con liquidity_bucket", () => {
      expect(slippageRealistic(baseCtx({ backtest: withBacktest({ slippageModel: "liquidity_bucket" }) })).passed).toBe(true);
    });
    it("pasa con spread_aware", () => {
      expect(slippageRealistic(baseCtx({ backtest: withBacktest({ slippageModel: "spread_aware" }) })).passed).toBe(true);
    });
    it("falla con fixed", () => {
      expect(slippageRealistic(baseCtx({ backtest: withBacktest({ slippageModel: "fixed" }) })).passed).toBe(false);
    });
    it("falla sin backtest", () => {
      expect(slippageRealistic(baseCtx()).passed).toBe(false);
    });
  });

  describe("costsIncluded", () => {
    it("pasa cuando spread, commission y swap están presentes", () => {
      expect(costsIncluded(baseCtx({ backtest: withBacktest() })).passed).toBe(true);
    });
    it("falla cuando falta spread", () => {
      expect(costsIncluded(baseCtx({ backtest: withBacktest({ hasSpread: false }) })).passed).toBe(false);
    });
    it("falla cuando falta commission", () => {
      expect(costsIncluded(baseCtx({ backtest: withBacktest({ hasCommission: false }) })).passed).toBe(false);
    });
    it("falla sin backtest", () => {
      expect(costsIncluded(baseCtx()).passed).toBe(false);
    });
  });

  describe("latencyP99", () => {
    it("pasa con p99 <= 250ms", () => {
      const ctx = baseCtx();
      ctx.telemetry = {
        last_heartbeat_ts: null, execution_latency_p99_ms: 200,
        heartbeat_applicable: true, latency_applicable: true,
      };
      expect(latencyP99(ctx).passed).toBe(true);
    });
    it("falla con p99 > 250ms", () => {
      const ctx = baseCtx();
      ctx.telemetry = {
        last_heartbeat_ts: null, execution_latency_p99_ms: 300,
        heartbeat_applicable: true, latency_applicable: true,
      };
      expect(latencyP99(ctx).passed).toBe(false);
    });
    it("no aplica cuando el mercado no tiene telemetría de latencia wireada", () => {
      const ctx = baseCtx();
      ctx.telemetry = {
        last_heartbeat_ts: null, execution_latency_p99_ms: null,
        heartbeat_applicable: true, latency_applicable: false,
      };
      const result = latencyP99(ctx);
      expect(result.passed).toBe(true);
      expect(result.applicable).toBe(false);
    });
    it("falla sin telemetría", () => {
      expect(latencyP99(baseCtx()).passed).toBe(false);
    });
  });

  describe("survivorshipClean", () => {
    it("pasa con include_delisted = true", () => {
      expect(survivorshipClean(baseCtx({ backtest: withBacktest({ includeDelisted: true }) })).passed).toBe(true);
    });
    it("falla con include_delisted = false", () => {
      expect(survivorshipClean(baseCtx({ backtest: withBacktest({ includeDelisted: false }) })).passed).toBe(false);
    });
    it("falla sin el campo", () => {
      expect(survivorshipClean(baseCtx({ backtest: withBacktest() })).passed).toBe(false);
    });
  });
});

// ─── Ops checks ───────────────────────────────────────────────────────────────

describe("opsChecks", () => {
  it("exports 5 checks", () => {
    expect(opsChecks).toHaveLength(5);
  });

  describe("heartbeatActive", () => {
    it("pasa con heartbeat reciente", () => {
      const ctx = baseCtx();
      ctx.telemetry.last_heartbeat_ts = new Date(Date.now() - 30_000).toISOString();
      expect(heartbeatActive(ctx).passed).toBe(true);
    });
    it("falla con heartbeat > 120s", () => {
      const ctx = baseCtx();
      ctx.telemetry.last_heartbeat_ts = new Date(Date.now() - 150_000).toISOString();
      expect(heartbeatActive(ctx).passed).toBe(false);
    });
    it("falla sin heartbeat", () => {
      expect(heartbeatActive(baseCtx()).passed).toBe(false);
    });
    it("no aplica cuando el mercado no tiene telemetría de heartbeat wireada", () => {
      const ctx = baseCtx();
      ctx.telemetry.heartbeat_applicable = false;
      const result = heartbeatActive(ctx);
      expect(result.passed).toBe(true);
      expect(result.applicable).toBe(false);
    });
  });

  describe("killSwitchWired", () => {
    it("pasa con KILL ack < 2000ms", () => {
      const ctx = baseCtx();
      ctx.ops.last_kill_ack_ms = 500;
      expect(killSwitchWired(ctx).passed).toBe(true);
    });
    it("falla con KILL ack >= 2000ms", () => {
      const ctx = baseCtx();
      ctx.ops.last_kill_ack_ms = 3000;
      expect(killSwitchWired(ctx).passed).toBe(false);
    });
    it("falla sin ack registrado", () => {
      expect(killSwitchWired(baseCtx()).passed).toBe(false);
    });
  });

  describe("auditTrail", () => {
    it("pasa con audit_trail_complete = true", () => {
      const ctx = baseCtx();
      ctx.ops.audit_trail_complete = true;
      expect(auditTrail(ctx).passed).toBe(true);
    });
    it("falla con audit_trail_complete = false", () => {
      expect(auditTrail(baseCtx()).passed).toBe(false);
    });
  });

  describe("versionPinned", () => {
    it("pasa con engine_version y seed definidos", () => {
      const ctx = baseCtx();
      ctx.algorithm.parameters = { engine_version: "1.0.0", seed: 42 };
      expect(versionPinned(ctx).passed).toBe(true);
    });
    it("falla sin engine_version", () => {
      const ctx = baseCtx();
      ctx.algorithm.parameters = { seed: 42 };
      expect(versionPinned(ctx).passed).toBe(false);
    });
    it("falla sin seed", () => {
      const ctx = baseCtx();
      ctx.algorithm.parameters = { engine_version: "1.0.0" };
      expect(versionPinned(ctx).passed).toBe(false);
    });
    it("falla sin ambos", () => {
      expect(versionPinned(baseCtx()).passed).toBe(false);
    });
  });

  describe("forwardPaper30d", () => {
    it("pasa con >= 100 paper trades", () => {
      const ctx = baseCtx();
      ctx.ops.paper_trades_30d = 150;
      expect(forwardPaper30d(ctx).passed).toBe(true);
    });
    it("falla con < 100 paper trades", () => {
      const ctx = baseCtx();
      ctx.ops.paper_trades_30d = 50;
      expect(forwardPaper30d(ctx).passed).toBe(false);
    });
    it("falla con 0 paper trades", () => {
      expect(forwardPaper30d(baseCtx()).passed).toBe(false);
    });
  });
});
