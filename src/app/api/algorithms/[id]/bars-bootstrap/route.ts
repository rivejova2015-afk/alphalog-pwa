// Bars bootstrap — forces a Yahoo round-trip for every (symbol × engine TF)
// the algorithm needs, so the first backtest run isn't slow or starved for
// data. The bars-ingest cron keeps things fresh after the fact; this is the
// one-shot "populate now" trigger the user can fire from the validator panel.
//
// loadHistoricalBars already does the local → Yahoo fallback + upsert into
// historical_bars, so this endpoint is mostly a parallel loop with the
// per-TF lookbacks tuned for the Base Engine v1 SMC funnel.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { logError, logInfo } from "@/lib/log";
import type { Timeframe } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

// Per-TF lookback sized for the funnel. D1 needs only a few bars but a wider
// window also gives session-structure context for H1 swings derived from D1
// dailies later; intraday TFs respect Yahoo's caps (1m: ~7d, 5m/15m/60m: ~60d).
const TF_LOOKBACK_DAYS: { tf: Timeframe; days: number }[] = [
  { tf: "D1",  days: 365 },
  { tf: "H1",  days: 90 },
  { tf: "M15", days: 30 },
  { tf: "M1",  days: 6 },
];

export async function POST(_req: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, name, instrument")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (algoErr || !algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    const instruments = Array.isArray(algo.instrument)
      ? (algo.instrument as string[])
      : algo.instrument ? [algo.instrument as string] : [];
    if (instruments.length === 0) {
      return NextResponse.json({ error: "Algorithm has no instruments" }, { status: 400 });
    }

    const now = Date.now();
    const startedAt = now;
    const summary: { symbol: string; tf: Timeframe; bars: number; days: number; error?: string }[] = [];

    // Sequential per (symbol × tf) — keeps it inside Yahoo's per-IP rate
    // budget and surfaces failures one at a time in the response.
    for (const symbol of instruments) {
      for (const { tf, days } of TF_LOOKBACK_DAYS) {
        const to = new Date(now).toISOString();
        const from = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
        try {
          const bars = await loadHistoricalBars(supabase, symbol, tf, from, to);
          summary.push({ symbol, tf, days, bars: bars.length });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          summary.push({ symbol, tf, days, bars: 0, error: msg });
        }
      }
    }

    const totalBars = summary.reduce((s, x) => s + x.bars, 0);
    const errors = summary.filter((x) => x.error).length;
    const durationMs = Date.now() - startedAt;

    logInfo("BarsBootstrap", `algo ${id}: ${instruments.length} symbols × ${TF_LOOKBACK_DAYS.length} TFs → ${totalBars} bars in ${durationMs}ms (${errors} errors)`, {
      component: "POST /api/algorithms/[id]/bars-bootstrap",
    });

    return NextResponse.json({
      ok: true,
      algorithm: { id: algo.id, name: algo.name },
      symbols: instruments,
      timeframes: TF_LOOKBACK_DAYS.map((t) => t.tf),
      total_bars: totalBars,
      errors,
      duration_ms: durationMs,
      summary,
    }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("BarsBootstrap", { component: "POST", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
