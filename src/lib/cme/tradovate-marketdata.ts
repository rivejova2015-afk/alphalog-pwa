// Tradovate REST market-data fetcher — pulls historical bars via /md/getChart.
// Used by /api/cron/bars/tradovate-fetch to keep `historical_bars` fresh for
// active CME algos (Sprint M: latency mejora — when the dispatcher's
// bars-loader hits a hot cache, the live evaluation skips the slow Yahoo
// fallback).
//
// Requires a per-user OAuth token (same one the dispatcher uses for orders),
// so this fetcher is invoked by the cron with a connection row, not anonymously.

import type { Bar, Timeframe } from "@/types/backtest";

const BASE = (isPaper: boolean): string =>
  isPaper ? "https://demo-api.tradovate.com/v1" : "https://live-api.tradovate.com/v1";

// Tradovate's chart API uses MinuteBar / DailyBar with an elementSize in those
// units. We translate AlphaLog timeframes to that schema.
//   M1  → MinuteBar size=1
//   M5  → MinuteBar size=5
//   M15 → MinuteBar size=15
//   M30 → MinuteBar size=30
//   H1  → MinuteBar size=60
//   H4  → MinuteBar size=240
//   D1  → DailyBar  size=1
//   W1/MN1 — not supported by /md/getChart; throw
//
// Returning null means the timeframe isn't fetchable via this source.
function timeframeToChartDesc(tf: Timeframe): { underlyingType: "MinuteBar" | "DailyBar"; elementSize: number } | null {
  switch (tf) {
    case "M1":  return { underlyingType: "MinuteBar", elementSize: 1 };
    case "M5":  return { underlyingType: "MinuteBar", elementSize: 5 };
    case "M15": return { underlyingType: "MinuteBar", elementSize: 15 };
    case "M30": return { underlyingType: "MinuteBar", elementSize: 30 };
    case "H1":  return { underlyingType: "MinuteBar", elementSize: 60 };
    case "H4":  return { underlyingType: "MinuteBar", elementSize: 240 };
    case "D1":  return { underlyingType: "DailyBar",  elementSize: 1 };
    default:    return null;
  }
}

interface TradovateChartBar {
  timestamp:    string;
  open:         number;
  high:         number;
  low:          number;
  close:        number;
  upVolume?:    number;
  downVolume?:  number;
  upTicks?:     number;
  downTicks?:   number;
}

interface TradovateChartResponse {
  historicalChart?: {
    bars?: TradovateChartBar[];
  };
}

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetch historical bars from Tradovate's /md/getChart REST endpoint.
 *
 * @param token       OAuth access token (Tradovate trader-API).
 * @param isPaper     If true, hits demo-api; else live-api.
 * @param symbol      Tradovate contract code (e.g. "ESM5", "GCQ5").
 * @param timeframe   AlphaLog timeframe; mapped to MinuteBar/DailyBar size.
 * @param from        ISO timestamp — start of window (inclusive).
 * @param to          ISO timestamp — end of window (inclusive).
 *
 * Returns empty array if the timeframe is unsupported or the API returns no bars.
 * Throws on HTTP/network errors so the cron caller can log + skip per-pair.
 */
export async function fetchTradovateBars(
  token: string,
  isPaper: boolean,
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string,
): Promise<Bar[]> {
  const chartDesc = timeframeToChartDesc(timeframe);
  if (!chartDesc) return [];

  const fromMs = new Date(from).getTime();
  const toMs   = new Date(to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return [];

  // /md/getChart returns bars CLOSEST to `closestTimestamp` going backwards.
  // We request `asMuchAsElements` bars ending at `to`, capped at 1000.
  // The chart window matches `to - from` in elementSize units.
  const minutesPerBar = chartDesc.underlyingType === "DailyBar" ? 60 * 24 : chartDesc.elementSize;
  const windowMinutes = Math.ceil((toMs - fromMs) / 60_000);
  const requested = Math.min(1000, Math.max(1, Math.ceil(windowMinutes / minutesPerBar) + 5));

  const body = {
    symbol,
    chartDescription: {
      underlyingType:  chartDesc.underlyingType,
      elementSize:     chartDesc.elementSize,
      elementSizeUnit: "UnderlyingUnits",
    },
    timeRange: {
      closestTimestamp:   new Date(toMs).toISOString(),
      asMuchAsElements:   requested,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE(isPaper)}/md/getChart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Tradovate getChart failed (${res.status}): ${text}`);
    }

    const data = (await res.json()) as TradovateChartResponse;
    const tvBars = data.historicalChart?.bars ?? [];

    const bars: Bar[] = [];
    for (const b of tvBars) {
      const ts = new Date(b.timestamp).getTime();
      if (!Number.isFinite(ts) || ts < fromMs || ts > toMs) continue;
      const volume = (b.upVolume ?? 0) + (b.downVolume ?? 0);
      bars.push({
        ts:     new Date(ts).toISOString(),
        open:   b.open,
        high:   b.high,
        low:    b.low,
        close:  b.close,
        volume,
        spread: null,
      });
    }

    bars.sort((a, b) => a.ts.localeCompare(b.ts));
    return bars;
  } finally {
    clearTimeout(timer);
  }
}
