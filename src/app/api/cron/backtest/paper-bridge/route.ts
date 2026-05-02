// L14 — Paper-trading bridge cron.
// For each running algorithm with a known backtest config, replays the engine
// on the most recent bars (no broker side effects) and persists any new entry
// signals into `backtest_paper_signals`. The daemon (L15) compares these
// against actual broker fills to detect divergence.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { runBacktest } from "@/lib/backtest/engine";
import { logError, logInfo } from "@/lib/log";
import type { BacktestConfig, SimulatedTrade } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface AlgoRow {
  id: string;
  user_id: string;
  name: string;
  instrument: string;
  status: string;
}

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

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();

  const { data: algos, error: algoErr } = await svc
    .from("algorithms")
    .select("id, user_id, name, instrument, status")
    .eq("status", "running")
    .is("deleted_at", null);

  if (algoErr) {
    logError("PaperBridge", { component: "list algorithms", message: algoErr.message });
    return NextResponse.json({ error: algoErr.message }, { status: 500 });
  }

  const summary: { algorithmId: string; signals: number; reason?: string }[] = [];

  for (const algo of (algos ?? []) as AlgoRow[]) {
    try {
      const { data: lastJob } = await svc
        .from("backtest_jobs")
        .select("id, config")
        .eq("user_id", algo.user_id)
        .eq("algorithm_id", algo.id)
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastJob?.config) {
        summary.push({ algorithmId: algo.id, signals: 0, reason: "no completed backtest config" });
        continue;
      }

      const cfg = lastJob.config as BacktestConfig;
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = now.toISOString();

      const bars = await loadHistoricalBars(svc, cfg.symbol, cfg.timeframe, from, to);
      if (bars.length < 50) {
        summary.push({ algorithmId: algo.id, signals: 0, reason: `not enough fresh bars (${bars.length})` });
        continue;
      }

      const result = await runBacktest(bars, { ...cfg, from, to });

      const { data: existing } = await svc
        .from("backtest_paper_signals")
        .select("signal_ts")
        .eq("algorithm_id", algo.id)
        .gte("signal_ts", from);
      const seen = new Set((existing ?? []).map((r: { signal_ts: string }) => new Date(r.signal_ts).toISOString()));

      const fresh = result.trades.filter((t: SimulatedTrade) => !seen.has(new Date(t.entryTs).toISOString()));
      if (fresh.length === 0) {
        summary.push({ algorithmId: algo.id, signals: 0 });
        continue;
      }

      const rows = fresh.map((t) => ({
        user_id: algo.user_id,
        algorithm_id: algo.id,
        signal_ts: t.entryTs,
        symbol: cfg.symbol,
        timeframe: cfg.timeframe,
        side: t.side,
        entry_price: t.entryPrice,
        sl_price: t.slPrice,
        tp_price: t.tpPrice,
        expected_pnl: t.pnl,
        source: "paper_bridge",
        meta: { exitReason: t.exitReason, exitTs: t.exitTs, exitPrice: t.exitPrice, lots: t.lots },
      }));

      const { error: insErr } = await svc.from("backtest_paper_signals").insert(rows);
      if (insErr) {
        summary.push({ algorithmId: algo.id, signals: 0, reason: insErr.message });
        continue;
      }
      summary.push({ algorithmId: algo.id, signals: rows.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError("PaperBridge", { component: "per-algo", message: msg, meta: { algorithmId: algo.id } });
      summary.push({ algorithmId: algo.id, signals: 0, reason: msg });
    }
  }

  logInfo("PaperBridge", `processed ${summary.length} algorithms`, { component: "cron" });
  return NextResponse.json({ ok: true, summary });
}
