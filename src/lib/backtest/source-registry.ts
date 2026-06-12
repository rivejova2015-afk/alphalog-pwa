// Per-symbol data source registry.
//
// Solves a real bug: today `bars-loader` blindly falls back to Yahoo for any
// symbol, and silently returns 0 bars when Yahoo doesn't support it (e.g.
// XAUUSD=X is deprecated since 2024). The user is left looking at "Backtest
// completed in 0ms · 0 trades" with no clue why.
//
// This registry is the single source of truth for:
//   1. Which data sources work for each symbol (ordered preference).
//   2. Which of those are API-fetchable (auto-bootstrap) vs CSV-only (manual).
//   3. Per-symbol notes when the obvious source is broken.
//
// It is consumed by:
//   - bars-loader.ts → walks the API source chain in order, never falls back
//     to a source the registry says doesn't work.
//   - bars-bootstrap route → returns structured diagnostics + next steps.
//   - EngineBacktestPanel UI → renders availability per symbol + actionable
//     warnings when no API source can fill the data.
//
// Pure data + pure functions. No I/O.

import type { Timeframe } from "@/types/backtest";

export type DataSource = "yahoo" | "dukascopy" | "histdata" | "mt5" | "mt4" | "tradovate" | "cme" | "oanda" | "fxratesapi" | "polygon" | "twelvedata";

export type AssetClass =
  | "forex"           // EURUSD, GBPUSD, ...
  | "metals-spot"     // XAUUSD, XAGUSD — Yahoo broken
  | "index-cfd"       // US500, GER40, ... (mapped to Yahoo index symbols)
  | "energy-spot"     // USOIL, NGAS — mapped to Yahoo futures
  | "crypto"          // BTCUSD, ETHUSD, ...
  | "futures-cme"     // ES, NQ, GC, CL, ... (CME contracts)
  | "stock-equity"    // SPY, AAPL, ... (options underlyings)
  | "unknown";

export interface SymbolEntry {
  /** Asset classification — drives the default source chain. */
  assetClass: AssetClass;
  /** Sources that can fetch via API (no human action). Empty = CSV-only symbol. */
  apiSources: DataSource[];
  /** Sources that work via CSV import (the user downloads + uploads). Always usable as a fallback path. */
  csvSources: DataSource[];
  /** Optional human note. Surfaces in the UI when API sources fail. */
  notes?: string;
}

// ─── Defaults per asset class ─────────────────────────────────────────────────
// Used when a symbol isn't explicitly registered. Order matters: best-quality
// API source first.

