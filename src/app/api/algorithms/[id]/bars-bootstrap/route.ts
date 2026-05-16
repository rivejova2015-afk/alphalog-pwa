// Bars bootstrap — forces a data fetch for every (symbol × engine TF) the
// algorithm needs, walking the per-symbol source chain from the registry so
// we never blindly hit Yahoo for symbols Yahoo doesn't support.
//
// Response shape includes structured diagnostics (`symbol_status`) so the UI
// can render exactly which sources worked, which failed, and what to do next
// when a symbol has zero bars available via any API source.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadHistoricalBarsDetailed } from "@/lib/backtest/bars-loader";
import { resolveSymbol, hasApiCoverage, nextStepsForEmpty } from "@/lib/backtest/source-registry";
import { logError, logInfo } from "@/lib/log";
import type { Timeframe } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

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

    const startedAt = Date.now();

    interface SummaryRow {
      symbol: string;
      tf: Timeframe;
      bars: number;
      days: number;
      from_ts: string | null;
      to_ts: string | null;
      effective_source: string | null;
      attempts: Array<{ source: string; ok: boolean; bars: number; message?: string }>;
      error?: string;
    }
    const summary: SummaryRow[] = [];

    // Per-symbol aggregated diagnostics. Built incrementally as we walk TFs.
    const symbolStatus: Record<string, {
      assetClass: string;
      apiCoverage: boolean;
      totalBars: number;
      barsByTf: Record<string, number>;
      sourcesUsed: string[];
      hasAnyData: boolean;
      nextSteps: string[];
      notes?: string;
    }> = {};

    for (const symbol of instruments) {
      const entry = resolveSymbol(symbol);
      symbolStatus[symbol] = {
        assetClass: entry.assetClass,
        apiCoverage: TF_LOOKBACK_DAYS.some((t) => hasApiCoverage(symbol, t.tf)),
        totalBars: 0,
        barsByTf: {},
        sourcesUsed: [],
        hasAnyData: false,
        nextSteps: [],
        notes: entry.notes,
      };

      for (const { tf, days } of TF_LOOKBACK_DAYS) {
        const now = Date.now();
        const to = new Date(now).toISOString();
        const from = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
        try {
          const result = await loadHistoricalBarsDetailed(supabase, symbol, tf, from, to);
          summary.push({
            symbol,
            tf,
            days,
            bars: result.bars.length,
            from_ts: result.bars.length > 0 ? result.bars[0].ts : null,
            to_ts: result.bars.length > 0 ? result.bars[result.bars.length - 1].ts : null,
            effective_source: result.effectiveSource,
            attempts: result.attempts.map((a) => ({ source: a.source, ok: a.ok, bars: a.bars, message: a.message })),
          });

          symbolStatus[symbol].totalBars += result.bars.length;
          symbolStatus[symbol].barsByTf[tf] = result.bars.length;
          if (result.effectiveSource && result.effectiveSource !== "local") {
            if (!symbolStatus[symbol].sourcesUsed.includes(result.effectiveSource)) {
              symbolStatus[symbol].sourcesUsed.push(result.effectiveSource);
            }
          }
          if (result.bars.length > 0) symbolStatus[symbol].hasAnyData = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          summary.push({
            symbol, tf, days,
            bars: 0, from_ts: null, to_ts: null,
            effective_source: null,
            attempts: [],
            error: msg,
          });
          symbolStatus[symbol].barsByTf[tf] = 0;
        }
      }

      // If any TF for this symbol still has zero bars, surface next steps.
      const zeroTfs = TF_LOOKBACK_DAYS.filter((t) => (symbolStatus[symbol].barsByTf[t.tf] ?? 0) === 0);
      if (zeroTfs.length > 0) {
        // Use the worst-case TF's suggestions (M1 typically has fewest sources).
        const worstTf = zeroTfs[zeroTfs.length - 1].tf;
        symbolStatus[symbol].nextSteps = nextStepsForEmpty(symbol, worstTf);
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
      symbol_status: symbolStatus,
    }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("BarsBootstrap", { component: "POST", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
