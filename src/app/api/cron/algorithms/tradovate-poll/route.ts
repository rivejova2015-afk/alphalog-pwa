// Tradovate dispatcher cron — Sprint A.
//
// What it does (every 60s):
//   1. Pulls every algorithm with platform='Tradovate' AND status IN ('live','paper').
//   2. For each: looks at the latest available M1 bar in historical_bars.
//      If that bar is not newer than the algo's last_signal_bar_ts, skip (dedup).
//   3. Otherwise: runs the v1 engine to produce a SignalResult.
//   4. Hands it to the platform dispatcher, which (in shadow mode) just
//      persists to cme_signals as 'skipped' or (in live mode) calls
//      executeSignal() → places the order on Tradovate.
//   5. Updates per-algo telemetry (last_dispatch_at / last_signal_bar_ts /
//      last_dispatch_action / last_dispatch_reason).
//
// Resilience guarantees (the "0 errors" promise):
//   * The cron NEVER throws from the top-level handler. Per-algo failures
//     are caught and logged; the loop continues with the next algo.
//   * The cron WORKS even with zero Tradovate algos (returns counts=0).
//   * The cron is idempotent within a bar — running it 5 times in a minute
//     dispatches at most once per algo per bar (dedup on last_signal_bar_ts).
//   * Shadow mode (default) cannot place a real order — the dispatcher
//     short-circuits before calling executeSignal().
//
// Schedule: every minute. The smallest TF the engine evaluates is M1 — going
// faster wastes resources because no new bars exist between runs.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { runEngineV1 } from "@/lib/engine/v1/index";
import { dispatchSignal, getDispatchMode } from "@/lib/engine/dispatchers/index";
import { isGlobexOpen } from "@/lib/cme/market-hours";
import { logError, logInfo } from "@/lib/log";
import type { EngineConfig } from "@/lib/validations/engine-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface AlgoRow {
  id: string;
  user_id: string;
  name: string;
  status: string;
  platform: string;
  instrument: string[] | string | null;
  parameters: Record<string, unknown> | null;
  engine_config: EngineConfig | null;
  lot_size: number | null;
  risk_percent: number | null;
  last_signal_bar_ts: string | null;
}

interface PerAlgoLog {
  algoId:        string;
  symbol:        string | null;
  action:        string;           // 'placed' | 'shadow_logged' | 'skipped' | 'failed' | 'no_fresh_bar' | 'no_symbol'
  reason?:       string;
  cmeSignalId?:  string;
  orderId?:      number;
  error?:        string;
}

