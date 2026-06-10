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
import { runAdvancedPipeline, type AdvancedPipeline } from "@/lib/backtest/orchestrator";
import { runPortfolio, type PortfolioLeg } from "@/lib/backtest/portfolio";
import { buildBiasCache, multiTfBlocks, summarizeAlignment } from "@/lib/backtest/multi-tf-filter";
import { loadHistoricalBars as loadBarsForTf } from "@/lib/backtest/bars-loader";
import { buildKellyInputs, mergeKellyInputs } from "@/lib/engine/position-sizing/auto-populate";
import { logError, logInfo, logWarn } from "@/lib/log";
import type { EngineConfig } from "@/lib/validations/engine-config";
import type { Timeframe, SimulatedTrade, BacktestConfig, Bar } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

const VALID_HIGHER_TFS = ["M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as const;

// ── Anti-timeout guards (sync flow runs in-request, not in a worker) ─────────
// The async flow (/api/backtest/jobs) can afford unbounded multi-symbol /
// multi-TF loads because it runs detached. Here we are inside the HTTP request
// with maxDuration=120s, so we cap the fan-out:
//   - MAX_PORTFOLIO_LEGS: hard ceiling on legs (each leg = 1 bar load + 1
//     full baseline sim). 10 legs × ~90d M15 is the worst case we accept.
//   - MAX_MULTI_TF: at most 3 higher TFs (also enforced by the Zod schema).
//   - MIN_TF_BARS: a higher TF with fewer than this many bars is too sparse to
//     yield a meaningful EMA50 bias — we skip it instead of polluting the cache.
// If a block exceeds its budget or loads nothing usable we surface it as
// `status: 'failed'` with a clear reason rather than hanging the request.
const MAX_PORTFOLIO_LEGS = 10;
const MAX_MULTI_TF = 3;
const MIN_TF_BARS = 50;

const bodySchema = z.object({
  symbol:                  z.string().min(1).max(20).optional(),
  from:                    z.string().datetime().optional(),
  to:                      z.string().datetime().optional(),
  starting_equity:         z.number().positive().optional(),
  sl_atr_mult:             z.number().positive().optional(),
  tp_atr_mult:             z.number().positive().optional(),
  monte_carlo_iterations:  z.number().int().min(0).max(5000).optional(),
  walk_forward_windows:    z.number().int().min(0).max(12).optional(),
  // Advanced opt-in pipeline (Plan v2 — Bloque C). All three flags are now
  // honored by the sync flow:
  //   - use_ml: trains a logreg signal model over the primary TF bars.
  //   - use_multi_tf: loads higher-TF bars, builds an EMA50 bias cache and
  //     reports how many baseline trades contradict the higher TF (would be
  //     vetoed) + a bull/bear/neutral alignment summary.
  //   - use_portfolio: runs a multi-symbol portfolio backtest over `legs`,
  //     cloning the cfg per leg with initialBalance × normalized weight.
  // Anti-timeout guards apply (see MAX_* constants above) because this path
  // runs in-request rather than in the async worker.
  use_ml:                  z.boolean().optional(),
  ml_horizon:              z.number().int().min(1).max(50).optional(),
  ml_threshold:            z.number().min(0).max(0.1).optional(),
  use_multi_tf:            z.boolean().optional(),
  multi_tf_higher:         z.array(z.enum(VALID_HIGHER_TFS)).min(1).max(MAX_MULTI_TF).optional(),
  use_portfolio:           z.boolean().optional(),
  legs:                    z.array(z.object({
    configId: z.string().min(1).max(40),
    symbol:   z.string().min(1).max(20),
    weight:   z.number().positive(),
  })).min(2).max(MAX_PORTFOLIO_LEGS).optional(),
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

    // Advanced opt-in pipeline (Plan v2 — Bloque C). The sync flow now honors
    // all three flags (use_ml + use_multi_tf + use_portfolio), mirroring the
    // async worker (src/lib/backtest/run-job.ts). The orchestrator's pure
    // runAdvancedPipeline still surfaces multi-TF + portfolio as 'pending'
    // because both need real bars (multi-TF) or a SupabaseClient (portfolio);
    // we hydrate them below and upgrade the blocks to 'completed'/'failed'.
    // Anti-timeout guards (MAX_* constants) keep the in-request fan-out bounded.
    const useMultiTf  = parsed.data.use_multi_tf === true;
    const usePortfolio = parsed.data.use_portfolio === true;
    const useAdvanced = parsed.data.use_ml === true || useMultiTf || usePortfolio;

    // Resolve the primary-TF series once — it's the bias-cache target for
    // multi-TF reporting and the ML training set.
    const primaryEntry =
      tfBars.find((e) => e.tf === "M15") ??
      tfBars.find((e) => e.tf === "H1") ??
      tfBars[0];
    const primaryBars = (primaryEntry?.bars ?? []) as Bar[];

    let advancedOutput: ReturnType<typeof runAdvancedPipeline> = { advanced: null, warnings: [] };
    if (useAdvanced) {
      if (parsed.data.use_ml === true && primaryBars.length < 50) {
        logWarn("EngineBacktest", "Advanced ML skipped — primary bars < 50", {
          component: "POST /api/algorithms/[id]/engine-backtest",
          meta: { primary_tf: primaryEntry?.tf ?? null, bars: primaryBars.length },
        });
      }
      // Default higher TFs for multi-TF reporting (capped at MAX_MULTI_TF). The
      // client may override via `multi_tf_higher`; otherwise we pick H4 + D1.
      const requestedHigherTfs = (parsed.data.multi_tf_higher ?? ["H4", "D1"]).slice(0, MAX_MULTI_TF);
      const advancedCfg: BacktestConfig = {
        // BacktestConfig requires several Engine-v1-irrelevant fields. Only
        // useMl/mlParams + useMultiTf/multiTfParams + usePortfolio/portfolioLegs
        // are actually read by runAdvancedPipeline; the rest are placeholders
        // for the type system.
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
        useMl:            parsed.data.use_ml === true,
        mlParams: {
          horizon:   parsed.data.ml_horizon ?? 10,
          threshold: parsed.data.ml_threshold ?? 0.001,
        },
        useMultiTf:       useMultiTf,
        multiTfParams:    useMultiTf ? { higherTimeframes: requestedHigherTfs as Timeframe[] } : undefined,
        usePortfolio:     usePortfolio,
        portfolioLegs:    usePortfolio ? parsed.data.legs : undefined,
      };
      advancedOutput = runAdvancedPipeline(primaryBars, advancedCfg);

      // ── Multi-TF hydration ───────────────────────────────────────────────
      // runAdvancedPipeline left the block as { status: 'pending' }. Mirror
      // run-job.ts: load higher-TF bars in parallel (skip TFs with < MIN_TF_BARS
      // bars), build an EMA50 bias cache and report how many baseline trades
      // contradict the higher TF (would be vetoed) + a bull/bear/neutral
      // alignment summary. Failures stay isolated → 'failed' with a reason.
      if (advancedOutput.advanced && advancedOutput.advanced.multiTf?.status === "pending") {
        const higherTimeframes = advancedOutput.advanced.multiTf.higherTimeframes;
        // Anti-timeout guard: validate every requested TF resolves to a real
        // Timeframe and that we don't exceed MAX_MULTI_TF (Zod already caps the
        // override at MAX_MULTI_TF, but the H4/D1 default is also covered).
        const validHigher = higherTimeframes
          .map((tf) => asTimeframe(tf))
          .filter((tf): tf is Timeframe => tf !== null)
          .slice(0, MAX_MULTI_TF);
        try {
          const loaded = await Promise.all(
            validHigher.map(async (tf) => {
              const hb = await loadBarsForTf(supabase, symbol, tf, from, to);
              return [tf, hb] as const;
            }),
          );
          const map = new Map<string, Bar[]>();
          const skipped: string[] = [];
          for (const [tf, hb] of loaded) {
            if (hb.length >= MIN_TF_BARS) map.set(tf, hb as Bar[]);
            else skipped.push(`${tf}(${hb.length}b)`);
          }
          if (map.size === 0) {
            advancedOutput.advanced.multiTf = {
              used: true, status: "failed", higherTimeframes,
              reason: `no higher-TF bars loaded (skipped: ${skipped.join(", ") || "all empty"})`,
            };
          } else {
            // Build the bias cache and tally how many baseline trades would be
            // vetoed because they contradict any higher TF at entry time.
            const cache = buildBiasCache(map);
            const baselineTrades = full.baseline.trades;
            let tradesFilteredCount = 0;
            for (const t of baselineTrades) {
              if (multiTfBlocks(t.side, t.entryTs, cache)) tradesFilteredCount++;
            }
            const alignment = summarizeAlignment(primaryBars, cache);
            advancedOutput.advanced.multiTf = {
              used: true, status: "completed", higherTimeframes,
              tradesFilteredCount, alignment,
            };
            if (skipped.length > 0) {
              logWarn("EngineBacktest", `Multi-TF skipped sparse TFs: ${skipped.join(", ")}`, {
                component: "POST /api/algorithms/[id]/engine-backtest", meta: { algorithm_id: id },
              });
            }
          }
        } catch (mtfErr) {
          const msg = mtfErr instanceof Error ? mtfErr.message : String(mtfErr);
          advancedOutput.advanced.multiTf = {
            used: true, status: "failed", higherTimeframes, reason: msg.slice(0, 200),
          };
          advancedOutput.warnings.push(`multi_tf: ${msg}`);
          logWarn("EngineBacktest", `Multi-TF bar load failed: ${msg}`, {
            component: "POST /api/algorithms/[id]/engine-backtest", meta: { algorithm_id: id },
          });
        }
      }

      // ── Portfolio hydration ──────────────────────────────────────────────
      // runAdvancedPipeline left the block as { status: 'pending' }. Mirror
      // run-job.ts: clone cfg per leg substituting `symbol` and scaling
      // `initialBalance` by the leg's weight, then runPortfolio. Anti-timeout
      // guard: legs are capped at MAX_PORTFOLIO_LEGS (the Zod schema already
      // enforces 2..MAX_PORTFOLIO_LEGS, but we re-slice defensively). Each leg
      // is one bar load + one full baseline sim, so the ceiling bounds the
      // worst-case in-request work.
      if (advancedOutput.advanced && advancedOutput.advanced.portfolio?.status === "pending") {
        const legsInput = (parsed.data.legs ?? []).slice(0, MAX_PORTFOLIO_LEGS);
        if (legsInput.length >= 2) {
          try {
            const legs: PortfolioLeg[] = legsInput.map((leg) => ({
              configId: leg.configId,
              symbol:   leg.symbol,
              weight:   leg.weight,
              cfg: {
                ...advancedCfg,
                symbol:         leg.symbol,
                initialBalance: advancedCfg.initialBalance * leg.weight,
                // Portfolio legs run the generic engine (runBacktest) per leg —
                // strip the advanced flags so legs don't recurse into ML/multi-TF.
                useMl:        false,
                useMultiTf:   false,
                usePortfolio: false,
              },
            }));
            const portfolio = await runPortfolio(supabase, legs);
            advancedOutput.advanced.portfolio = {
              used: true, status: "completed", legCount: legs.length,
              metrics: portfolio.metrics,
              equityPreviewLast50: portfolio.portfolioEquity.slice(-50),
            };
            logInfo("EngineBacktest", "portfolio completed (sync)", {
              component: "POST /api/algorithms/[id]/engine-backtest",
              meta: { algorithm_id: id, legCount: legs.length, sharpe: portfolio.metrics.sharpe },
            });
          } catch (portErr) {
            const portMsg = portErr instanceof Error ? portErr.message : String(portErr);
            advancedOutput.advanced.portfolio = {
              used: true, status: "failed", reason: portMsg.slice(0, 200),
            };
            advancedOutput.warnings.push(`portfolio: ${portMsg}`);
            logWarn("EngineBacktest", "portfolio failed (sync)", {
              component: "POST /api/algorithms/[id]/engine-backtest",
              meta: { algorithm_id: id, message: portMsg },
            });
          }
        } else {
          advancedOutput.advanced.portfolio = {
            used: true, status: "failed",
            reason: `legs requires at least 2 entries; got ${legsInput.length}`,
          };
        }
      }
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
          // multi_tf + portfolio are now honored at runtime (see the advanced
          // hydration above). We still persist the raw requested booleans for
          // forensic queries ("did the client enable portfolio in sync, and
          // did the block complete or fail?" — pair with `advanced` below).
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
