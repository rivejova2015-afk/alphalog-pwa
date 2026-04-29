import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { runSensitivitySweep } from "@/lib/backtest/sensitivity";
import { logError } from "@/lib/log";
import type { BacktestConfig } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as const;
const AXES = ["slPoints", "tpPoints", "sizingValue"] as const;

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
  spec: z.object({
    xAxis: z.enum(AXES),
    xValues: z.array(z.number()).min(1).max(8),
    yAxis: z.enum(AXES).optional(),
    yValues: z.array(z.number()).min(1).max(8).optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }
    const { config, spec } = parsed.data;

    const totalCells = spec.xValues.length * (spec.yValues?.length ?? 1);
    if (totalCells > 36) {
      return NextResponse.json({ error: `Grid too large: ${totalCells} cells (max 36)` }, { status: 400 });
    }

    const bars = await loadHistoricalBars(supabase, config.symbol, config.timeframe, config.from, config.to);
    if (bars.length < 60) {
      return NextResponse.json({ error: `Not enough bars: ${bars.length}. Run the historical bridge to ingest data.` }, { status: 400 });
    }

    const fullConfig = {
      ...config,
      monteCarloIterations: 0,
      walkForwardWindows: 0,
      stressTests: false,
    } as BacktestConfig;

    const result = await runSensitivitySweep(bars, fullConfig, spec);

    return NextResponse.json({ result, barsUsed: bars.length }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    logError("BacktestSensitivity", { component: "POST /api/backtest/sensitivity", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
