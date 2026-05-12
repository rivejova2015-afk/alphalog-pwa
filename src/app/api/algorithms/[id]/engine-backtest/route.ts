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
import { simulateEngineV1FromBars } from "@/lib/engine/v1/backtest";
import { extractMultiTf } from "@/lib/engine/v1/index";
import { logError } from "@/lib/log";
import type { EngineConfig } from "@/lib/validations/engine-config";
import type { Timeframe } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  symbol:           z.string().min(1).max(20).optional(),
  from:             z.string().datetime().optional(),
  to:               z.string().datetime().optional(),
  starting_equity:  z.number().positive().optional(),
  sl_atr_mult:      z.number().positive().optional(),
  tp_atr_mult:      z.number().positive().optional(),
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

    const result = await simulateEngineV1FromBars(
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
      },
    );

    return NextResponse.json({
      algorithm: { id: algo.id, name: algo.name, status: algo.status },
      symbol,
      from,
      to,
      bars_loaded: tfBars.map((e) => ({ tf: e.tf, count: e.bars.length })),
      result,
    }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("EngineBacktest", { component: "POST /api/algorithms/[id]/engine-backtest", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
