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
import { theoreticalOptionPnl } from "@/lib/backtest/options-overlay";
import { runAdvancedPipeline } from "@/lib/backtest/orchestrator";
import { buildKellyInputs, mergeKellyInputs } from "@/lib/engine/position-sizing/auto-populate";
import { logError, logInfo, logWarn } from "@/lib/log";
import type { EngineConfig } from "@/lib/validations/engine-config";
import type { Timeframe, SimulatedTrade, BacktestConfig, Bar } from "@/types/backtest";
import type { EngineV1ProgressEvent } from "@/lib/engine/v1/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

const VALID_HIGHER_TFS = ["M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as const;

const bodySchema = z.object({
  symbol:                  z.string().min(1).max(20).optional(),
  from:                    z.string().datetime().optional(),
  to:                      z.string().datetime().optional(),
  starting_equity:         z.number().positive().optional(),
  sl_atr_mult:             z.number().positive().optional(),
  tp_atr_mult:             z.number().positive().optional(),
  monte_carlo_iterations:  z.number().int().min(0).max(5000).optional(),
  walk_forward_windows:    z.number().int().min(0).max(12).optional(),
  // Advanced opt-in pipeline (Plan v2 — Bloque C). Only `use_ml` is honored
  // by the sync flow. Engine v1 already evaluates the SMC funnel
  // (D1→H1→M15→M1) so a higher-TF filter would be redundant, and the
  // portfolio backtest needs the SupabaseClient + per-leg editor that only
  // live in the async flow (/api/backtest/jobs). `use_multi_tf` and
  // `use_portfolio` stay in the schema for backwards-compat with older
  // clients but are ignored at runtime — a warn log fires if they arrive
  // as true so the regression is observable.
  use_ml:                  z.boolean().optional(),
  ml_horizon:              z.number().int().min(1).max(50).optional(),
  ml_threshold:            z.number().min(0).max(0.1).optional(),
  use_multi_tf:            z.boolean().optional(),  // deprecated in sync flow
  multi_tf_higher:         z.array(z.enum(VALID_HIGHER_TFS)).min(1).max(3).optional(),
  use_portfolio:           z.boolean().optional(),  // deprecated in sync flow
});

const VALID_TFS: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];

function asTimeframe(tf: string): Timeframe | null {
  return (VALID_TFS as string[]).includes(tf) ? (tf as Timeframe) : null;
}

/**
 * Run the validation pipeline and return the final JSON payload. Extracted
 * into a helper so the JSON path and the SSE path share the exact same logic
 * (persistence, gates, kelly population) without duplication.
 *
 * `emit` is called on each phase transition. When the route is called without
 * `?stream=true`, `emit` is a no-op and behaviour is identical to before.
 */
