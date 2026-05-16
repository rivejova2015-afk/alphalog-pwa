// Bars import — accepts a single MT5 CSV upload, parses it, and upserts into
// historical_bars with source='mt5'. Conflicts on (symbol, timeframe, ts)
// overwrite previously-loaded Yahoo rows — by design, since the user opted
// into "broker fidelity": MT5 is ground truth.
//
// Body: multipart/form-data
//   file: required (a single .csv)
//   symbol: optional (else derived from filename)
//   timeframe: optional (else derived from filename)
//   tz_offset_minutes: optional, default 0 (broker server TZ offset from UTC)
//
// Response: { ok, symbol, timeframe, bars_inserted, from_ts, to_ts, errors: [...] }

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseMt5Csv, detectSymbolTfFromFilename, SUPPORTED_TIMEFRAMES } from "@/lib/backtest/mt5-csv-parser";
import { parseTradovateCsv, detectSymbolTfFromTradovateFilename } from "@/lib/backtest/tradovate-csv-parser";
import { parseDukascopyCsv, detectSymbolTfFromDukascopyFilename } from "@/lib/backtest/dukascopy-csv-parser";
import { parseHistDataCsv, detectSymbolTfFromHistDataFilename } from "@/lib/backtest/histdata-csv-parser";
import { parseCmeCsv, detectTfFromCmeFilename } from "@/lib/backtest/cme-csv-parser";
import { logError, logInfo } from "@/lib/log";
import type { Bar, Timeframe } from "@/types/backtest";

