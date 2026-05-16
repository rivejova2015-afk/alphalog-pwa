// HistData.com CSV parser — handles the "Generic ASCII" format that users
// download from histdata.com after manually completing the form on their
// site (no public API). M1 only — that's the only resolution HistData
// publishes for free.
//
// Format:
//   YYYYMMDD HHMMSS;Open;High;Low;Close;Volume
//   20240115 003000;1.10000;1.10010;1.09990;1.10005;0
//
// Notes:
//   - Semicolon-delimited (no header).
//   - Volume is always 0 — HistData doesn't expose real volume on its free
//     M1 dataset. We pass it through as 0.
//   - Times are EST (UTC-5) by default for "Generic ASCII Standard" packs,
//     unless the user picked another offset on the export page. We accept
//     a tzOffsetMinutes override.
//
// Pure functions, no I/O.

import type { Bar, Timeframe } from "@/types/backtest";

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

// HistData filename convention from their download page:
//   DAT_ASCII_<SYMBOL>_M1_<YYYY>[<MM>].csv
//   DAT_ASCII_EURUSD_M1_202401.csv  (one month)
//   DAT_ASCII_EURUSD_M1_2024.csv    (full year)
const FILENAME_RE = /^DAT_ASCII_([A-Z0-9]+)_M1_(\d{4})(?:(\d{2}))?\.csv$/i;

export function detectSymbolTfFromHistDataFilename(name: string): { symbol: string; tf: Timeframe } | null {
  const base = name.replace(/^.*[\\/]/, "");
  const m = base.match(FILENAME_RE);
  if (!m) return null;
  return { symbol: m[1].toUpperCase(), tf: "M1" };
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function sniffDelimiter(line: string): string {
  for (const d of [";", ",", "\t"]) {
    if (line.includes(d)) return d;
  }
  return ";";
}

function looksLikeHeader(cells: string[]): boolean {
  const c = (cells[0] ?? "").trim().toLowerCase();
  return !/^\d/.test(c);
}

// HistData datetime: "YYYYMMDD HHMMSS" — 14 digits with a space.
function parseHistDataDateTime(dt: string, tzOffsetMinutes: number): string | null {
  const m = dt.trim().match(/^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, hh, mm, ss] = m;
  const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm), Number(ss));
  if (!Number.isFinite(utcMs)) return null;
  return new Date(utcMs - tzOffsetMinutes * 60_000).toISOString();
}

export function parseHistDataCsv(
  text: string,
  opts: { tzOffsetMinutes?: number } = {},
): ParseResult {
  // Default to EST (UTC-5) which is the HistData default for "Generic ASCII
  // Standard" — if the user exported with a different setting, they pass
  // tzOffsetMinutes explicitly from the upload UI.
  const tz = opts.tzOffsetMinutes ?? -300;
  const bars: Bar[] = [];
  const errors: ParseError[] = [];

  const lines = stripBom(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { bars, errors: [{ row: 0, message: "empty_file" }], delimiter: ";", hasHeader: false };
  }

  const delimiter = sniffDelimiter(lines[0]);
  const firstCells = lines[0].split(delimiter);
  const hasHeader = looksLikeHeader(firstCells);
  const dataStart = hasHeader ? 1 : 0;

  for (let i = dataStart; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim());
    if (cells.length < 6) {
      errors.push({ row: i + 1, message: `expected_6_cols_got_${cells.length}` });
      continue;
    }
    const ts = parseHistDataDateTime(cells[0], tz);
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
