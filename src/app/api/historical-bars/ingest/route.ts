import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { safeCompareTokens } from "@/lib/security/timing";
import { logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"] as const;
const SOURCES = ["mt4", "mt5", "dukascopy", "histdata", "tradovate", "yahoo", "cme", "oanda", "fxratesapi"] as const;

const barSchema = z.object({
  ts: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().int().nonnegative().default(0),
  spread: z.number().int().nonnegative().optional(),
});

const ingestSchema = z.object({
  symbol: z.string().min(1).max(32),
  timeframe: z.enum(TIMEFRAMES),
  source: z.enum(SOURCES),
  user_id: z.string().uuid().optional(),
  bars: z.array(barSchema).min(1).max(2000),
});

const replayCache = new Map<string, number>();
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function checkReplay(signature: string): boolean {
  const now = Date.now();
  const last = replayCache.get(signature);
  if (last && now - last < REPLAY_WINDOW_MS) return false;
  replayCache.set(signature, now);
  for (const [sig, t] of replayCache.entries()) {
    if (now - t > REPLAY_WINDOW_MS * 2) replayCache.delete(sig);
  }
  return true;
}

export async function POST(request: NextRequest) {
  try {
    let rawBody: string;
    let body: unknown;
    try {
      rawBody = await request.text();
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const signature = request.headers.get("x-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing X-Signature header" }, { status: 401 });
    }

    const secret = process.env.HISTORICAL_BARS_SECRET || process.env.MT5_WEBHOOK_SECRET || "";
    if (!secret) {
      logError("HistoricalBarsIngest", { component: "api/historical-bars/ingest", message: "HISTORICAL_BARS_SECRET not configured" });
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!safeCompareTokens(signature, expected)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (!checkReplay(signature)) {
      return NextResponse.json({ error: "Replay detected" }, { status: 429 });
    }

    const parsed = ingestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const { symbol, timeframe, source, user_id, bars } = parsed.data;
    const supabase = createServiceClient();

    const rows = bars.map((b) => ({
      symbol,
      timeframe,
      ts: b.ts,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      volume: b.volume,
      spread: b.spread ?? null,
      source,
      uploaded_by: user_id ?? null,
    }));

    const { error: upsertErr } = await supabase
      .from("historical_bars")
      .upsert(rows, { onConflict: "symbol,timeframe,ts" });

    if (upsertErr) {
      logError("HistoricalBarsIngest", { component: "api/historical-bars/ingest", message: upsertErr.message });
      return NextResponse.json({ error: "DB upsert failed" }, { status: 500 });
    }

    const tsValues = bars.map((b) => new Date(b.ts).getTime());
    const rangeStart = new Date(Math.min(...tsValues)).toISOString();
    const rangeEnd = new Date(Math.max(...tsValues)).toISOString();

    const { data: existingCov } = await supabase
      .from("historical_bars_coverage")
      .select("range_start, range_end, bar_count")
      .eq("symbol", symbol)
      .eq("timeframe", timeframe)
      .eq("source", source)
      .maybeSingle();

    const newRangeStart = existingCov?.range_start && new Date(existingCov.range_start) < new Date(rangeStart)
      ? existingCov.range_start
      : rangeStart;
    const newRangeEnd = existingCov?.range_end && new Date(existingCov.range_end) > new Date(rangeEnd)
      ? existingCov.range_end
      : rangeEnd;
    const newBarCount = (existingCov?.bar_count ?? 0) + bars.length;

    await supabase.from("historical_bars_coverage").upsert(
      {
        symbol,
        timeframe,
        source,
        range_start: newRangeStart,
        range_end: newRangeEnd,
        bar_count: newBarCount,
        last_ingest_at: new Date().toISOString(),
      },
      { onConflict: "symbol,timeframe,source" }
    );

    return NextResponse.json({ ok: true, inserted: bars.length, range: { start: rangeStart, end: rangeEnd } });
  } catch (error) {
    logError("HistoricalBarsIngest", {
      component: "api/historical-bars/ingest",
      action: "POST",
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