function authorize(req: NextRequest): boolean {
  const sent = req.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;
  if (!sent || !expected) return false;
  try {
    const a = Buffer.from(sent);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function pickSymbol(instrument: string[] | string | null): string | null {
  if (Array.isArray(instrument)) return instrument[0]?.trim() || null;
  if (typeof instrument === "string") return instrument.trim() || null;
  return null;
}

/** Most-recent bar timestamp we have stored for this symbol (any TF). Cheap dedup probe. */
async function latestBarTs(svc: ReturnType<typeof createServiceClient>, symbol: string): Promise<string | null> {
  // Use M1 as the freshness signal — it's the engine's smallest TF and what
  // any cron-driven dispatcher cares about ("did a new candle close?").
  const { data, error } = await svc
    .from("historical_bars")
    .select("ts")
    .eq("symbol", symbol)
    .eq("timeframe", "M1")
    .order("ts", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.ts as string;
}

async function processAlgo(
  svc: ReturnType<typeof createServiceClient>,
  algo: AlgoRow,
): Promise<PerAlgoLog> {
  const algoId = algo.id;
  const symbol = pickSymbol(algo.instrument);
  if (!symbol) {
    return { algoId, symbol: null, action: "no_symbol", reason: "algo has no instrument configured" };
  }

  // Dedup: only run when a new bar exists.
  const latestTs = await latestBarTs(svc, symbol);
  if (!latestTs) {
    await svc.from("algorithms").update({
      last_dispatch_at:      new Date().toISOString(),
      last_dispatch_action:  "skipped",
      last_dispatch_reason:  "no_bars_in_db",
    }).eq("id", algoId);
    return { algoId, symbol, action: "skipped", reason: "no_bars_in_db" };
  }
  const prevBarTs = algo.last_signal_bar_ts;
  if (prevBarTs && new Date(latestTs).getTime() <= new Date(prevBarTs).getTime()) {
    await svc.from("algorithms").update({
      last_dispatch_at: new Date().toISOString(),
    }).eq("id", algoId);
    return { algoId, symbol, action: "skipped", reason: "no_fresh_bar" };
  }

  // Run engine.
  let signal;
  try {
    signal = await runEngineV1(svc, algo, { symbol, now: new Date(latestTs) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError("TradovatePoll", { component: "runEngineV1 threw", message: msg, meta: { algoId, symbol } });
    await svc.from("algorithms").update({
      last_dispatch_at:      new Date().toISOString(),
      last_dispatch_action:  "failed",
      last_dispatch_reason:  `engine_threw: ${msg.slice(0, 120)}`,
    }).eq("id", algoId);
    return { algoId, symbol, action: "failed", reason: "engine_threw", error: msg };
  }

  // Dispatch.
  const result = await dispatchSignal(
    {
      algo: { id: algo.id, user_id: algo.user_id, platform: algo.platform, parameters: algo.parameters },
      signal: { action: signal.action, lots: signal.lots, confidence: signal.confidence, reason: signal.reason },
      currentBarTs: latestTs,
    },
    svc,
  );

  // Telemetry update — always, even on failure.
  await svc.from("algorithms").update({
    last_dispatch_at:      new Date().toISOString(),
    last_signal_bar_ts:    latestTs,
    last_dispatch_action:  result.action,
    last_dispatch_reason:  result.reason ?? null,
  }).eq("id", algoId);

  return {
    algoId, symbol,
    action: result.action,
    reason: result.reason,
    cmeSignalId: result.cmeSignalId,
    orderId: result.externalOrderId,
    error: result.error,
  };
}

async function handler(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const svc = createServiceClient();
  const mode = getDispatchMode();

  // Sprint S — short-circuit when CME Globex is closed. The dispatcher cron
  // runs every minute; ~80h/week (Fri 17:00 ET → Sun 18:00 ET + nightly
  // maintenance) the market is shut and there's nothing to do. Skipping here
  // avoids needless Yahoo + Tradovate API calls. Opt-out: set
  // SKIP_MARKET_HOURS_CHECK=true to bypass (useful for E2E + smoke tests).
  if (process.env.SKIP_MARKET_HOURS_CHECK !== "true" && !isGlobexOpen(new Date())) {
    return NextResponse.json({
      ok:           true,
      mode,
      duration_ms:  Date.now() - startedAt,
      skipped:      "globex_closed",
      counts:       { algosScanned: 0, placed: 0, shadowLogged: 0, skipped: 0, failed: 0, noSymbol: 0 },
      per_algo:     [],
    }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  }

  // Walks every algo whose platform is dispatched server-side (Tradovate
  // futures, IBKR options — both go through src/lib/engine/dispatchers).
  // MT4/MT5 stay EA-driven and are filtered out here.
  const { data: algos, error: algoErr } = await svc
    .from("algorithms")
    .select("id, user_id, name, status, platform, instrument, parameters, engine_config, lot_size, risk_percent, last_signal_bar_ts")
    .in("platform", ["Tradovate", "IBKR"])
    .in("status", ["live", "paper"])
    .is("deleted_at", null);

  if (algoErr) {
    logError("TradovatePoll", { component: "select algorithms", message: algoErr.message });
    return NextResponse.json({ error: algoErr.message, mode }, { status: 500 });
  }

  const perAlgo: PerAlgoLog[] = [];
  for (const algo of (algos ?? []) as AlgoRow[]) {
    try {
      perAlgo.push(await processAlgo(svc, algo));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError("TradovatePoll", { component: "processAlgo threw", message: msg, meta: { algoId: algo.id } });
      perAlgo.push({ algoId: algo.id, symbol: pickSymbol(algo.instrument), action: "failed", reason: "processor_threw", error: msg });
    }
  }

  const counts = {
    algosScanned:   perAlgo.length,
    placed:         perAlgo.filter((p) => p.action === "placed").length,
    shadowLogged:   perAlgo.filter((p) => p.action === "shadow_logged").length,
    skipped:        perAlgo.filter((p) => p.action === "skipped").length,
    failed:         perAlgo.filter((p) => p.action === "failed").length,
    noSymbol:       perAlgo.filter((p) => p.action === "no_symbol").length,
  };
  const durationMs = Date.now() - startedAt;

  logInfo("TradovatePoll", `mode=${mode} scanned=${counts.algosScanned} placed=${counts.placed} shadow=${counts.shadowLogged} skipped=${counts.skipped} failed=${counts.failed} in ${durationMs}ms`);

  return NextResponse.json({
    ok:           true,
    mode,
    duration_ms:  durationMs,
    counts,
    per_algo:     perAlgo,
  }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}

// Vercel cron invokes via GET. Allow POST too for manual triggers.
export const GET = handler;
export const POST = handler;
