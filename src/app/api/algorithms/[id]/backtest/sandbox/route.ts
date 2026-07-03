// POST /api/algorithms/[id]/backtest/sandbox — multi-config sandbox
// (Wave 5 item 25). Runs 2-8 named `rules` override variants of the same
// base config through the sync backtest engine and returns a side-by-side
// comparison — the kind of manual tuning loop done by hand for Strategy DD
// (see CLAUDE.md's DD history), now automated.
//
// IMPORTANT — variants override `rules` fields (slPoints, tpPoints, sizing,
// maxConcurrent), NOT `config.parameters`. Verified against
// src/lib/backtest/engine.ts before writing this: `runBacktest()` never
// reads `cfg.parameters` anywhere — only `cfg.rules` drives simulated
// entry/exit/sizing decisions. A "parameters override" sandbox would have
// been a no-op facade that silently produced identical results for every
// variant. This generalizes the sibling `/api/backtest/sensitivity`
// endpoint's fixed 3-axis grid (slPoints/tpPoints/sizingValue, one value
// each) to named variants that can combine any of those fields plus
// maxConcurrent and sizing.mode/riskPerTradePct at once.
//
// Deliberately NOT persisted to `backtest_jobs` — no schema change needed.
// Wave 3 item 10 confirmed the two backtest engines (this sync one and the
// async `backtest_jobs` one) are intentionally separate; this stays on the
// sync side by design.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/security/aiRateLimit";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { runBacktest } from "@/lib/backtest/engine";
import { logError } from "@/lib/log";
import type { BacktestConfig, BacktestMetrics } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as const;

const indicatorRefSchema = z.object({
  type: z.enum(["sma", "ema", "rsi", "atr", "bb_upper", "bb_lower", "macd", "price"]),
  period: z.number().int().positive().optional(),
  field: z.enum(["open", "high", "low", "close"]).optional(),
  shift: z.number().int().min(0).max(50).optional(),
});

const conditionSchema = z.object({
  left: z.union([indicatorRefSchema, z.number()]),
  op: z.enum([">", "<", ">=", "<=", "==", "cross_above", "cross_below"]),
  right: z.union([indicatorRefSchema, z.number()]),
});

const rulesSchema = z.object({
  entryLong: z.array(conditionSchema).optional(),
  entryShort: z.array(conditionSchema).optional(),
  exitLong: z.array(conditionSchema).optional(),
  exitShort: z.array(conditionSchema).optional(),
  slPoints: z.number().nonnegative().optional(),
  tpPoints: z.number().nonnegative().optional(),
  sizing: z.object({
    mode: z.enum(["fixed_lot", "risk_pct", "kelly"]),
    value: z.number().positive(),
    riskPerTradePct: z.number().positive().optional(),
  }),
  maxConcurrent: z.number().int().min(1).max(20).optional(),
});

const requestSchema = z.object({
  config: z.object({
    symbol: z.string().min(1).max(32),
    timeframe: z.enum(TIMEFRAMES),
    from: z.string(),
    to: z.string(),
    initialBalance: z.number().positive(),
    contractSize: z.number().positive(),
    pointValue: z.number().positive(),
    spreadPoints: z.number().nonnegative(),
    commissionPerLot: z.number().nonnegative(),
    slippagePoints: z.number().nonnegative(),
    direction: z.enum(["long", "short", "both"]),
    parameters: z.record(z.string(), z.unknown()).default({}),
    rules: rulesSchema,
  }),
  variants: z.array(z.object({
    label: z.string().min(1).max(60),
    // Partial overrides merged into config.rules — these are the fields
    // that actually drive runBacktest()'s trade decisions. sizing is
    // merged shallowly (mode/value/riskPerTradePct individually
    // overridable) since rules.sizing.mode is required elsewhere.
    rulesOverrides: z.object({
      slPoints: z.number().nonnegative().optional(),
      tpPoints: z.number().nonnegative().optional(),
      maxConcurrent: z.number().int().min(1).max(20).optional(),
      sizing: z.object({
        mode: z.enum(["fixed_lot", "risk_pct", "kelly"]).optional(),
        value: z.number().positive().optional(),
        riskPerTradePct: z.number().positive().optional(),
      }).optional(),
    }).default({}),
  })).min(2).max(8),
});

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = await checkAiRateLimit(user.id, "algo-backtest-sandbox", 5);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSeconds ?? 3600), "X-RateLimit-Limit": "5" },
      });
    }

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (algoErr || !algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    const { config, variants } = parsed.data;

    const labels = variants.map((v) => v.label);
    if (new Set(labels).size !== labels.length) {
      return NextResponse.json({ error: "Variant labels must be unique" }, { status: 400 });
    }

    const bars = await loadHistoricalBars(supabase, config.symbol, config.timeframe, config.from, config.to);
    if (bars.length < 60) {
      return NextResponse.json({ error: `Not enough bars: ${bars.length}. Run the historical bridge to ingest data.` }, { status: 400 });
    }

    const baseConfig = {
      ...config,
      monteCarloIterations: 0,
      walkForwardWindows: 0,
      stressTests: false,
    } as BacktestConfig;

    const results: { label: string; metrics: BacktestMetrics }[] = [];
    for (const variant of variants) {
      const variantConfig: BacktestConfig = {
        ...baseConfig,
        rules: {
          ...baseConfig.rules,
          ...variant.rulesOverrides,
          sizing: { ...baseConfig.rules.sizing, ...variant.rulesOverrides.sizing },
        },
      };
      const result = await runBacktest(bars, variantConfig);
      results.push({ label: variant.label, metrics: result.metrics });
    }

    const best = results.reduce((a, b) => (b.metrics.totalPnl > a.metrics.totalPnl ? b : a), results[0]);

    return NextResponse.json({ results, best: best.label, barsUsed: bars.length }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("Algorithms", { component: "POST /api/algorithms/[id]/backtest/sandbox", message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
