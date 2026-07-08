// Paper-review cron — walks every algorithm in `paper` status, evaluates its
// accumulated closed paper trades, and auto-promotes paper → approved once it
// clears the paper gates (Phase E7). The lifecycle step after the engine
// backtest gates (draft → paper, Phase E6).
//
// Runs daily. Promotion is one-directional and guarded (eq status='paper') so
// a concurrent run can't double-promote.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getPgClient } from "@/lib/pg/client";
import { evaluatePaperGates, type PaperTrade } from "@/lib/engine/v1/paper-gates";
import { buildKellyInputsFromTrades, mergeKellyInputs } from "@/lib/engine/position-sizing/auto-populate";
import { logError, logInfo, logWarn } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface AlgoRow {
  id:         string;
  user_id:    string;
  name:       string;
  status:     string;
  parameters: Record<string, unknown> | null;
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

  // algorithms and algo_paper_trades are the only tables this route touches,
  // and both are in-scope (own Postgres).
  const pg = getPgClient();

  const { data: algos, error: algoErr } = await pg
    .from("algorithms")
    .select("id, user_id, name, status, parameters")
    .eq("status", "paper")
    .is("deleted_at", null);

  if (algoErr) {
    logError("PaperReview", { component: "list algorithms", message: algoErr.message });
    return NextResponse.json({ error: algoErr.message }, { status: 500 });
  }

  const summary: { algorithmId: string; promoted: boolean; closedTrades: number; kellyRefreshed: boolean; reason?: string }[] = [];

  for (const algo of (algos ?? []) as AlgoRow[]) {
    try {
      // algo_paper_trades: shim has no `.limit()` — fetch ordered rows (order
      // preserved from the shim's SQL ORDER BY) and slice(0, 500) in JS.
      const { data: tradesRaw, error: tradesErr } = await pg
        .from("algo_paper_trades")
        .select("pnl, status, opened_at, closed_at")
        .eq("algorithm_id", algo.id)
        .order("opened_at", { ascending: true });

      if (tradesErr) {
        summary.push({ algorithmId: algo.id, promoted: false, closedTrades: 0, kellyRefreshed: false, reason: tradesErr.message });
        continue;
      }

      const trades = ((tradesRaw ?? []) as unknown as { pnl: number | null; status: string; opened_at: string | Date | null; closed_at: string | Date | null }[]).slice(0, 500);

      // Sprint P — refresh Kelly inputs from live paper trades. Live data
      // overrides whatever the engine-backtest wrote when there are ≥30
      // closed trades. Failure-open: if the update fails, log + move on
      // (promotion gate evaluation still runs).
      let kellyRefreshed = false;
      const kellyPayload = buildKellyInputsFromTrades((trades ?? []) as { pnl: number | null; status: string }[], {
        sourceTag: `paper_trades:${algo.id}`,
        nowIso:    new Date().toISOString(),
      });
      if (kellyPayload) {
        const mergedParams = mergeKellyInputs(algo.parameters, kellyPayload);
        const { error: kellyErr } = await pg
          .from("algorithms")
          .update({ parameters: mergedParams })
          .eq("id", algo.id)
          .eq("user_id", algo.user_id);
        if (kellyErr) {
          logWarn("PaperReview", "kelly refresh failed (proceeding with promotion gates)", {
            component: "kelly-refresh",
            meta: { algorithmId: algo.id, error: kellyErr.message },
          });
        } else {
          kellyRefreshed = true;
        }
      }

      const evaluation = evaluatePaperGates((trades ?? []) as PaperTrade[]);

      if (!evaluation.eligibleForApproved) {
        const failed = evaluation.results.filter((r) => r.tier === "must" && !r.passed).map((r) => r.key);
        summary.push({
          algorithmId: algo.id,
          promoted: false,
          closedTrades: evaluation.closedTrades,
          kellyRefreshed,
          reason: `gates_failed:${failed.join(",")}`,
        });
        continue;
      }

      const { error: promoteErr } = await pg
        .from("algorithms")
        .update({ status: "approved" })
        .eq("id", algo.id)
        .eq("user_id", algo.user_id)
        .eq("status", "paper");

      if (promoteErr) {
        summary.push({ algorithmId: algo.id, promoted: false, closedTrades: evaluation.closedTrades, kellyRefreshed, reason: promoteErr.message });
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
      summary.push({ algorithmId: algo.id, promoted: true, closedTrades: evaluation.closedTrades, kellyRefreshed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError("PaperReview", { component: "per-algo", message: msg, meta: { algorithmId: algo.id } });
      summary.push({ algorithmId: algo.id, promoted: false, closedTrades: 0, kellyRefreshed: false, reason: msg });
    }
  }

  const promotedCount = summary.filter((s) => s.promoted).length;
  const kellyRefreshedCount = summary.filter((s) => s.kellyRefreshed).length;
  logInfo("PaperReview", `reviewed ${summary.length} algorithms, promoted ${promotedCount}, kelly refreshed ${kellyRefreshedCount}`, { component: "cron" });

  return NextResponse.json({ ok: true, reviewed: summary.length, promoted: promotedCount, kelly_refreshed: kellyRefreshedCount, summary });
}
