// MT5 CSV parser — converts the file produced by MT5's
// "File → Save As → CSV" chart export into Bar rows ready to upsert into
// historical_bars.
//
// Format from MT5 (delimiter is configurable in the terminal; we sniff it):
//   Date,Time,Open,High,Low,Close,Volume[,Spread]
//   2024.01.15,00:00,2030.45,2031.20,2029.10,2030.85,123[,15]
//
// MT5 does NOT embed the timeframe in the CSV — the user has to declare it
// (via filename pattern or explicit input on upload). Timezone is also
// implicit: MT5 chart times come in the broker's server TZ, so the caller
// passes an offset in minutes (default 0 = UTC).
//
// Pure functions, no I/O. Validation lives here so the route/CLI just wire it.

import type { Bar, Timeframe } from "@/types/backtest";

export const SUPPORTED_TIMEFRAMES: Timeframe[] = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"];

export interface ParseRow {
  ts: string;           // ISO UTC
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  spread: number | null;
}

export interface ParseError {
  row: number;          // 1-indexed (excluding header)
  message: string;
}

export interface ParseResult {
  bars: Bar[];
  errors: ParseError[];
  delimiter: string;
  hasHeader: boolean;
  hasSpread: boolean;
}

// Filename convention used by MT5 default exports: SYMBOL_TF[_anything].csv
// Longest-first alternation ensures M15 wins over M1 etc.; lookahead allows
// the TF to be followed by '_', '.', '-', or end-of-string (a plain `\b`
// fails between `H1` and `_` because `_` is itself a word char).
const FILENAME_RE = /^([A-Z0-9]+)[._\-](M15|M30|M5|M1|H4|H1|MN1|D1|W1)(?=[._\-]|$)/i;

export function detectSymbolTfFromFilename(name: string): { symbol: string; tf: Timeframe } | null {
  const base = name.replace(/^.*[\\/]/, "");
  const m = base.match(FILENAME_RE);
  if (!m) return null;
  const tfRaw = m[2].toUpperCase();
  if (!(SUPPORTED_TIMEFRAMES as string[]).includes(tfRaw)) return null;
  return { symbol: m[1].toUpperCase(), tf: tfRaw as Timeframe };
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function sniffDelimiter(line: string): string {
  // Try in priority order — most MT5 exports are comma.
  for (const d of [",", ";", "\t"]) {
    if (line.includes(d)) return d;
  }
  return ",";
}

function looksLikeHeader(cells: string[]): boolean {
  // First field is "Date" / "Time" / non-numeric in MT5 default header.
  const c = (cells[0] ?? "").trim().toLowerCase();
  return c === "date" || c === "<date>" || c === "datetime" || !/^\d/.test(c);
}

// MT5 dates: 2024.01.15 (or sometimes 2024-01-15)
// MT5 times: 00:00 (or 00:00:00)
function parseMt5DateTime(dateStr: string, timeStr: string, tzOffsetMinutes: number): string | null {
  const dateMatch = dateStr.trim().match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (!dateMatch) return null;
  const [, y, mo, d] = dateMatch;

  const timeMatch = (timeStr || "00:00").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!timeMatch) return null;
  const [, hh, mm, ss = "0"] = timeMatch;

  const utcMs = Date.UTC(
    Number(y), Number(mo) - 1, Number(d),
    Number(hh), Number(mm), Number(ss),
  );
  if (!Number.isFinite(utcMs)) return null;
  // tz offset minutes: MT5 broker is N minutes AHEAD of UTC, so subtract.
  const adjusted = utcMs - tzOffsetMinutes * 60_000;
  return new Date(adjusted).toISOString();
}

export function parseMt5Csv(
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
    return { bars, errors: [{ row: 0, message: "empty_file" }], delimiter: ",", hasHeader: false, hasSpread: false };
  }

  const delimiter = sniffDelimiter(lines[0]);
  const firstCells = lines[0].split(delimiter);
  const hasHeader = looksLikeHeader(firstCells);
  const dataStart = hasHeader ? 1 : 0;

  // Probe one data row to see whether spread is present (7 vs 8 columns).
  const probeIdx = dataStart;
  if (probeIdx >= lines.length) {
    return { bars, errors: [{ row: 0, message: "no_data_rows" }], delimiter, hasHeader, hasSpread: false };
  }
  const probe = lines[probeIdx].split(delimiter);
  const hasSpread = probe.length >= 8;
  const expectedCols = hasSpread ? 8 : 7;

  for (let i = dataStart; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim());
    if (cells.length < expectedCols) {
      errors.push({ row: i + 1, message: `expected_${expectedCols}_cols_got_${cells.length}` });
      continue;
    }
    const [dateStr, timeStr, oS, hS, lS, cS, vS, spS] = cells;
    const ts = parseMt5DateTime(dateStr, timeStr, tz);
    if (!ts) {
      errors.push({ row: i + 1, message: `bad_datetime:${dateStr} ${timeStr}` });
      continue;
    }
    const open  = Number(oS);
    const high  = Number(hS);
    const low   = Number(lS);
    const close = Number(cS);
    const volume = Number(vS);
    const spread = hasSpread ? Number(spS) : null;

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

    bars.push({ ts, open, high, low, close, volume, spread: spread ?? null });
  }

  // Sort by timestamp (defensive — MT5 exports are usually already sorted).
  bars.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  return { bars, errors, delimiter, hasHeader, hasSpread };
}
