// Auto-tune SL/TP ATR grid (Mejora #6).
//
// Sweeps a (slAtrMult × tpAtrMult) grid of engine v1 backtests and streams
// per-trial results via SSE. Ranks by Sharpe (tie-break on totalPnl).
//
// Body: { symbol?, from?, to?, starting_equity?, sl_range?, tp_range? }
// Always returns text/event-stream — no JSON fallback path. The sweep takes
// ~30s for the default 29-combo grid, so streaming is the only reasonable
// UX. The hook (useAutoTuneStream) fetches with method=POST + parses the
// stream client-side.

import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { extractMultiTf } from "@/lib/engine/v1/index";
import { runAutoTune, DEFAULT_SL_RANGE, DEFAULT_TP_RANGE } from "@/lib/engine/v1/auto-tune";
import { logError, logInfo } from "@/lib/log";
import type { Timeframe, Bar } from "@/types/backtest";
import type { EngineConfig } from "@/lib/validations/engine-config";
import type { EvaluatorAlgorithm } from "@/lib/engine/v1/evaluator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  symbol:          z.string().min(1).max(20).optional(),
  from:            z.string().datetime().optional(),
  to:              z.string().datetime().optional(),
  starting_equity: z.number().positive().optional(),
  sl_range:        z.array(z.number().positive()).min(1).max(20).optional(),
  tp_range:        z.array(z.number().positive()).min(1).max(20).optional(),
  skip_degenerate: z.boolean().optional(),
});

const VALID_TFS: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];
function asTimeframe(tf: string): Timeframe | null {
  return (VALID_TFS as string[]).includes(tf) ? (tf as Timeframe) : null;
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  let rawBody: unknown = {};
  try { rawBody = await request.json(); } catch { /* allow empty */ }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Validation failed", issues: parsed.error.issues }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { data: algo, error: algoErr } = await supabase
    .from("algorithms")
    .select("id, name, engine_config, parameters, instrument, lot_size")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (algoErr || !algo) {
    return new Response(JSON.stringify({ error: "Algorithm not found" }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  }

  const instruments = Array.isArray(algo.instrument)
    ? (algo.instrument as string[])
    : algo.instrument ? [algo.instrument as string] : [];
  const symbol = parsed.data.symbol ?? instruments[0];
  if (!symbol) {
    return new Response(JSON.stringify({ error: "No symbol available" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const to = parsed.data.to ?? new Date().toISOString();
  const from = parsed.data.from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const startingEquity = parsed.data.starting_equity ?? 10_000;

  const mtf = extractMultiTf((algo.parameters as Record<string, unknown> | null) ?? null);
  const tfs = mtf.timeframes.map((t) => t.tf).filter((tf) => asTimeframe(tf) !== null);

  // Load bars once for every TF — reused across every trial in the grid.
  // This is the single biggest perf win: the network/DB cost is paid here,
  // not 29 times.
  const tfBars = await Promise.all(
    tfs.map(async (tf) => {
      const bars = await loadHistoricalBars(supabase, symbol, tf as Timeframe, from, to);
      return { tf, bars };
    }),
  );
  const barsByTf = new Map<string, Bar[]>(tfBars.map((e) => [e.tf, e.bars]));

  // SSE stream. Same wire format as /engine-backtest:
  // event: <name>\ndata: <json>\n\n
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        const slRange = parsed.data.sl_range ?? Array.from(DEFAULT_SL_RANGE);
        const tpRange = parsed.data.tp_range ?? Array.from(DEFAULT_TP_RANGE);
        const skipDegenerate = parsed.data.skip_degenerate !== false;

        send("meta", {
          symbol, from, to,
          sl_range: slRange,
          tp_range: tpRange,
          skip_degenerate: skipDegenerate,
          bars_loaded: tfBars.map((e) => ({ tf: e.tf, count: e.bars.length })),
        });

        const algoConfig: EvaluatorAlgorithm = {
          id: algo.id,
          lot_size: (algo.lot_size as number | null) ?? null,
          engine_config: algo.engine_config as EngineConfig | null,
          parameters: (algo.parameters as Record<string, unknown> | null) ?? null,
        };

        const result = await runAutoTune({
          baseCfg: {
            symbol,
            algorithm: algoConfig,
            barsByTf,
            startingEquity,
          },
          slRange,
          tpRange,
          skipDegenerate,
          onTrial: (trial) => {
            send("trial", trial);
          },
        });

        send("done", {
          best: result.best,
          trials: result.trials,
          algorithm: { id: algo.id, name: algo.name },
        });

        logInfo("AutoTune", `algo ${id}: ${result.trials.length} trials, best Sharpe ${result.best.sharpe.toFixed(2)} @ SL=${result.best.slAtrMult} TP=${result.best.tpAtrMult}`, {
          component: "POST /api/algorithms/[id]/engine-backtest/auto-tune",
        });
      } catch (err) {
        logError("AutoTune", { component: "SSE stream", message: String(err) });
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
      "X-Accel-Buffering": "no",
    },
  });
}
