// Tradovate REST chart fetcher cron (Sprint M — latency mejora).
//
// Why this exists: the dispatcher cron (`/api/cron/algorithms/tradovate-poll`)
// evaluates engine v1 on every M1 close. The engine needs M15/H1 bars fresh
// enough that `bars-loader.isStale()` doesn't trigger a Yahoo refetch — that
// refetch adds 1-3s of latency per call. By keeping `historical_bars` warm
// with the user's own Tradovate connection, the dispatcher path becomes
// a hot DB read.
//
// What it does:
//   1. Enumerates active CME-tradovate connections (status='connected').
//   2. For each connection, lists futures-class algorithms in active states
//      (paper/live) and extracts their contract symbols.
//   3. For each (connection, contract, timeframe) combo, fetches the last
//      ~3 days of bars from /md/getChart and upserts to historical_bars.
//   4. Renews the OAuth token if it's about to expire (<10 min).
//
// Failure mode: per-pair try/catch — one symbol failure doesn't halt the rest.
// Returns a structured report so the user can inspect from /api/cron logs.
//
// Auth: same x-cron-secret pattern as the other cron routes.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import type { Timeframe } from "@/types/backtest";
import { createServiceClient } from "@/lib/supabase/server";
import { getPgClient } from "@/lib/pg/client";
import { fetchTradovateBars } from "@/lib/cme/tradovate-marketdata";
import { tradovateRenew } from "@/lib/cme/tradovate";
import { readCmeAccessToken, storeCmeAccessToken } from "@/lib/cme/vault";
import { logError, logInfo, logWarn } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Timeframes the engine v1 funnel reads from. Daily/weekly are out — the
// settlement cron already handles D1 and W1 is rarely meaningful intraday.
const REFRESH_TIMEFRAMES: Timeframe[] = ["M15", "H1"];

// Lookback window for the refresh. 3 days × M15 = ~288 bars — comfortable
// margin for the engine's session-structure window.
const LOOKBACK_HOURS = 72;

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

interface PairResult {
  connectionId: string;
  symbol:       string;
  timeframe:    Timeframe;
  fetched:      number;
  inserted:     number;
  error?:       string;
}

interface AlgoRow {
  id:           string;
  user_id:      string;
  parameters:   Record<string, unknown> | null;
  engine_config: Record<string, unknown> | null;
}

interface ConnRow {
  id:                       string;
  user_id:                  string;
  cme_account_id:           string;
  tradovate_account_id:     number;
  token_expires_at:         string | null;
}

function strParam(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function ensureFreshToken(
  pg: ReturnType<typeof getPgClient>,
  conn: ConnRow,
  isPaper: boolean,
): Promise<string | null> {
  let token = await readCmeAccessToken(conn.id);
  if (!token) return null;

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
  const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000);
  if (!expiresAt || expiresAt < tenMinFromNow) {
    try {
      const renewed = await tradovateRenew(token, isPaper);
      token = renewed.accessToken;
      await storeCmeAccessToken(conn.id, token);
      await pg.from("cme_connections").update({ token_expires_at: renewed.expirationTime }).eq("id", conn.id);
    } catch (err) {
      logWarn("BarsTradovateFetch", "token renew failed (using existing)", {
        component: "ensureFreshToken",
        meta: { connectionId: conn.id, error: err instanceof Error ? err.message : String(err) },
      });
    }
  }
  return token;
}

