// CME daily settlement fetcher cron — pulls the public settlement CSV per
// futures product from CME's web service, parses with the existing
// cme-csv-parser, and upserts to historical_bars as source='cme'.
//
// Disabled by default (CME_AUTO_FETCH_ENABLED env var). When enabled:
//   - Runs daily after CME closes (we schedule for 23:00 UTC = ~17:00 CT,
//     ~2h after settlement publication).
//   - For each product in CME_PRODUCT_IDS (env-configurable, defaults to
//     the front-month liquid contracts: ES, NQ, GC, CL).
//   - Hits CME's free settlement endpoint:
//        https://www.cmegroup.com/CmeWS/mvc/Settlements/Futures/Settlements/
//        {productId}/FUT?tradeDate=YYYY-MM-DD&exportTo=csv
//   - Parses with parseCmeCsv (already production-tested).
//   - Upserts bars with source='cme'.
//
// Resilience: per-product try/catch — one product failure doesn't kill the
// whole cron. Top-level handler never throws.
//
// Why opt-in: CME's web endpoint isn't a long-term-supported API. Schemas can
// change without notice. The user opts in once they've verified the format
// matches the parser's expectations.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { parseCmeCsv } from "@/lib/backtest/cme-csv-parser";
import { logError, logInfo } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// CME product IDs for the most-traded futures. The web service expects these
// numeric IDs (not symbol codes). Keep aligned with the front-month contracts
// that the engine wizard exposes.
const DEFAULT_PRODUCTS: Array<{ productId: string; symbol: string }> = [
  { productId: "138", symbol: "ES" },   // E-mini S&P 500
  { productId: "145", symbol: "NQ" },   // E-mini Nasdaq 100
  { productId: "139", symbol: "YM" },   // E-mini Dow
  { productId: "145822", symbol: "RTY" }, // E-mini Russell 2000
  { productId: "437", symbol: "GC" },   // Gold
  { productId: "458", symbol: "SI" },   // Silver
  { productId: "425", symbol: "CL" },   // WTI Crude Oil
  { productId: "444", symbol: "NG" },   // Natural Gas
];

const FETCH_TIMEOUT_MS = 15_000;

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

function previousBusinessDate(now: Date): string {
  // CME publishes settlement ~30min after pit close; we fetch the previous
  // business day's settle to avoid race conditions.
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 1);
  // Roll back over weekend
  const dow = d.getUTCDay();   // 0=Sun, 6=Sat
  if (dow === 0) d.setUTCDate(d.getUTCDate() - 2);  // Sun → Fri
  else if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);  // Sat → Fri
  return d.toISOString().slice(0, 10);
}

async function fetchProductSettle(productId: string, tradeDate: string): Promise<string | null> {
  const url = `https://www.cmegroup.com/CmeWS/mvc/Settlements/Futures/Settlements/${productId}/FUT?tradeDate=${tradeDate}&exportTo=csv`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AlphaLog-Backtest/1.0)",
        "Accept": "text/csv,*/*",
      },
    });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface ProductResult {
  symbol:    string;
  productId: string;
  bars:      number;
  inserted:  number;
  error?:    string;
}

async function processProduct(
  svc: ReturnType<typeof createServiceClient>,
  productId: string,
  symbol: string,
  tradeDate: string,
): Promise<ProductResult> {
  const csv = await fetchProductSettle(productId, tradeDate);
  if (!csv) {
    return { symbol, productId, bars: 0, inserted: 0, error: "fetch_failed_or_404" };
  }
  const parsed = parseCmeCsv(csv, { filterSymbol: symbol });
  if (parsed.bars.length === 0) {
    return { symbol, productId, bars: 0, inserted: 0, error: `parser_empty${parsed.errors.length > 0 ? `_${parsed.errors[0].message}` : ""}` };
  }

  const rows = parsed.bars.map((b) => ({
    symbol, timeframe: "D1" as const, ts: b.ts,
    open: b.open, high: b.high, low: b.low, close: b.close,
    volume: b.volume, spread: b.spread,
    source: "cme" as const,
    uploaded_by: null,
  }));

  const { error } = await svc
    .from("historical_bars")
    .upsert(rows, { onConflict: "symbol,timeframe,ts" });

  if (error) {
    return { symbol, productId, bars: parsed.bars.length, inserted: 0, error: `upsert_failed: ${error.message}` };
  }
  return { symbol, productId, bars: parsed.bars.length, inserted: rows.length };
}

async function handler(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = (process.env.CME_AUTO_FETCH_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) {
    return NextResponse.json({
      ok: true,
      enabled: false,
      reason: "CME_AUTO_FETCH_ENABLED is not 'true' — cron is opt-in. Set the env var to activate.",
    }, { status: 200 });
  }

  const startedAt = Date.now();
  const svc = createServiceClient();

  const tradeDate = previousBusinessDate(new Date());
  const results: ProductResult[] = [];

  for (const { productId, symbol } of DEFAULT_PRODUCTS) {
    try {
      results.push(await processProduct(svc, productId, symbol, tradeDate));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError("CmeSettleFetch", { component: "processProduct threw", message: msg, meta: { productId, symbol } });
      results.push({ symbol, productId, bars: 0, inserted: 0, error: `threw: ${msg}` });
    }
  }

  const totals = {
    productsScanned: results.length,
    productsOk:      results.filter((r) => r.error === undefined).length,
    productsFailed:  results.filter((r) => r.error !== undefined).length,
    barsInserted:    results.reduce((s, r) => s + r.inserted, 0),
  };
  const durationMs = Date.now() - startedAt;

  logInfo("CmeSettleFetch", `tradeDate=${tradeDate} scanned=${totals.productsScanned} ok=${totals.productsOk} failed=${totals.productsFailed} bars=${totals.barsInserted} in ${durationMs}ms`);

  return NextResponse.json({
    ok: true,
    enabled: true,
    tradeDate,
    duration_ms: durationMs,
    totals,
    per_product: results,
  }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}

export const GET  = handler;
export const POST = handler;
