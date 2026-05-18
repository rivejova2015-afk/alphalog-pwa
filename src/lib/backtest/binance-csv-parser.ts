// Binance klines CSV parser — handles the bulk archive format published at
// https://data.binance.vision/data/spot/daily/klines/<SYMBOL>/<TF>/
//
// Format (no header, comma-separated, 12 columns):
//   open_time,open,high,low,close,volume,close_time,quote_volume,trades,taker_buy_base,taker_buy_quote,ignore
//
// open_time is a millisecond Unix epoch. We use that directly (no TZ math).
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

// Binance interval → our Timeframe enum.
const TF_MAP: Record<string, Timeframe> = {
  "1m":  "M1",
  "3m":  "M1",   // closest match; we don't have M3
  "5m":  "M5",
  "15m": "M15",
  "30m": "M30",
  "1h":  "H1",
  "2h":  "H1",   // closest; H2 not in enum
  "4h":  "H4",
  "6h":  "H4",   // closest
  "8h":  "H4",
  "12h": "H4",
  "1d":  "D1",
  "3d":  "D1",
  "1w":  "W1",
  "1mo": "MN1",
};

// Filename convention from Binance bulk archive:
//   <SYMBOL>-<INTERVAL>-<YYYY-MM-DD>.csv      (daily)
//   <SYMBOL>-<INTERVAL>-<YYYY-MM>.csv         (monthly)
// Examples: BTCUSDT-1m-2024-01-15.csv, ETHUSDT-1h-2024-01.csv
const FILENAME_RE = /^([A-Z0-9]+)-([0-9]+(?:m|mo|h|d|w))-(\d{4}-\d{2}(?:-\d{2})?)\.csv$/i;

export function detectSymbolTfFromBinanceFilename(name: string): { symbol: string; tf: Timeframe } | null {
  const base = name.replace(/^.*[\\/]/, "");
  const m = base.match(FILENAME_RE);
  if (!m) return null;
  const intervalRaw = m[2].toLowerCase();
  const tf = TF_MAP[intervalRaw];
  if (!tf) return null;
  return { symbol: m[1].toUpperCase(), tf };
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function looksLikeHeader(cells: string[]): boolean {
  const first = (cells[0] ?? "").trim();
  // Binance bulk data has no header — the first column is always a millisecond
  // timestamp (digits only). If it's not numeric, treat it as a header.
  return !/^\d+$/.test(first);
}

export function parseBinanceCsv(text: string): ParseResult {
  const bars: Bar[] = [];
  const errors: ParseError[] = [];

  const lines = stripBom(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { bars, errors: [{ row: 0, message: "empty_file" }], delimiter: ",", hasHeader: false };
  }

  const delimiter = ",";  // Binance bulk archive is always comma-delimited
  const firstCells = lines[0].split(delimiter);
  const hasHeader = looksLikeHeader(firstCells);
  const dataStart = hasHeader ? 1 : 0;

  for (let i = dataStart; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim());
    if (cells.length < 6) {
      errors.push({ row: i + 1, message: `expected_>=6_cols_got_${cells.length}` });
      continue;
    }
    // open_time is milliseconds since epoch. Reject anything that isn't a
    // positive integer-shaped value (no decimals, no negatives).
    const openTimeMs = Number(cells[0]);
    if (!Number.isFinite(openTimeMs) || openTimeMs <= 0 || !Number.isInteger(openTimeMs)) {
      errors.push({ row: i + 1, message: `bad_open_time:${cells[0]}` });
      continue;
    }
    const ts = new Date(openTimeMs).toISOString();

    const open   = Number(cells[1]);
    const high   = Number(cells[2]);
    const low    = Number(cells[3]);
    const close  = Number(cells[4]);
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