async function processPair(
  supabaseHistorical: ReturnType<typeof createServiceClient>,
  token: string,
  isPaper: boolean,
  connectionId: string,
  symbol: string,
  timeframe: Timeframe,
): Promise<PairResult> {
  const to = new Date();
  const from = new Date(to.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);

  try {
    const bars = await fetchTradovateBars(token, isPaper, symbol, timeframe, from.toISOString(), to.toISOString());
    if (bars.length === 0) {
      return { connectionId, symbol, timeframe, fetched: 0, inserted: 0, error: "empty_response" };
    }

    const rows = bars.map((b) => ({
      symbol,
      timeframe,
      ts:     b.ts,
      open:   b.open,
      high:   b.high,
      low:    b.low,
      close:  b.close,
      volume: b.volume,
      spread: b.spread ?? null,
      source: "tradovate" as const,
      uploaded_by: null,
    }));

    const { error: upErr } = await supabaseHistorical
      .from("historical_bars")
      .upsert(rows, { onConflict: "symbol,timeframe,ts" });
    if (upErr) {
      return { connectionId, symbol, timeframe, fetched: bars.length, inserted: 0, error: `upsert: ${upErr.message}` };
    }

    // Update coverage row.
    const tsValues = bars.map((b) => new Date(b.ts).getTime());
    await supabaseHistorical.from("historical_bars_coverage").upsert(
      {
        symbol,
        timeframe,
        source: "tradovate",
        range_start:    new Date(Math.min(...tsValues)).toISOString(),
        range_end:      new Date(Math.max(...tsValues)).toISOString(),
        bar_count:      bars.length,
        last_ingest_at: new Date().toISOString(),
      },
      { onConflict: "symbol,timeframe,source" },
    );

    return { connectionId, symbol, timeframe, fetched: bars.length, inserted: bars.length };
  } catch (err) {
    return {
      connectionId, symbol, timeframe,
      fetched: 0, inserted: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function handler(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const pg = getPgClient();
  // Acotado únicamente a historical_bars/historical_bars_coverage — fuera de
  // alcance de esta migración (25,111 filas reales, compartida entre
  // forex/crypto/futuros; ver plan
  // docs/superpowers/plans/2026-07-13-cme-tradovate-migracion.md).
  const supabaseHistorical = createServiceClient();

  const { data: connsRaw } = await pg
    .from("cme_connections")
    .select("id, user_id, cme_account_id, tradovate_account_id, token_expires_at")
    .eq("status", "connected");
  const conns: ConnRow[] = (connsRaw ?? []) as unknown as ConnRow[];

  if (conns.length === 0) {
    return NextResponse.json({ ok: true, connections: 0, results: [], duration_ms: Date.now() - startedAt }, { status: 200 });
  }

  // Per-user algos in active states. We filter by engine_config.market_type
  // = 'futures' OR platform = 'tradovate' to find ones whose dispatcher would
  // benefit from fresh CME bars.
  const userIds = Array.from(new Set(conns.map((c) => c.user_id)));
  const { data: algosRaw } = await pg
    .from("algorithms")
    .select("id, user_id, parameters, engine_config, platform, status")
    .in("user_id", userIds)
    .in("status", ["paper", "live"]);
  const algos: AlgoRow[] = ((algosRaw ?? []) as Array<AlgoRow & { platform: string | null }>)
    .filter((a) => {
      const mt = (a.engine_config as Record<string, unknown> | null)?.market_type;
      const isFutures = typeof mt === "string" && mt.toLowerCase() === "futures";
      const isTv = typeof (a as { platform?: string }).platform === "string" && (a as { platform: string }).platform.toLowerCase() === "tradovate";
      return isFutures || isTv;
    });

  const results: PairResult[] = [];

  for (const conn of conns) {
    const { data: acct } = await pg
      .from("algo_cme_accounts")
      .select("is_paper")
      .eq("id", conn.cme_account_id)
      .maybeSingle();
    const isPaper = (acct as { is_paper: boolean } | null)?.is_paper ?? true;

    const token = await ensureFreshToken(pg, conn, isPaper);
    if (!token) {
      results.push({ connectionId: conn.id, symbol: "-", timeframe: "M15", fetched: 0, inserted: 0, error: "no_token" });
      continue;
    }

    // Collect distinct contracts from this user's futures algos.
    const userAlgos = algos.filter((a) => a.user_id === conn.user_id);
    const contracts = new Set<string>();
    for (const a of userAlgos) {
      const params = (a.parameters ?? {}) as Record<string, unknown>;
      const c = strParam(params.contract) ?? strParam(params.leg_a_instrument);
      if (c) contracts.add(c);
    }

    if (contracts.size === 0) continue;

    for (const symbol of contracts) {
      for (const tf of REFRESH_TIMEFRAMES) {
        results.push(await processPair(supabaseHistorical, token, isPaper, conn.id, symbol, tf));
      }
    }
  }

  const totalFetched  = results.reduce((s, r) => s + r.fetched, 0);
  const totalInserted = results.reduce((s, r) => s + r.inserted, 0);
  const totalErrors   = results.filter((r) => r.error).length;
  const durationMs    = Date.now() - startedAt;

  logInfo("BarsTradovateFetch", `connections=${conns.length} pairs=${results.length} fetched=${totalFetched} inserted=${totalInserted} errors=${totalErrors} in ${durationMs}ms`, {
    component: "summary",
    meta: { results: results.slice(0, 50) },
  });

  if (totalErrors > 0 && totalInserted === 0) {
    logError("BarsTradovateFetch", { component: "summary", message: "all pairs failed", meta: { results } });
  }

  return NextResponse.json({
    ok:             totalErrors === 0 || totalInserted > 0,
    connections:    conns.length,
    pairs_processed: results.length,
    total_fetched:  totalFetched,
    total_inserted: totalInserted,
    errors:         totalErrors,
    duration_ms:    durationMs,
    results,
  }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}

export const GET = handler;
export const POST = handler;
