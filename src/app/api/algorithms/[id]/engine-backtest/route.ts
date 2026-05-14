// Engine v1 backtest endpoint.
//
// Runs the live polling engine against historical bars from `historical_bars`
// and returns the same BacktestMetrics shape as the existing /backtest route.
// Synchronous (in-memory) so the user gets immediate feedback on whether
// their engine_config + multi_tf weights produce a viable equity curve.
//
// Body: { symbol?: string, from?: ISO, to?: ISO, starting_equity?: number,
//         sl_atr_mult?: number, tp_atr_mult?: number }
// Defaults: symbol = algorithm.instrument[0], range = last 90 days.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { runEngineV1FullValidation } from "@/lib/engine/v1/backtest";
import { extractMultiTf } from "@/lib/engine/v1/index";
import { evaluateEngineGates } from "@/lib/engine/v1/quality-gates";
import { logError } from "@/lib/log";
import type { EngineConfig } from "@/lib/validations/engine-config";
import type { Timeframe } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  symbol:                  z.string().min(1).max(20).optional(),
  from:                    z.string().datetime().optional(),
  to:                      z.string().datetime().optional(),
  starting_equity:         z.number().positive().optional(),
  sl_atr_mult:             z.number().positive().optional(),
  tp_atr_mult:             z.number().positive().optional(),
  monte_carlo_iterations:  z.number().int().min(0).max(5000).optional(),
  walk_forward_windows:    z.number().int().min(0).max(12).optional(),
});

const VALID_TFS: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];

function asTimeframe(tf: string): Timeframe | null {
  return (VALID_TFS as string[]).includes(tf) ? (tf as Timeframe) : null;
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown = {};
    try { body = await request.json(); } catch { /* allow empty */ }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, name, status, engine_config, parameters, instrument, lot_size")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (algoErr || !algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    const instruments = Array.isArray(algo.instrument)
      ? (algo.instrument as string[])
      : algo.instrument ? [algo.instrument as string] : [];
    const symbol = parsed.data.symbol ?? instruments[0];
    if (!symbol) return NextResponse.json({ error: "No symbol available" }, { status: 400 });

    const to = parsed.data.to ?? new Date().toISOString();
    const from = parsed.data.from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const mtf = extractMultiTf((algo.parameters as Record<string, unknown> | null) ?? null);
    const tfs = mtf.timeframes.map((t) => t.tf).filter((tf) => asTimeframe(tf) !== null);

    // Load bars for every TF in parallel.
    const tfBars = await Promise.all(
      tfs.map(async (tf) => {
        const bars = await loadHistoricalBars(supabase, symbol, tf as Timeframe, from, to);
        return { tf, bars };
      }),
    );

    const full = await runEngineV1FullValidation(
      {
        id: algo.id as string,
        lot_size: algo.lot_size as number | null,
        engine_config: algo.engine_config as EngineConfig | null,
        parameters: (algo.parameters as Record<string, unknown> | null) ?? null,
      },
      symbol,
      tfBars,
      {
        startingEquity: parsed.data.starting_equity,
        slAtrMult: parsed.data.sl_atr_mult,
        tpAtrMult: parsed.data.tp_atr_mult,
        monteCarloIterations: parsed.data.monte_carlo_iterations,
        walkForwardWindows: parsed.data.walk_forward_windows,
      },
    );

    // Persist the run — best-effort, never blocks the response.
    const { data: runRow } = await supabase
      .from("engine_backtest_runs")
      .insert({
        user_id:      user.id,
        algorithm_id: algo.id,
        symbol,
        range_from:   from,
        range_to:     to,
        params: {
          starting_equity:        parsed.data.starting_equity ?? null,
          sl_atr_mult:            parsed.data.sl_atr_mult ?? null,
          tp_atr_mult:            parsed.data.tp_atr_mult ?? null,
          monte_carlo_iterations: parsed.data.monte_carlo_iterations ?? 0,
          walk_forward_windows:   parsed.data.walk_forward_windows ?? 0,
        },
        bars_loaded:      tfBars.map((e) => ({ tf: e.tf, count: e.bars.length })),
        baseline_metrics: full.baseline.metrics,
        equity_curve:     full.baseline.equityCurve,
        final_balance:    full.baseline.finalBalance,
        total_trades:     full.baseline.metrics.totalTrades,
        duration_ms:      full.baseline.durationMs,
        monte_carlo:      full.monteCarlo,
        walk_forward:     full.walkForward,
      })
      .select("id, created_at")
      .maybeSingle();

    // Quality gates — auto-promote a draft strategy to paper once its engine
    // backtest clears every "must" gate. Only draft → paper; later lifecycle
    // transitions (paper → approved → live) stay manual / gated separately.
    const gates = evaluateEngineGates(full.baseline.metrics);
    let promoted = false;
    if (gates.eligibleForPaper && algo.status === "draft") {
      const { error: promoteErr } = await supabase
        .from("algorithms")
        .update({ status: "paper" })
        .eq("id", algo.id)
        .eq("user_id", user.id)
        .eq("status", "draft");
      if (!promoteErr) promoted = true;
      else logError("EngineBacktest", { component: "auto-promote", message: promoteErr.message });
    }

    return NextResponse.json({
      algorithm: {
        id: algo.id,
        name: algo.name,
        status: promoted ? "paper" : algo.status,
      },
      symbol,
      from,
      to,
      bars_loaded: tfBars.map((e) => ({ tf: e.tf, count: e.bars.length })),
      result: full.baseline,
      monte_carlo: full.monteCarlo,
      walk_forward: full.walkForward,
      gates,
      promoted,
      run_id:     runRow?.id ?? null,
      created_at: runRow?.created_at ?? null,
    }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("EngineBacktest", { component: "POST /api/algorithms/[id]/engine-backtest", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
