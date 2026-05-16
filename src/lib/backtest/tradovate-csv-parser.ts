// Tradovate CSV parser — converts the export from Tradovate's chart
// "Export Data" into Bar rows ready to upsert into historical_bars.
//
// Tradovate's default export shape:
//   Date,Time,Open,High,Low,Close,UpVolume,DownVolume
//   01/15/2024,09:30:00,4750.25,4751.50,4749.75,4750.50,1234,987
//
// Two differences from MT5:
//   1. Date is `MM/DD/YYYY` (US format), not `YYYY.MM.DD`.
//   2. Volume is split into UpVolume + DownVolume; we sum them.
//   3. No Spread column (futures don't expose spread the same way).
//
// Timezone: Tradovate exports chart-local times. The user passes an offset
// in minutes (default 0 = UTC) so we can normalize.
//
// Pure functions, no I/O.

import type { Bar, Timeframe } from "@/types/backtest";

export const SUPPORTED_TIMEFRAMES: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];

export interface ParseError {
  row: number;
  message: string;
}

export interface ParseResult {
  bars: Bar[];
  errors: ParseError[];
  delimiter: string;
  hasHeader: boolean;
}

// Tradovate TF labels → our internal Timeframe enum.
const TRADOVATE_TF_MAP: Record<string, Timeframe> = {
  "1MIN":   "M1",
  "5MIN":   "M5",
  "15MIN":  "M15",
  "30MIN":  "M30",
  "60MIN":  "H1",
  "240MIN": "H4",
  "DAILY":  "D1",
  "WEEKLY": "W1",
};

// Filename convention: `SYMBOL_TF[_anything].csv` where TF matches Tradovate
// labels (1Min, 5Min, 15Min, 30Min, 60Min, 240Min, Daily, Weekly). Longest-
// first to avoid `1Min` matching inside `15Min`. Lookahead for boundary that
// allows `_` (which is a word character so `\b` doesn't work).
const FILENAME_RE = /^([A-Z0-9]+)[._\-](240Min|15Min|30Min|60Min|1Min|5Min|Daily|Weekly)(?=[._\-]|$)/i;

export function detectSymbolTfFromTradovateFilename(name: string): { symbol: string; tf: Timeframe } | null {
  const base = name.replace(/^.*[\\/]/, "");
  const m = base.match(FILENAME_RE);
  if (!m) return null;
  const tfKey = m[2].toUpperCase();
  const tf = TRADOVATE_TF_MAP[tfKey];
  if (!tf) return null;
  return { symbol: m[1].toUpperCase(), tf };
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function sniffDelimiter(line: string): string {
  for (const d of [",", ";", "\t"]) {
    if (line.includes(d)) return d;
  }
  return ",";
}

function looksLikeHeader(cells: string[]): boolean {
  const c = (cells[0] ?? "").trim().toLowerCase();
  return c === "date" || c === "datetime" || c === "timestamp" || !/^\d/.test(c);
}

// Tradovate dates: 01/15/2024 (US) — also accept 2024-01-15 ISO as fallback.
// Times: 09:30:00 or 09:30.
function parseTradovateDateTime(dateStr: string, timeStr: string, tzOffsetMinutes: number): string | null {
  const us = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = dateStr.trim().match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  let y: string, mo: string, d: string;
  if (us)       { [, mo, d, y] = us; }
  else if (iso) { [, y, mo, d] = iso; }
  else return null;

  const timeMatch = (timeStr || "00:00").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!timeMatch) return null;
  const [, hh, mm, ss = "0"] = timeMatch;

  const utcMs = Date.UTC(
    Number(y), Number(mo) - 1, Number(d),
    Number(hh), Number(mm), Number(ss),
  );
  if (!Number.isFinite(utcMs)) return null;
  const adjusted = utcMs - tzOffsetMinutes * 60_000;
  return new Date(adjusted).toISOString();
}

export function parseTradovateCsv(
  text: string,
  opts: { tzOffsetMinutes?: number } = {},
): ParseResult {
  const tz = opts.tzOffsetMinutes ?? 0;
  const bars: Bar[] = [];
  const errors: ParseError[] = [];

  const lines = stripBom(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { bars, errors: [{ row: 0, message: "empty_file" }], delimiter: ",", hasHeader: false };
  }

  const delimiter = sniffDelimiter(lines[0]);
  const firstCells = lines[0].split(delimiter);
  const hasHeader = looksLikeHeader(firstCells);
  const dataStart = hasHeader ? 1 : 0;

  // Probe row to decide column shape — Tradovate may export 7 cols (combined
  // volume) or 8 cols (UpVolume + DownVolume separately).
  const probeIdx = dataStart;
  if (probeIdx >= lines.length) {
    return { bars, errors: [{ row: 0, message: "no_data_rows" }], delimiter, hasHeader };
  }
  const probe = lines[probeIdx].split(delimiter);
  const hasSplitVolume = probe.length >= 8;
  const expectedCols = hasSplitVolume ? 8 : 7;

  for (let i = dataStart; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim());
    if (cells.length < expectedCols) {
      errors.push({ row: i + 1, message: `expected_${expectedCols}_cols_got_${cells.length}` });
      continue;
    }
    const dateStr = cells[0];
    const timeStr = cells[1];
    const ts = parseTradovateDateTime(dateStr, timeStr, tz);
    if (!ts) {
      errors.push({ row: i + 1, message: `bad_datetime:${dateStr} ${timeStr}` });
      continue;
    }
    const open  = Number(cells[2]);
    const high  = Number(cells[3]);
    const low   = Number(cells[4]);
    const close = Number(cells[5]);
    const volume = hasSplitVolume
      ? Number(cells[6]) + Number(cells[7])
      : Number(cells[6]);

    if (![open, high, low, close, volume].every(Number.isFinite)) {
      errors.push({ row: i + 1, message: "non_finite_numbers" });
      continue;
    }
    if (high < low || high < open || high < close || low > open || low > close) {
      errors.push({ row: i + 1, message: `invalid_ohlc:o=${open},h=${high},l=${low},c=${close}` });
      continue;
    }
    if (volume < 0) {
      errors.push({ row: i + 1, message: `negative_volume:${volume}` });
      continue;
    }

    bars.push({ ts, open, high, low, close, volume, spread: null });
  }

  bars.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  return { bars, errors, delimiter, hasHeader };
}
