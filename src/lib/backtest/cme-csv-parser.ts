// CME Group settlement CSV parser — handles the daily settlement files
// published by CME on their public FTP (ftp.cmegroup.com/settle/).
//
// These files contain end-of-day data for every futures contract on the
// exchange — OPEN/HIGH/LOW/LAST/SETTLE/VOLUME/OI. They're the most useful
// dataset CME publishes for free (no intraday tick — that's DataMine paid).
//
// Real-world format varies slightly by product group, but the common shape
// is comma-separated with headers like:
//
//   BizDt,Sym,ID,StrkPx,SecTyp,MMY,Last,OpnT,HghT,LwT,Vol,OpInt,Settle,SubProductSymbol,...
//   2024-01-15,ESH4,12345,,FUT,202403,4750.25,4748.00,4755.50,4745.75,1234567,2345678,4750.50,ES
//
// Key behaviors:
//   - Only FUT (futures) rows are kept — OPT/spread rows skipped (they share
//     the same file but have different price semantics).
//   - The "symbol" we persist is the SubProductSymbol when present (e.g. "ES"),
//     not the contract code "ESH4" — so backtests against the continuous "ES"
//     work without per-contract joins. The user can filter by exact contract
//     via the form's `symbol` field.
//   - All bars are tagged timeframe='D1' (settlements are end-of-day).
//   - Date is BizDt (business date), ISO format already.
//   - OpnT/HghT/LwT = Open Trade Price / High Trade Price / Low Trade Price.
//   - Close = Settle (the official settlement price), NOT Last — Settle is
//     the auction-determined fair close, Last is just the last trade.
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
  contractsSeen: string[];  // distinct SubProductSymbol values found
}

// CME publishes daily settlement files with predictable filenames:
//   settle.YYYYMMDD.s.csv      (daily settlement, all products)
//   stlint_YYYYMMDD            (some variants)
const FILENAME_RE = /^settle\.\d{8}\.s\.csv$/i;

export function detectTfFromCmeFilename(name: string): { tf: Timeframe } | null {
  const base = name.replace(/^.*[\\/]/, "");
  if (!FILENAME_RE.test(base)) return null;
  return { tf: "D1" };
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function findCol(headers: string[], ...candidates: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i !== -1) return i;
  }
  return -1;
}

export interface ParseOpts {
  /** Filter to only this product symbol (e.g. "ES"). If unset, all FUT rows are returned. */
  filterSymbol?: string;
}

export function parseCmeCsv(text: string, opts: ParseOpts = {}): ParseResult {
  const wanted = opts.filterSymbol?.toUpperCase();
  const bars: Bar[] = [];
  const errors: ParseError[] = [];
  const contractsSeen = new Set<string>();

  const lines = stripBom(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { bars, errors: [{ row: 0, message: "empty_file" }], delimiter: ",", hasHeader: false, contractsSeen: [] };
  }

  const delimiter = ",";  // CME settle files are comma-separated
  const headers = lines[0].split(delimiter).map((h) => h.trim());
  // Headers must include the basics — if not, file shape is wrong.
  const idxDate     = findCol(headers, "BizDt", "BusinessDate", "TradeDate");
  const idxSym      = findCol(headers, "Sym", "Symbol");
  const idxSecTyp   = findCol(headers, "SecTyp", "SecurityType");
  const idxOpen     = findCol(headers, "OpnT", "OpenPrice", "Open");
  const idxHigh     = findCol(headers, "HghT", "HighPrice", "High");
  const idxLow      = findCol(headers, "LwT",  "LowPrice",  "Low");
  const idxSettle   = findCol(headers, "Settle", "SettlePrice");
  const idxVol      = findCol(headers, "Vol", "Volume", "TradeVolume");
  const idxSubProd  = findCol(headers, "SubProductSymbol", "Product", "Underlying");

  if ([idxDate, idxSym, idxSecTyp, idxOpen, idxHigh, idxLow, idxSettle].some((i) => i === -1)) {
    return {
      bars,
      errors: [{ row: 1, message: `missing_required_headers (BizDt/Sym/SecTyp/OpnT/HghT/LwT/Settle)` }],
      delimiter,
      hasHeader: true,
      contractsSeen: [],
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim());
    if (cells.length <= idxSettle) {
      errors.push({ row: i + 1, message: `row_too_short:${cells.length}` });
      continue;
    }
    const secTyp = cells[idxSecTyp].toUpperCase();
    if (secTyp !== "FUT") continue;  // skip OPT/SPREAD/etc silently — large files

    const contractCode = cells[idxSym].toUpperCase();
    const product = idxSubProd >= 0 ? cells[idxSubProd].toUpperCase() : contractCode;
    contractsSeen.add(product);
    if (wanted && product !== wanted) continue;

    const dateStr = cells[idxDate];
    const dateMatch = dateStr.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
    if (!dateMatch) {
      errors.push({ row: i + 1, message: `bad_date:${dateStr}` });
      continue;
    }
    const [, y, mo, d] = dateMatch;
    const ts = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).toISOString();

    const open  = Number(cells[idxOpen]);
    const high  = Number(cells[idxHigh]);
    const low   = Number(cells[idxLow]);
    const close = Number(cells[idxSettle]);  // Settle is the canonical close
    const volume = idxVol >= 0 ? Number(cells[idxVol]) : 0;

    if (![open, high, low, close].every(Number.isFinite)) {
      errors.push({ row: i + 1, message: "non_finite_numbers" });
      continue;
    }
    if (high < low || high < open || high < close || low > open || low > close) {
      errors.push({ row: i + 1, message: `invalid_ohlc:o=${open},h=${high},l=${low},c=${close}` });
      continue;
    }

    bars.push({
      ts,
      open, high, low, close,
      volume: Number.isFinite(volume) && volume >= 0 ? volume : 0,
      spread: null,
    });
  }

  bars.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  return {
    bars,
    errors,
    delimiter,
    hasHeader: true,
    contractsSeen: Array.from(contractsSeen).sort(),
  };
}
