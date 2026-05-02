// L15 — Continuous backtest daemon.
// Re-runs walk-forward on each running algorithm using its last-known config,
// extended to include the most recent week of data. If recent OOS Sharpe falls
// below 50% of historical IS Sharpe, marks the algorithm with `decay_alert=true`
// and emits a push notification.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { loadHistoricalBars } from "@/lib/backtest/bars-loader";
import { runWalkForward } from "@/lib/backtest/walk-forward";
import { sendPushToSubscriptions } from "@/lib/push/webpush.server";
import { logError, logInfo } from "@/lib/log";
import type { BacktestConfig } from "@/types/backtest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DECAY_THRESHOLD = 0.5;       // OOS Sharpe must stay > 50% of IS Sharpe
const RECENT_WINDOW_COUNT = 4;     // last N walk-forward windows considered "recent"

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

interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

async function emitDecayPush(svc: ReturnType<typeof createServiceClient>, userId: string, algoName: string, oos: number, is: number) {
  const { data } = await svc.from("push_subscriptions").select("subscription").eq("user_id", userId);
  const subs = ((data ?? []).map((s: { subscription: unknown }) => s.subscription).filter(Boolean) as Subscription[]);
  if (subs.length === 0) return;
  await sendPushToSubscriptions(subs, {
    title: "⚠️ Strategy decay detected",
    body: `${algoName}: recent OOS Sharpe ${oos.toFixed(2)} vs IS ${is.toFixed(2)}. Review parameters.`,
    tag: `strategy-decay-${algoName}`,
    data: { type: "backtest_decay", algoName },
  });
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();

  const { data: algos, error: algoErr } = await svc
    .from("algorithms")
    .select("id, user_id, name, status")
    .eq("status", "running")
    .is("deleted_at", null);

  if (algoErr) {
    logError("BacktestDaemon", { component: "list algos", message: algoErr.message });
    return NextResponse.json({ error: algoErr.message }, { status: 500 });
  }

  const summary: { algorithmId: string; oosSharpe: number | null; isSharpe: number | null; decay: boolean; reason?: string }[] = [];

  for (const algo of (algos ?? []) as AlgoRow[]) {
    try {
      const { data: lastJob } = await svc
        .from("backtest_jobs")
        .select("config")
        .eq("user_id", algo.user_id)
        .eq("algorithm_id", algo.id)
        .eq("status", "completed")
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastJob?.config) {
        summary.push({ algorithmId: algo.id, oosSharpe: null, isSharpe: null, decay: false, reason: "no completed backtest config" });
        continue;
      }
      const cfg = lastJob.config as BacktestConfig;

      const to = new Date().toISOString();
      const from = cfg.from;
      const bars = await loadHistoricalBars(svc, cfg.symbol, cfg.timeframe, from, to);
      if (bars.length < 200) {
        summary.push({ algorithmId: algo.id, oosSharpe: null, isSharpe: null, decay: false, reason: `not enough bars (${bars.length})` });
        continue;
      }

      const wf = await runWalkForward(bars, { ...cfg, from, to }, 6, 0.3, "rolling");
      if (wf.windows.length === 0) {
        summary.push({ algorithmId: algo.id, oosSharpe: null, isSharpe: null, decay: false, reason: "walk-forward produced no windows" });
        continue;
      }

      const recent = wf.windows.slice(-RECENT_WINDOW_COUNT);
      const oosAvg = recent.reduce((s, w) => s + w.oos.sharpe, 0) / recent.length;
      const isAvg = wf.windows.reduce((s, w) => s + w.is.sharpe, 0) / wf.windows.length;

      const decay = isAvg > 0.1 && oosAvg < isAvg * DECAY_THRESHOLD;

      const { data: existingState } = await svc
        .from("backtest_daemon_state")
        .select("id, decay_alert")
        .eq("algorithm_id", algo.id)
        .maybeSingle();

      const update = {
        user_id: algo.user_id,
        algorithm_id: algo.id,
        last_check_at: new Date().toISOString(),
        last_oos_sharpe: oosAvg,
        last_is_sharpe: isAvg,
        decay_alert: decay,
        decay_alert_emitted_at: decay && !existingState?.decay_alert ? new Date().toISOString() : existingState ? null : null,
        meta: { windows: wf.windows.length, stability: wf.stability },
      };

      if (existingState) {
        await svc.from("backtest_daemon_state").update(update).eq("id", existingState.id);
      } else {
        await svc.from("backtest_daemon_state").insert(update);
      }

      if (decay && !existingState?.decay_alert) {
        await emitDecayPush(svc, algo.user_id, algo.name, oosAvg, isAvg);
      }

      summary.push({ algorithmId: algo.id, oosSharpe: +oosAvg.toFixed(3), isSharpe: +isAvg.toFixed(3), decay });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError("BacktestDaemon", { component: "per-algo", message: msg, meta: { algorithmId: algo.id } });
      summary.push({ algorithmId: algo.id, oosSharpe: null, isSharpe: null, decay: false, reason: msg });
    }
  }

  logInfo("BacktestDaemon", `processed ${summary.length} algorithms`, { component: "cron" });
  return NextResponse.json({ ok: true, summary });
}
