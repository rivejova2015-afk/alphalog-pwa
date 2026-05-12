// Phase B — historical bar feed cron.
// Walks all running/live algorithms, expands their `instrument[]` to the symbol
// set we care about, and calls loadHistoricalBars on each (symbol × timeframe)
// pair. loadHistoricalBars already falls back to Yahoo and upserts into
// historical_bars, so this cron just exercises the lazy-fetch path on a
// schedule so engine queries always have fresh data ready.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { logError, logInfo } from "@/lib/log";
import type { Timeframe } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Timeframes the engine cares about. Multi-TF Base Engine v1 uses D1/H4/H1/M15.
// Yahoo intraday only goes back ~60d on M5/M15, so we focus on the higher TFs
// per ingest run; lower TFs warm up on first query.
const TIMEFRAMES: Timeframe[] = ["D1", "H1"];
const LOOKBACK_DAYS = 7;

function authorize(req: NextRequest): boolean {
  const sent = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!sent || !expected) return false;
  try {
    const a = Buffer.from(sent);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

interface AlgoRow {
  id: string;
  instrument: string[] | string | null;
  status: string;
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();

  const { data: algos, error: algoErr } = await svc
    .from("algorithms")
    .select("id, instrument, status")
    .in("status", ["running", "live", "paper"])
    .is("deleted_at", null);

  if (algoErr) {
    logError("BarsIngest", { component: "list algorithms", message: algoErr.message });
    return NextResponse.json({ error: algoErr.message }, { status: 500 });
  }

  // Collect unique symbols across all active algorithms.
  const symbols = new Set<string>();
  for (const a of (algos ?? []) as AlgoRow[]) {
    const list = Array.isArray(a.instrument) ? a.instrument : a.instrument ? [a.instrument] : [];
    for (const s of list) if (typeof s === "string" && s.length > 0) symbols.add(s);
  }

  const now = new Date();
  const from = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const to = now.toISOString();

  const summary: { symbol: string; timeframe: Timeframe; bars: number; error?: string }[] = [];
  for (const symbol of symbols) {
    for (const tf of TIMEFRAMES) {
      try {
        const bars = await loadHistoricalBars(svc, symbol, tf, from, to);
        summary.push({ symbol, timeframe: tf, bars: bars.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.push({ symbol, timeframe: tf, bars: 0, error: msg });
      }
    }
  }

  const totalBars = summary.reduce((s, x) => s + x.bars, 0);
  const errors = summary.filter((x) => x.error).length;
  logInfo("BarsIngest", `ingest cycle complete: ${symbols.size} symbols, ${totalBars} bars, ${errors} errors`, {
    component: "cron",
  });

  return NextResponse.json({ ok: true, symbols: symbols.size, totalBars, errors, summary });
}
