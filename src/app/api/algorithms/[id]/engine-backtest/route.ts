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

    // Advanced opt-in pipeline (Plan v2 — Bloque C). Sync flow honors only
    // `use_ml`. `use_multi_tf` and `use_portfolio` are accepted for
    // backwards-compat (older clients may still send them) but ignored at
    // runtime — a warn fires when they arrive as true so the regression is
    // observable. The async flow (/api/backtest/jobs) is the only path that
    // wires multi-TF + portfolio with real bars + Supabase.
    if (parsed.data.use_multi_tf === true) {
      logWarn("EngineBacktest", "use_multi_tf ignored in sync flow — Engine v1 already runs SMC funnel multi-TF natively", {
        component: "POST /api/algorithms/[id]/engine-backtest",
        meta: { algorithm_id: id },
      });
    }
    if (parsed.data.use_portfolio === true) {
      logWarn("EngineBacktest", "use_portfolio ignored in sync flow — portfolio backtest requires the async pipeline (/api/backtest/jobs)", {
        component: "POST /api/algorithms/[id]/engine-backtest",
        meta: { algorithm_id: id },
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
        // BacktestConfig requires several Engine-v1-irrelevant fields. Only
        // useMl + mlParams are actually read by runAdvancedPipeline in sync;
        // the rest are placeholders for the type system.
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
        // Multi-TF + portfolio are hardcoded off in the sync path — see the
        // warn logs above.
        useMultiTf:       false,
        usePortfolio:     false,
      };
      advancedOutput = runAdvancedPipeline(primaryBars, advancedCfg);
    }

    // Options overlay: when the algorithm is market_type='options', augment
    // each trade with theoretical Black-Scholes P&L on an ATM contract.
    // Underlying-level entry/exit is what the engine evaluates; the contract
    // P&L is just a teórico-aproximado layer (IV constant, expiry fixed).
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
        return {
          ...t,
          theoretical_pnl: theo.pnl_per_contract,
          strike:          theo.strike,
          type:            theo.type,
        };
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
          use_ml:                 parsed.data.use_ml === true,
          // multi_tf + portfolio are recorded as received (raw boolean) but
          // not honored — see warn logs above. Useful for forensic queries
          // ("did the client try to enable portfolio in sync?").
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

    // Sprint N — auto-populate Kelly inputs into algorithms.parameters when the
    // sample is statistically meaningful (≥30 trades, positive edge). User can
    // then opt-in by setting kelly_enabled=true; no manual transcription of
    // win_rate / avg_win / avg_loss needed.
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

    return NextResponse.json({
      algorithm: {
        id: algo.id,
        name: algo.name,
        market_type: algo.market_type,
        status: promoted ? "paper" : algo.status,
      },
      symbol,
      from,
      to,
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
    }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("EngineBacktest", { component: "POST /api/algorithms/[id]/engine-backtest", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