type Source = "mt4" | "mt5" | "tradovate" | "dukascopy" | "histdata" | "cme";
const VALID_SOURCES: Source[] = ["mt4", "mt5", "tradovate", "dukascopy", "histdata", "cme"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

const MAX_FILE_BYTES = 50 * 1024 * 1024;   // 50 MB — generous for years of M1
const UPSERT_CHUNK = 1000;

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: algo, error: algoErr } = await supabase
      .from("algorithms")
      .select("id, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (algoErr || !algo) return NextResponse.json({ error: "Algorithm not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
    }
    if (file.size === 0) return NextResponse.json({ error: "Empty file" }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `File too large (max ${Math.floor(MAX_FILE_BYTES / 1024 / 1024)}MB)` }, { status: 413 });
    }

    // Source selection — mt5 (default) covers MT4 too (same CSV shape).
    // tradovate has different columns and date format → separate parser.
    const sourceRaw = (form.get("source") as string | null)?.trim().toLowerCase() ?? "mt5";
    if (!VALID_SOURCES.includes(sourceRaw as Source)) {
      return NextResponse.json({ error: `Invalid source (one of ${VALID_SOURCES.join(", ")})` }, { status: 400 });
    }
    const source = sourceRaw as Source;

    // Resolve symbol + timeframe: explicit form fields override filename detection.
    // Each source has its own filename convention → pick the matching detector.
    const explicitSymbol = (form.get("symbol") as string | null)?.trim().toUpperCase();
    const explicitTf     = (form.get("timeframe") as string | null)?.trim().toUpperCase();

    let fromFilename: { symbol: string | null; tf: Timeframe } | null = null;
    if (source === "tradovate") {
      const det = detectSymbolTfFromTradovateFilename(file.name);
      fromFilename = det ? { symbol: det.symbol, tf: det.tf } : null;
    } else if (source === "dukascopy") {
      const det = detectSymbolTfFromDukascopyFilename(file.name);
      fromFilename = det ? { symbol: det.symbol, tf: det.tf } : null;
    } else if (source === "histdata") {
      const det = detectSymbolTfFromHistDataFilename(file.name);
      fromFilename = det ? { symbol: det.symbol, tf: det.tf } : null;
    } else if (source === "cme") {
      // CME files are multi-symbol — filename only tells us tf=D1.
      // The user must pick the symbol via the form field (or we filter by it).
      const det = detectTfFromCmeFilename(file.name);
      fromFilename = det ? { symbol: null, tf: det.tf } : null;
    } else {
      // mt4/mt5 share the MT5 detector
      const det = detectSymbolTfFromFilename(file.name);
      fromFilename = det ? { symbol: det.symbol, tf: det.tf } : null;
    }

    const symbol = explicitSymbol || fromFilename?.symbol || undefined;
    const timeframe = (explicitTf || fromFilename?.tf) as Timeframe | undefined;
    if (!symbol) {
      const hint = source === "cme"
        ? "CME files include many contracts — pass symbol (e.g. ES, NQ) via form field"
        : "provide explicit or rename to SYMBOL_TF.csv";
      return NextResponse.json({ error: `Could not determine symbol (${hint})` }, { status: 400 });
    }
    if (!timeframe || !(SUPPORTED_TIMEFRAMES as string[]).includes(timeframe)) {
      return NextResponse.json({ error: `Invalid or missing timeframe (one of ${SUPPORTED_TIMEFRAMES.join(", ")})` }, { status: 400 });
    }

    const tzOffsetRaw = form.get("tz_offset_minutes");
    const tzOffsetMinutes = tzOffsetRaw != null ? Number(tzOffsetRaw) : 0;
    if (!Number.isFinite(tzOffsetMinutes) || Math.abs(tzOffsetMinutes) > 14 * 60) {
      return NextResponse.json({ error: "tz_offset_minutes out of range (-840..+840)" }, { status: 400 });
    }

    const text = await file.text();
    let parsed: {
      bars: Bar[];
      errors: Array<{ row: number; message: string }>;
      delimiter: string;
      hasHeader: boolean;
      hasSpread?: boolean;
      contractsSeen?: string[];
    };
    if (source === "tradovate") {
      parsed = parseTradovateCsv(text, { tzOffsetMinutes });
    } else if (source === "dukascopy") {
      parsed = parseDukascopyCsv(text, { tzOffsetMinutes });
    } else if (source === "histdata") {
      parsed = parseHistDataCsv(text, { tzOffsetMinutes });
    } else if (source === "cme") {
      parsed = parseCmeCsv(text, { filterSymbol: symbol });
    } else {
      parsed = parseMt5Csv(text, { tzOffsetMinutes });
    }
    if (parsed.bars.length === 0) {
      return NextResponse.json({
        error: "No valid bars parsed",
        errors: parsed.errors.slice(0, 20),
        delimiter: parsed.delimiter,
        hasHeader: parsed.hasHeader,
        contractsSeen: parsed.contractsSeen,  // useful for CME when symbol mismatch
      }, { status: 422 });
    }

    // Upsert in chunks of 1000 — years of M1 are ~370k rows, no monolithic insert.
    const rows = parsed.bars.map((b) => ({
      symbol, timeframe, ts: b.ts,
      open: b.open, high: b.high, low: b.low, close: b.close,
      volume: b.volume, spread: b.spread,
      source,
      uploaded_by: user.id,
    }));
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK);
      const { error: upsertErr } = await supabase
        .from("historical_bars")
        .upsert(chunk, { onConflict: "symbol,timeframe,ts" });
      if (upsertErr) {
        logError("BarsImport", { component: "upsert chunk", message: upsertErr.message, meta: { algo: id, symbol, tf: timeframe, offset: i } });
        return NextResponse.json({ error: upsertErr.message, bars_inserted: i }, { status: 500 });
      }
    }

    logInfo("BarsImport", `imported ${rows.length} ${symbol} ${timeframe} bars (${source}) for algo ${id}`, {
      component: "POST /api/algorithms/[id]/bars-import",
    });

    return NextResponse.json({
      ok: true,
      symbol,
      timeframe,
      source,
      bars_inserted: rows.length,
      from_ts: parsed.bars[0].ts,
      to_ts: parsed.bars[parsed.bars.length - 1].ts,
      errors: parsed.errors.slice(0, 20),
      delimiter: parsed.delimiter,
      hasHeader: parsed.hasHeader,
      hasSpread: parsed.hasSpread ?? false,
      contractsSeen: parsed.contractsSeen,
    }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    logError("BarsImport", { component: "POST", message: String(err) });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
