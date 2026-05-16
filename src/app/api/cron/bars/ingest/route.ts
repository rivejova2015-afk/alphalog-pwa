// Phase B — historical bar feed cron.
// Walks all running/live/paper algorithms, expands their `instrument[]` to the
// symbol set, and calls loadHistoricalBars on every (symbol × timeframe) pair
// the engine actually reads. loadHistoricalBars falls back to Yahoo and upserts
// into historical_bars.
//
// Base Engine v1 is a SMC funnel over four timeframes:
//   D1  → previous day high/low + sweep
//   H1  → session structure + nearby liquidity
//   M15 → break of structure + order block
//   M1  → entry into the OB or an FVG
//
// Each TF gets a lookback sized for what the funnel actually needs (D1 wants
// a couple of days, H1/M15 want enough bars for clean swing detection, M1
// just enough to spot a fresh FVG / current zone) while respecting Yahoo's
// intraday history caps (1m: ~7d, 5m/15m/60m: ~60d, 1d: years).

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { logError, logInfo } from "@/lib/log";
import type { Timeframe } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Per-TF lookback sized for the SMC funnel's needs while staying within
// Yahoo's intraday history caps (1m: ~7d, 5m/15m/60m: ~60d, 1d: years).
const LOOKBACK_DAYS_BY_TF: Record<Timeframe, number> = {
  D1:  30,    // D1 step only needs prev day; 30 gives swing context too
  H1:  30,    // H1 structure + liquidity — wide window for clean swings
  M15: 14,    // M15 BOS + OB detection
  M1:  6,     // M1 entry — Yahoo 1m cap is ~7d, stay just under
  // Below: not in the SMC funnel today, kept for legacy/optional callers.
  H4:  55,
  M5:  7,
  M30: 30,
  W1:  3650,
  MN1: 3650,
};

const ENGINE_TIMEFRAMES: Timeframe[] = ["D1", "H1", "M15", "M1"];

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
  const to = now.toISOString();

  const summary: { symbol: string; timeframe: Timeframe; bars: number; error?: string }[] = [];
  for (const symbol of symbols) {
    for (const tf of ENGINE_TIMEFRAMES) {
      const from = new Date(now.getTime() - LOOKBACK_DAYS_BY_TF[tf] * 24 * 60 * 60 * 1000).toISOString();
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
