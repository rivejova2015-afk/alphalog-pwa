// Dukascopy CSV parser — handles the export from Dukascopy's "Historical
// Data Feed" web tool. Same pattern as mt5-csv-parser and tradovate-csv-parser.
//
// Dukascopy default export shape:
//   Local time,Open,High,Low,Close,Volume
//   01.01.2024 00:00:00.000 GMT+0000,1.10000,1.10010,1.09990,1.10005,123.45
//
// Differences from the others:
//   - Single combined datetime column (DD.MM.YYYY HH:MM:SS.sss GMT±hhmm).
//   - DD.MM.YYYY (European) not US MM/DD/YYYY.
//   - Embedded GMT offset in the timestamp itself — but Dukascopy also lets
//     the user pick the export TZ in the UI, so the value of "GMT+0000" is
//     just whatever the user chose. We respect the embedded offset.
//   - Volume can be fractional (broker-side aggregated).
//   - No spread column.
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

// Filename convention from Dukascopy export: `<SYMBOL>_<Tf>_<from>_<to>.csv`
// where Tf is one of "Candlestick_1_M_BID", "Candlestick_15_M_BID", etc.
// We also accept simpler patterns the user might rename to.
const FILENAME_RE = /^([A-Z]{6,7})[._\-].*?(Candlestick[_-]?(\d+)[_-]?(M|H|D|W|MN)|M15|M30|M5|M1|H4|H1|D1|W1|MN1)/i;

function tfFromMatch(rawTf: string): Timeframe | null {
  const up = rawTf.toUpperCase();
  // Direct MT-style tags (when the user renamed manually).
  if ((SUPPORTED_TIMEFRAMES as string[]).includes(up)) return up as Timeframe;
  // Dukascopy "Candlestick_N_U_BID" patterns.
  const cs = up.match(/CANDLESTICK[_-]?(\d+)[_-]?(M|H|D|W|MN)/);
  if (!cs) return null;
  const [, n, unit] = cs;
  if (unit === "M" && ["1","5","15","30"].includes(n)) return `M${n}` as Timeframe;
  if (unit === "H" && ["1","4"].includes(n))           return `H${n}` as Timeframe;
  if (unit === "D" && n === "1")                       return "D1";
  if (unit === "W" && n === "1")                       return "W1";
  if (unit === "MN" && n === "1")                      return "MN1";
  return null;
}

export function detectSymbolTfFromDukascopyFilename(name: string): { symbol: string; tf: Timeframe } | null {
  const base = name.replace(/^.*[\\/]/, "");
  const m = base.match(FILENAME_RE);
  if (!m) return null;
  const tf = tfFromMatch(m[2]);
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
  return c.includes("time") || c === "datetime" || c === "timestamp" || c === "date" || !/^\d/.test(c);
}

// Dukascopy embeds a GMT offset in the datetime string itself.
// "01.01.2024 00:00:00.000 GMT+0000" or "GMT-0500".
function parseDukascopyDateTime(dt: string, externalOffsetMinutes: number): string | null {
  const trimmed = dt.trim();
  // Try with embedded GMT offset (preferred — Dukascopy's own metadata).
  const fullRe = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:\s+GMT([+\-])(\d{2})(\d{2}))?$/;
  const m = trimmed.match(fullRe);
  if (!m) return null;
  const [, d, mo, y, hh, mm, ss, ms = "0", sign, hOff, mOff] = m;

  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss), Number(ms));
  if (!Number.isFinite(utcMs)) return null;

  // Embedded offset wins when present; otherwise fall back to the user-passed offset.
  let offsetMinutes: number;
  if (sign && hOff && mOff) {
    offsetMinutes = (Number(hOff) * 60 + Number(mOff)) * (sign === "+" ? 1 : -1);
  } else {
    offsetMinutes = externalOffsetMinutes;
  }
  const adjusted = utcMs - offsetMinutes * 60_000;
  return new Date(adjusted).toISOString();
}

export function parseDukascopyCsv(
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

  if (dataStart >= lines.length) {
    return { bars, errors: [{ row: 0, message: "no_data_rows" }], delimiter, hasHeader };
  }

  for (let i = dataStart; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim());
    // Expected: 6 columns (datetime, O, H, L, C, V). Some exports include
    // separate Bid/Ask sets — we only read the first OHLCV block.
    if (cells.length < 6) {
      errors.push({ row: i + 1, message: `expected_>=6_cols_got_${cells.length}` });
      continue;
    }
    const ts = parseDukascopyDateTime(cells[0], tz);
    if (!ts) {
      errors.push({ row: i + 1, message: `bad_datetime:${cells[0]}` });
      continue;
    }
    const open  = Number(cells[1]);
    const high  = Number(cells[2]);
    const low   = Number(cells[3]);
    const close = Number(cells[4]);
    const volume = Number(cells[5]);

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
