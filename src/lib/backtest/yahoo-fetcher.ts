import type { Bar, Timeframe } from "@/types/backtest";

// Maps the symbols our wizard exposes (MT5-style) to Yahoo Finance tickers.
const SYMBOL_MAP: Record<string, string> = {
  // Metales — Yahoo killed XAUUSD=X/XAGUSD=X/XPTUSD=X/XPDUSD=X in 2024.
  // Falling back to the corresponding CME futures continuous contract:
  //   GC=F (gold, basis vs spot ~$1-5), SI=F (silver), PL=F (platinum), PA=F (palladium).
  // Surface this clearly in the registry's `notes` so the user knows they're
  // getting a futures proxy, not pure spot. For fidelity-critical work
  // (live execution of an MT5 strategy), import the broker's XAUUSD CSV.
  XAUUSD: "GC=F", XAGUSD: "SI=F", XPTUSD: "PL=F", XPDUSD: "PA=F",
  // Forex Majors
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X", USDCHF: "USDCHF=X",
  AUDUSD: "AUDUSD=X", USDCAD: "USDCAD=X", NZDUSD: "NZDUSD=X",
  // Forex Crosses
  EURJPY: "EURJPY=X", GBPJPY: "GBPJPY=X", EURGBP: "EURGBP=X", EURAUD: "EURAUD=X",
  EURCHF: "EURCHF=X", AUDJPY: "AUDJPY=X", CADJPY: "CADJPY=X", CHFJPY: "CHFJPY=X",
  // Índices US
  US30: "^DJI", US500: "^GSPC", USTEC: "^NDX", US2000: "^RUT",
  // Índices EU/Asia
  GER40: "^GDAXI", UK100: "^FTSE", FRA40: "^FCHI", JPN225: "^N225", HK50: "^HSI",
  // Energía
  USOIL: "CL=F", UKOIL: "BZ=F", NGAS: "NG=F",
  // Crypto
  BTCUSD: "BTC-USD", ETHUSD: "ETH-USD", SOLUSD: "SOL-USD", XRPUSD: "XRP-USD",
  // Futuros CME (continuos front-month). Tradovate is the live venue; Yahoo
  // serves as fallback data source for backtest when no MT5/Tradovate CSV
  // has been imported.
  ES: "ES=F", NQ: "NQ=F", YM: "YM=F", RTY: "RTY=F",
  GC: "GC=F", SI: "SI=F", HG: "HG=F", PL: "PL=F",
  CL: "CL=F", NG: "NG=F", BZ: "BZ=F", HO: "HO=F", RB: "RB=F",
  ZB: "ZB=F", ZN: "ZN=F", ZF: "ZF=F", ZT: "ZT=F",
  ZC: "ZC=F", ZS: "ZS=F", ZW: "ZW=F", ZL: "ZL=F", ZM: "ZM=F",
  // Opciones — el engine backtest evalúa señal sobre el subyacente (ETF o
  // stock). El P&L teórico del contrato se calcula con Black-Scholes en
  // options-overlay.ts.
  SPY: "SPY", QQQ: "QQQ", IWM: "IWM", DIA: "DIA",
  AAPL: "AAPL", TSLA: "TSLA", NVDA: "NVDA", MSFT: "MSFT",
  AMZN: "AMZN", GOOGL: "GOOGL", META: "META", NFLX: "NFLX",
  AMD: "AMD", INTC: "INTC", BABA: "BABA", DIS: "DIS",
};

const INTERVAL_MAP: Record<Timeframe, string> = {
  M1: "1m", M5: "5m", M15: "15m", M30: "30m", H1: "60m", H4: "60m", D1: "1d", W1: "1wk", MN1: "1mo",
};

interface YahooChartResponse {
  chart: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
}

function aggregateToH4(bars: Bar[]): Bar[] {
  // Aggregate H1 bars into H4 buckets (UTC, 0/4/8/12/16/20).
  const out: Bar[] = [];
  let bucket: { ts: string; open: number; high: number; low: number; close: number; volume: number } | null = null;
  for (const b of bars) {
    const d = new Date(b.ts);
    const h = d.getUTCHours();
    const bucketHour = h - (h % 4);
    const bucketTs = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), bucketHour, 0, 0, 0)).toISOString();
    if (!bucket || bucket.ts !== bucketTs) {
      if (bucket) out.push({ ts: bucket.ts, open: bucket.open, high: bucket.high, low: bucket.low, close: bucket.close, volume: bucket.volume, spread: null });
      bucket = { ts: bucketTs, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
    } else {
      bucket.high = Math.max(bucket.high, b.high);
      bucket.low = Math.min(bucket.low, b.low);
      bucket.close = b.close;
      bucket.volume += b.volume;
    }
  }
  if (bucket) out.push({ ts: bucket.ts, open: bucket.open, high: bucket.high, low: bucket.low, close: bucket.close, volume: bucket.volume, spread: null });
  return out;
}

export function mapToYahooTicker(symbol: string): string | null {
  return SYMBOL_MAP[symbol.toUpperCase()] ?? null;
}

export async function fetchYahooBars(
  symbol: string,
  timeframe: Timeframe,
  fromIso: string,
  toIso: string,
): Promise<Bar[]> {
  const ticker = mapToYahooTicker(symbol);
  if (!ticker) throw new Error(`No Yahoo ticker mapping for symbol ${symbol}`);

  const period1 = Math.floor(new Date(fromIso).getTime() / 1000);
  const period2 = Math.floor(new Date(toIso).getTime() / 1000);
  const interval = INTERVAL_MAP[timeframe];

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=${interval}&includePrePost=false&events=history`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  let r: Response;
  try {
    r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AlphaLog-Backtest/1.0)",
        "Accept": "application/json",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("Yahoo fetch timed out after 10s");
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!r.ok) throw new Error(`Yahoo fetch failed: HTTP ${r.status}`);
  const json = (await r.json()) as YahooChartResponse;
  if (json.chart?.error) {
    throw new Error(`Yahoo error: ${json.chart.error.description ?? json.chart.error.code ?? "unknown"}`);
  }
  const result = json.chart?.result?.[0];
  if (!result?.timestamp || !result.indicators?.quote?.[0]) return [];

  const ts = result.timestamp;
  const q = result.indicators.quote[0];
  const out: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    out.push({
      ts: new Date(ts[i] * 1000).toISOString(),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: q.volume?.[i] ?? 0,
      spread: null,
    });
  }

  return timeframe === "H4" ? aggregateToH4(out) : out;
}
