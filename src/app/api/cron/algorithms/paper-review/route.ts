// Paper-review cron — walks every algorithm in `paper` status, evaluates its
// accumulated closed paper trades, and auto-promotes paper → approved once it
// clears the paper gates (Phase E7). The lifecycle step after the engine
// backtest gates (draft → paper, Phase E6).
//
// Runs daily. Promotion is one-directional and guarded (eq status='paper') so
// a concurrent run can't double-promote.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { evaluatePaperGates, type PaperTrade } from "@/lib/engine/v1/paper-gates";
import { logError, logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AlgoRow {
  id: string;
  user_id: string;
  name: string;
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
    .select("id, user_id, name, status")
    .eq("status", "paper")
    .is("deleted_at", null);

  if (algoErr) {
    logError("PaperReview", { component: "list algorithms", message: algoErr.message });
    return NextResponse.json({ error: algoErr.message }, { status: 500 });
  }

  const summary: { algorithmId: string; promoted: boolean; closedTrades: number; reason?: string }[] = [];

  for (const algo of (algos ?? []) as AlgoRow[]) {
    try {
      const { data: trades, error: tradesErr } = await svc
        .from("algo_paper_trades")
        .select("pnl, status, opened_at, closed_at")
        .eq("algorithm_id", algo.id)
        .order("opened_at", { ascending: true })
        .limit(500);

      if (tradesErr) {
        summary.push({ algorithmId: algo.id, promoted: false, closedTrades: 0, reason: tradesErr.message });
        continue;
      }

      const evaluation = evaluatePaperGates((trades ?? []) as PaperTrade[]);

      if (!evaluation.eligibleForApproved) {
        const failed = evaluation.results.filter((r) => r.tier === "must" && !r.passed).map((r) => r.key);
        summary.push({
          algorithmId: algo.id,
          promoted: false,
          closedTrades: evaluation.closedTrades,
          reason: `gates_failed:${failed.join(",")}`,
        });
        continue;
      }

      const { error: promoteErr } = await svc
        .from("algorithms")
        .update({ status: "approved" })
        .eq("id", algo.id)
        .eq("user_id", algo.user_id)
        .eq("status", "paper");

      if (promoteErr) {
        summary.push({ algorithmId: algo.id, promoted: false, closedTrades: evaluation.closedTrades, reason: promoteErr.message });
        continue;
      }

      logInfo("PaperReview", `Promoted ${algo.name} to approved`, {
        component: "cron",
        meta: {
          algorithmId: algo.id,
          closedTrades: evaluation.closedTrades,
          totalPnl: evaluation.totalPnl,
          winRate: evaluation.winRate,
          daysLive: evaluation.daysLive,
        },
      });
      summary.push({ algorithmId: algo.id, promoted: true, closedTrades: evaluation.closedTrades });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError("PaperReview", { component: "per-algo", message: msg, meta: { algorithmId: algo.id } });
      summary.push({ algorithmId: algo.id, promoted: false, closedTrades: 0, reason: msg });
    }
  }

  const promotedCount = summary.filter((s) => s.promoted).length;
  logInfo("PaperReview", `reviewed ${summary.length} algorithms, promoted ${promotedCount}`, { component: "cron" });

  return NextResponse.json({ ok: true, reviewed: summary.length, promoted: promotedCount, summary });
}