const DEFAULTS: Record<AssetClass, { apiSources: DataSource[]; csvSources: DataSource[] }> = {
  "forex":         { apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  "metals-spot":   { apiSources: ["twelvedata", "polygon"],          csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  "index-cfd":     { apiSources: ["yahoo"],                          csvSources: ["mt5", "mt4"] },
  "energy-spot":   { apiSources: ["yahoo"],                          csvSources: ["mt5", "mt4"] },
  "crypto":        { apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy"] },
  "futures-cme":   { apiSources: ["yahoo"],                          csvSources: ["tradovate", "cme"] },
  "stock-equity":  { apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  "unknown":       { apiSources: [],                                 csvSources: ["mt5", "mt4"] },
};

// ─── Explicit per-symbol registry ─────────────────────────────────────────────
// Override the defaults for special cases. Keep entries to symbols the wizard
// actually exposes; unknown symbols fall back to assetClass=unknown chain.
//
// Coverage philosophy: list every symbol that any source (Twelve Data, Polygon,
// OANDA, Yahoo) can serve so resolveSymbol() never lands on the 'unknown' chain
// for a real ticker. Adding a symbol here without API support is fine — it'll
// just walk all sources and return [] with actionable next-steps.

// Helper to declare bulk symbols with a uniform shape — keeps the explicit
// registry below readable when we list 100+ tickers in one asset class.
function bulk(
  symbols: string[],
  assetClass: AssetClass,
  apiSources: DataSource[],
  csvSources: DataSource[],
): Record<string, SymbolEntry> {
  const out: Record<string, SymbolEntry> = {};
  for (const s of symbols) out[s] = { assetClass, apiSources, csvSources };
  return out;
}

const FOREX_TWELVE_POLYGON: DataSource[] = ["oanda", "twelvedata", "polygon", "yahoo"];
const METALS_TWELVE_POLYGON: DataSource[] = ["oanda", "twelvedata", "polygon", "yahoo", "fxratesapi"];
const CRYPTO_TWELVE_POLYGON: DataSource[] = ["twelvedata", "polygon", "yahoo"];
const STOCK_TWELVE_POLYGON:  DataSource[] = ["twelvedata", "polygon", "yahoo"];

const FOREX_CSV  = ["mt5", "mt4", "dukascopy", "histdata"] as DataSource[];
const CRYPTO_CSV = ["mt5", "mt4", "dukascopy"] as DataSource[];
const STOCK_CSV  = [] as DataSource[];

const REGISTRY: Record<string, SymbolEntry> = {
  // ── Metals spot — Yahoo XAUUSD=X et al están muertos. Como proxy se usa el
  // contrato futuro CME (GC=F gold, SI=F silver, etc). Basis vs spot pequeño
  // (~$1-5 en gold, proporcionales en otros). Suficiente para backtest de
  // señal técnica; para fidelity exacta del broker importar CSV MT4/MT5.
  XAUUSD: {
    assetClass: "metals-spot",
    // Yahoo first (covers all TFs via GC=F futures proxy). fxratesapi as D1
    // backup with real spot price (no futures basis) — only kicks in if
    // Yahoo fails entirely.
    apiSources: ["oanda", "twelvedata", "polygon", "yahoo", "fxratesapi"],
    csvSources: ["mt5", "mt4", "dukascopy", "histdata"],
    notes: "Yahoo sirve GC=F (gold futures continuo) como proxy de XAUUSD spot — basis ~$1-5. fxratesapi como respaldo D1 spot real (sin basis). Para fidelity intraday exacta importar CSV de MT5 broker.",
  },
  XAGUSD: {
    assetClass: "metals-spot",
    apiSources: ["oanda", "twelvedata", "polygon", "yahoo", "fxratesapi"],
    csvSources: ["mt5", "mt4", "dukascopy", "histdata"],
    notes: "Yahoo sirve SI=F (silver futures) como proxy. fxratesapi como respaldo D1 spot real. Para fidelity exacta importar CSV.",
  },
  XPTUSD: {
    assetClass: "metals-spot",
    apiSources: ["oanda", "twelvedata", "polygon", "yahoo", "fxratesapi"],
    csvSources: ["mt5", "mt4", "dukascopy"],
    notes: "Yahoo sirve PL=F como proxy. fxratesapi D1 spot real como respaldo. Para fidelity exacta importar CSV.",
  },
  XPDUSD: {
    assetClass: "metals-spot",
    apiSources: ["oanda", "twelvedata", "polygon", "yahoo", "fxratesapi"],
    csvSources: ["mt5", "mt4", "dukascopy"],
    notes: "Yahoo sirve PA=F como proxy. fxratesapi D1 spot real como respaldo. Para fidelity exacta importar CSV.",
  },

  // ── Forex majors + crosses (Yahoo works, broker CSV is canonical) ─────────
  EURUSD: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  GBPUSD: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  USDJPY: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  USDCHF: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  AUDUSD: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  USDCAD: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  NZDUSD: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  EURJPY: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  GBPJPY: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  EURGBP: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  EURAUD: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  EURCHF: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  AUDJPY: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  CADJPY: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },
  CHFJPY: { assetClass: "forex", apiSources: ["oanda", "twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy", "histdata"] },

  // ── Index CFDs (mapped to Yahoo index tickers) ────────────────────────────
  US30:   { assetClass: "index-cfd", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },
  US500:  { assetClass: "index-cfd", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },
  USTEC:  { assetClass: "index-cfd", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },
  US2000: { assetClass: "index-cfd", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },
  GER40:  { assetClass: "index-cfd", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },
  UK100:  { assetClass: "index-cfd", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },
  FRA40:  { assetClass: "index-cfd", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },
  JPN225: { assetClass: "index-cfd", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },
  HK50:   { assetClass: "index-cfd", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },

  // ── Energy spot (Yahoo via futures continuation) ──────────────────────────
  USOIL:  { assetClass: "energy-spot", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },
  UKOIL:  { assetClass: "energy-spot", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },
  NGAS:   { assetClass: "energy-spot", apiSources: ["yahoo"], csvSources: ["mt5", "mt4"] },

  // ── Crypto ────────────────────────────────────────────────────────────────
  BTCUSD: { assetClass: "crypto", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy"] },
  ETHUSD: { assetClass: "crypto", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4", "dukascopy"] },
  SOLUSD: { assetClass: "crypto", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4"] },
  XRPUSD: { assetClass: "crypto", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: ["mt5", "mt4"] },

  // ── Futures CME (Tradovate live, Yahoo =F fallback) ───────────────────────
  ES:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  NQ:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  YM:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  RTY: { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  GC:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"], notes: "Si necesitás gold spot usá XAUUSD; este es el contrato GC=F." },
  SI:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  HG:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  PL:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  CL:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  NG:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  BZ:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  HO:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  RB:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  ZB:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  ZN:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  ZF:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  ZT:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  ZC:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  ZS:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  ZW:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  ZL:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },
  ZM:  { assetClass: "futures-cme", apiSources: ["yahoo"], csvSources: ["tradovate", "cme"] },

  // ── Stock equities / ETFs (options underlyings) ───────────────────────────
  SPY:  { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  QQQ:  { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  IWM:  { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  DIA:  { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  AAPL: { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  TSLA: { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  NVDA: { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  MSFT: { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  AMZN: { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  GOOGL:{ assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  META: { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  NFLX: { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  AMD:  { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  INTC: { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  BABA: { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },
  DIS:  { assetClass: "stock-equity", apiSources: ["twelvedata", "polygon", "yahoo"], csvSources: [] },

  // ── Bulk-registered symbols (added 2026 expansion) ─────────────────────────
  // Same chains as the explicit entries above; declared via bulk() to keep
  // the registry readable when we add 100+ tickers.

  // Forex (extended majors + crosses + EM)
  ...bulk(
    ["EURCAD","EURNZD","EURNOK","EURSEK","EURPLN","EURHUF","EURCZK",
     "GBPAUD","GBPCAD","GBPCHF","GBPNZD",
     "AUDCAD","AUDCHF","AUDNZD",
     "NZDJPY","NZDCAD","NZDCHF","CADCHF",
     "USDMXN","USDZAR","USDTRY","USDSEK","USDNOK","USDDKK","USDPLN","USDHUF",
     "USDCZK","USDSGD","USDHKD","USDCNH","USDTHB","USDKRW","USDINR","USDILS","USDBRL"],
    "forex", FOREX_TWELVE_POLYGON, FOREX_CSV
  ),

  // Spot metals (extra non-USD quotes)
  ...bulk(
    ["XPTUSD","XPDUSD","XAUEUR","XAUGBP","XAUJPY","XAUAUD"],
    "metals-spot", METALS_TWELVE_POLYGON, ["mt5","mt4","dukascopy"] as DataSource[]
  ),

  // Crypto (top 40+)
  ...bulk(
    ["BNBUSD","ADAUSD","DOGEUSD","AVAXUSD","DOTUSD","LINKUSD",
     "MATICUSD","ATOMUSD","NEARUSD","ALGOUSD","FTMUSD",
     "ICPUSD","APTUSD","SUIUSD","INJUSD",
     "UNIUSD","AAVEUSD","MKRUSD","CRVUSD","COMPUSD","GRTUSD","LDOUSD",
     "ARBUSD","OPUSD","STRKUSD","IMXUSD",
     "LTCUSD","BCHUSD","XLMUSD","ETCUSD","EOSUSD","XMRUSD","TRXUSD",
     "SHIBUSD","PEPEUSD","FLOKIUSD",
     "SANDUSD","MANAUSD","AXSUSD","GALAUSD",
     "FILUSD","ARUSD","RNDRUSD"],
    "crypto", CRYPTO_TWELVE_POLYGON, CRYPTO_CSV
  ),

  // Stocks / ETFs — broad index, sector, commodity, volatility, megacaps
  ...bulk(
    ["VOO","VTI","VXUS","VEA","VWO","EEM","EFA",
     "XLK","XLF","XLE","XLV","XLP","XLY","XLI","XLU","XLB","XLRE","XLC",
     "GLD","SLV","USO","UNG","DBA","DBC","PDBC","GDX","GDXJ",
     "UVXY","VIXY","VXX","SQQQ","TQQQ","SOXL","SOXS","TZA","TNA",
     "GOOG","ORCL","CRM","ADBE","AVGO","CSCO","IBM","QCOM","TXN","MU","ASML","TSM",
     "JPM","BAC","WFC","GS","MS","C","BLK","SCHW","AXP",
     "V","MA","PYPL","SQ",
     "JNJ","PFE","UNH","MRK","LLY","ABBV","TMO","ABT","BMY","AMGN",
     "WMT","KO","PEP","MCD","NKE","SBUX","COST","HD","LOW","TGT","EL",
     "XOM","CVX","COP","SLB","OXY","MPC","PSX",
     "BA","CAT","DE","GE","HON","UPS","FDX","LMT","RTX",
     "T","VZ","CMCSA","TMUS",
     "F","GM","RIVN","LCID",
     "COIN","MSTR","RIOT","MARA","HOOD"],
    "stock-equity", STOCK_TWELVE_POLYGON, STOCK_CSV
  ),
};

// ─── Capability matrix ────────────────────────────────────────────────────────
// Per-source TF coverage. Used to pre-filter the chain when we know a source
// can't serve the requested resolution (e.g. CME settlement is D1 only).

const SOURCE_TF_SUPPORT: Record<DataSource, Set<Timeframe>> = {
  yahoo:      new Set<Timeframe>(["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"]),
  dukascopy:  new Set<Timeframe>(["M1", "M5", "M15", "M30", "H1", "H4", "D1"]),
  histdata:   new Set<Timeframe>(["M1"]),
  mt5:        new Set<Timeframe>(["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"]),
  mt4:        new Set<Timeframe>(["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"]),
  tradovate:  new Set<Timeframe>(["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"]),
  cme:        new Set<Timeframe>(["D1"]),
  oanda:      new Set<Timeframe>(["M1", "M5", "M15", "M30", "H1", "H4", "D1"]),
  fxratesapi: new Set<Timeframe>(["D1"]),  // metales spot, single-point per day → degenerate OHLC
  polygon:    new Set<Timeframe>(["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"]),
  twelvedata: new Set<Timeframe>(["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1", "MN1"]),
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve the registry entry for a symbol. Falls back to the asset-class
 * default when the symbol isn't explicitly registered (returns `assetClass:
 * 'unknown'` if both lookups fail).
 */
export function resolveSymbol(symbol: string): SymbolEntry {
  const up = symbol.toUpperCase();
  const explicit = REGISTRY[up];
  if (explicit) return explicit;
  // No explicit entry — return the unknown chain. Caller can still try CSV.
  return {
    assetClass: "unknown",
    ...DEFAULTS.unknown,
    notes: `Symbol ${up} no está en el registry. Se asume sin API source — importar CSV.`,
  };
}

/**
 * Sources that can be auto-fetched for a (symbol, timeframe) pair, in
 * preference order. Filters by both registry chain AND per-source TF capability.
 */
export function getApiSourcesForTf(symbol: string, tf: Timeframe): DataSource[] {
  const entry = resolveSymbol(symbol);
  return entry.apiSources.filter((s) => SOURCE_TF_SUPPORT[s]?.has(tf));
}

/**
 * Sources that work via CSV import for a (symbol, timeframe) pair. These are
 * always offered as a fallback path in the UI when API sources can't fill data.
 */
export function getCsvSourcesForTf(symbol: string, tf: Timeframe): DataSource[] {
  const entry = resolveSymbol(symbol);
  return entry.csvSources.filter((s) => SOURCE_TF_SUPPORT[s]?.has(tf));
}

/**
 * True when at least one API source can fetch this (symbol, tf) — i.e. the
 * bootstrap button is expected to succeed. False = user must import CSV.
 */
export function hasApiCoverage(symbol: string, tf: Timeframe): boolean {
  return getApiSourcesForTf(symbol, tf).length > 0;
}

/**
 * Human-readable suggestion of what to do next when 0 bars are returned for a
 * (symbol, tf). Used by the bootstrap response and the UI.
 */
export function nextStepsForEmpty(symbol: string, tf: Timeframe): string[] {
  const entry = resolveSymbol(symbol);
  const csv = getCsvSourcesForTf(symbol, tf);
  const steps: string[] = [];
  if (entry.notes) steps.push(entry.notes);
  if (csv.length > 0) {
    steps.push(`Importá CSV vía "Importar barras" (fuente: ${csv.join(" o ")}).`);
  }
  if (entry.assetClass === "unknown") {
    steps.push(`Si ${symbol} no está soportado por ninguna fuente, eliminalo de los instrumentos del algoritmo.`);
  }
  return steps;
}

/** Used by tests + admin tooling to enumerate every registered symbol. */
export function listRegisteredSymbols(): string[] {
  return Object.keys(REGISTRY).sort();
}