async function runValidation(
  ctx: {
    user: { id: string };
    algo: Record<string, unknown> & {
      id: string; name: string; status: string; market_type?: string | null;
      engine_config?: unknown; parameters?: unknown; instrument?: unknown;
      lot_size?: number | null;
    };
    symbol: string;
    from: string;
    to: string;
    tfBars: { tf: string; bars: Bar[] }[];
    parsed: ReturnType<typeof bodySchema.safeParse> & { success: true };
    supabase: Awaited<ReturnType<typeof createClient>>;
    routeId: string;
  },
  emit: (ev: EngineV1ProgressEvent) => void | Promise<void>,
) {
  const { user, algo, symbol, from, to, tfBars, parsed, supabase, routeId } = ctx;

  const full = await runEngineV1FullValidation(
    {
      id: algo.id,
      lot_size: (algo.lot_size as number | null) ?? null,
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
      onPhaseProgress: emit,
    },
  );

  if (parsed.data.use_multi_tf === true) {
    logWarn("EngineBacktest", "use_multi_tf ignored in sync flow — Engine v1 already runs SMC funnel multi-TF natively", {
      component: "POST /api/algorithms/[id]/engine-backtest",
      meta: { algorithm_id: routeId },
    });
  }
  if (parsed.data.use_portfolio === true) {
    logWarn("EngineBacktest", "use_portfolio ignored in sync flow — portfolio backtest requires the async pipeline (/api/backtest/jobs)", {
      component: "POST /api/algorithms/[id]/engine-backtest",
      meta: { algorithm_id: routeId },
    });
  }

  const useAdvanced = parsed.data.use_ml === true;
  let advancedOutput: ReturnType<typeof runAdvancedPipeline> = { advanced: null, warnings: [] };
  if (useAdvanced) {
    const primaryEntry =
      tfBars.find((e) => e.tf === "M15") ??
      tfBars.find((e) => e.tf === "H1") ??
      tfBars[0];
    const primaryBars = (primaryEntry?.bars ?? []) as Bar[];
    if (primaryBars.length < 50) {
      logWarn("EngineBacktest", "Advanced ML skipped — primary bars < 50", {
        component: "POST /api/algorithms/[id]/engine-backtest",
        meta: { primary_tf: primaryEntry?.tf ?? null, bars: primaryBars.length },
      });
    }
    const advancedCfg: BacktestConfig = {
      symbol,
      timeframe:        (primaryEntry?.tf ?? "M15") as Timeframe,
      from,
      to,
      initialBalance:   parsed.data.starting_equity ?? 10000,
      contractSize:     100,
      pointValue:       1,
      spreadPoints:     0,
      commissionPerLot: 0,
      slippagePoints:   0,
      direction:        "both",
      parameters:       {},
      rules:            { entry: [], exit: [], sizing: { type: "fixed_lots", lots: 0.01 } } as unknown as BacktestConfig["rules"],
      useMl:            true,
      mlParams: {
        horizon:   parsed.data.ml_horizon ?? 10,
        threshold: parsed.data.ml_threshold ?? 0.001,
      },
      useMultiTf:       false,
      usePortfolio:     false,
    };
    advancedOutput = runAdvancedPipeline(primaryBars, advancedCfg);
  }

  let optionsOverlay: {
    total_theoretical_pnl: number;
    avg_pnl_per_contract:  number;
    iv_used:               number;
    expiry_days:           number;
    strike_offset_pct:     number;
    enriched_trades:       Array<SimulatedTrade & { theoretical_pnl: number; strike: number; type: string }>;
  } | null = null;

  if (algo.market_type === "options") {
    const params = (algo.parameters as Record<string, unknown> | null) ?? {};
    const opts = {
      iv:                Number(params.iv_assumption ?? 0.25),
      risk_free:         Number(params.risk_free_rate ?? 0.045),
      expiry_days:       Number(params.expiry_days ?? 30),
      strike_offset_pct: Number(params.strike_offset_pct ?? 0),
    };
    const enriched = full.baseline.trades.map((t) => {
      const theo = theoreticalOptionPnl({
        entry_price: t.entryPrice,
        exit_price:  t.exitPrice,
        entry_ts:    t.entryTs,
        exit_ts:     t.exitTs,
        direction:   t.side,
        opts,
      });
      return { ...t, theoretical_pnl: theo.pnl_per_contract, strike: theo.strike, type: theo.type };
    });
    const totalTheo = enriched.reduce((acc, t) => acc + t.theoretical_pnl, 0);
    optionsOverlay = {
      total_theoretical_pnl: totalTheo,
      avg_pnl_per_contract:  enriched.length > 0 ? totalTheo / enriched.length : 0,
      iv_used:               opts.iv,
      expiry_days:           opts.expiry_days,
      strike_offset_pct:     opts.strike_offset_pct,
      enriched_trades:       enriched,
    };
  }

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
        use_ml:                 parsed.data.use_ml === true,
        use_multi_tf_requested:  parsed.data.use_multi_tf === true,
        use_portfolio_requested: parsed.data.use_portfolio === true,
      },
      bars_loaded:      tfBars.map((e) => ({ tf: e.tf, count: e.bars.length })),
      baseline_metrics: optionsOverlay
        ? { ...full.baseline.metrics, options_overlay: { ...optionsOverlay, enriched_trades: undefined } }
        : full.baseline.metrics,
      equity_curve:     full.baseline.equityCurve,
      final_balance:    full.baseline.finalBalance,
      total_trades:     full.baseline.metrics.totalTrades,
      duration_ms:      full.baseline.durationMs,
      monte_carlo:      full.monteCarlo,
      walk_forward:     full.walkForward,
      advanced:         advancedOutput.advanced,
    })
    .select("id, created_at")
    .maybeSingle();

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

  let kellyPopulated = false;
  const kellyPayload = buildKellyInputs(full.baseline.metrics, {
    sourceTag: `engine_backtest:${runRow?.id ?? "unknown"}`,
    nowIso:    new Date().toISOString(),
  });
  if (kellyPayload) {
    const mergedParams = mergeKellyInputs(algo.parameters as Record<string, unknown> | null, kellyPayload);
    const { error: kellyErr } = await supabase
      .from("algorithms")
      .update({ parameters: mergedParams })
      .eq("id", algo.id)
      .eq("user_id", user.id);
    if (kellyErr) {
      logError("EngineBacktest", { component: "kelly-auto-populate", message: kellyErr.message });
    } else {
      kellyPopulated = true;
      logInfo("EngineBacktest", `Kelly inputs persisted: winRate=${kellyPayload.kelly_win_rate.toFixed(3)} avgWin=$${kellyPayload.kelly_avg_win_usd.toFixed(2)} avgLoss=$${kellyPayload.kelly_avg_loss_usd.toFixed(2)} n=${kellyPayload.kelly_inputs_sample_size}`, {
        component: "kelly-auto-populate", meta: { algoId: algo.id, runId: runRow?.id },
      });
    }
  }

  return {
    algorithm: {
      id: algo.id, name: algo.name,
      market_type: algo.market_type,
      status: promoted ? "paper" : algo.status,
    },
    symbol, from, to,
    bars_loaded: tfBars.map((e) => ({ tf: e.tf, count: e.bars.length })),
    result: full.baseline,
    options_overlay: optionsOverlay,
    monte_carlo: full.monteCarlo,
    walk_forward: full.walkForward,
    advanced:           advancedOutput.advanced,
    advanced_warnings:  advancedOutput.warnings,
    gates,
    promoted,
    kelly_populated: kellyPopulated,
    kelly_inputs:    kellyPayload,
    run_id:     runRow?.id ?? null,
    created_at: runRow?.created_at ?? null,
  };
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

    // SSE opt-in: ?stream=true switches the response to text/event-stream so
    // the UI can render phase progress instead of waiting silently. Backward
    // compat is preserved — the default JSON path is byte-identical to before.
    const url = new URL(request.url);
    const wantStream = url.searchParams.get("stream") === "true";

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, name, status, engine_config, parameters, instrument, lot_size, market_type")
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

    const ctx = {
      user, algo: algo as Parameters<typeof runValidation>[0]["algo"],
      symbol, from, to, tfBars, parsed: parsed as Parameters<typeof runValidation>[0]["parsed"],
      supabase, routeId: id,
    };

    if (!wantStream) {
      // JSON path (default, backward-compat).
      const payload = await runValidation(ctx, () => { /* no-op */ });
      return NextResponse.json(payload, { status: 200, headers: { "Cache-Control": "private, no-store" } });
    }

    // SSE path. Returns a ReadableStream that emits phase progress events as
    // the validation runs, then a final `done` event with the same payload
    // shape the JSON path would have produced. Pattern mirrors the terminal
    // chat streaming route (text/event-stream + data: ${json}\n\n).
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };
        try {
          send("meta", {
            symbol, from, to,
            bars_loaded: tfBars.map((e) => ({ tf: e.tf, count: e.bars.length })),
          });
          const payload = await runValidation(ctx, async (ev) => {
            send("progress", ev);
          });
          send("done", payload);
        } catch (err) {
          logError("EngineBacktest", { component: "SSE stream", message: String(err) });
          send("error", { message: err instanceof Error ? err.message : String(err) });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Disable nginx-like buffering so events stream as they're enqueued.
        // Fly runs behind a TCP proxy not nginx, but the header is harmless.
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    logError("EngineBacktest", { component: "POST /api/algorithms/[id]/engine-backtest", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
