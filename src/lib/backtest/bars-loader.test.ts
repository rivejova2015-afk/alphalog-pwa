import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bar } from "@/types/backtest";

// Mock external fetchers BEFORE importing the module under test so vi.mock
// hoisting binds to these spies. Each fetcher exports two functions: the
// fetch + the mapping check. We keep mapping permissive (returns truthy) so
// the chain proceeds to fetch; tests that want to skip a source clear the
// mapping mock or return null per case.
const mockYahooFetch  = vi.fn<(symbol: string, tf: string, from: string, to: string) => Promise<Bar[]>>();
const mockYahooMap    = vi.fn<(symbol: string) => string | null>();
const mockFxFetch     = vi.fn<(symbol: string, tf: string, from: string, to: string) => Promise<Bar[]>>();
const mockFxMap       = vi.fn<(symbol: string) => string | null>();
const mockOandaFetch  = vi.fn<(symbol: string, tf: string, from: string, to: string) => Promise<Bar[]>>();
const mockOandaMap    = vi.fn<(symbol: string) => string | null>();
const mockChainFor    = vi.fn<(symbol: string, tf: string) => string[]>();
const mockNextSteps   = vi.fn<(symbol: string, tf: string) => string[]>();

vi.mock("@/lib/backtest/yahoo-fetcher", () => ({
  fetchYahooBars:    (...args: [string, string, string, string]) => mockYahooFetch(...args),
  mapToYahooTicker:  (s: string) => mockYahooMap(s),
}));
vi.mock("@/lib/backtest/fxratesapi-fetcher", () => ({
  fetchFxratesapiBars:  (...args: [string, string, string, string]) => mockFxFetch(...args),
  mapToFxratesapiPair:  (s: string) => mockFxMap(s),
}));
vi.mock("@/lib/backtest/oanda-fetcher", () => ({
  fetchOandaBars:        (...args: [string, string, string, string]) => mockOandaFetch(...args),
  mapToOandaInstrument:  (s: string) => mockOandaMap(s),
}));
vi.mock("@/lib/backtest/source-registry", () => ({
  getApiSourcesForTf: (s: string, tf: string) => mockChainFor(s, tf),
  nextStepsForEmpty:  (s: string, tf: string) => mockNextSteps(s, tf),
}));

const { loadHistoricalBarsDetailed } = await import("./bars-loader");

// ─── Helpers ────────────────────────────────────────────────────────────────

function bar(close: number, ts = "2026-05-01T00:00:00Z"): Bar {
  return {
    ts,
    open: close - 1,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100,
    spread: null,
  };
}

interface SupabaseStub {
  selectBars: Bar[];           // what readBarsFromTable returns first call
  selectBarsAfter?: Bar[];     // what readBarsFromTable returns second call (post-ingest)
  ingestErrors?: string[];     // pushed when upsert is invoked
}

function stubSupabase(state: SupabaseStub): never {
  let selectCalls = 0;
  const limitPromise = (): Promise<unknown> => {
    selectCalls += 1;
    const rows = selectCalls === 1 || !state.selectBarsAfter ? state.selectBars : state.selectBarsAfter;
    // The loader pages with limit=1000; emitting all rows at once short-circuits
    // the paginator (data.length < PAGE → break) — correct for our small test sizes.
    return Promise.resolve({
      data: rows.map((b) => ({
        ts: b.ts, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume, spread: b.spread,
      })),
      error: null,
    });
  };
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq     = () => chain;
  chain.gte    = () => chain;
  chain.lte    = () => chain;
  chain.order  = () => chain;
  chain.limit  = () => limitPromise();
  chain.upsert = () => {
    state.ingestErrors?.push("upsert ok");
    return Promise.resolve({ error: null });
  };
  return {
    from: () => chain,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default permissive mappings — every source claims to support the symbol.
  mockYahooMap.mockReturnValue("YH-MAPPED");
  mockFxMap.mockReturnValue("FX-MAPPED");
  mockOandaMap.mockReturnValue("OA-MAPPED");
  mockNextSteps.mockReturnValue([]);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const FROM = "2026-05-01T00:00:00Z";
const TO   = "2026-05-15T00:00:00Z";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("loadHistoricalBarsDetailed — local cache hit", () => {
  it("returns local without consulting API when DB has >= 60 bars", async () => {
    const bars = Array.from({ length: 80 }, (_, i) => bar(100 + i, isoAt(i)));
    const supabase = stubSupabase({ selectBars: bars });
    mockChainFor.mockReturnValue(["yahoo"]);

    const r = await loadHistoricalBarsDetailed(supabase, "EURUSD", "M15", FROM, TO);

    expect(r.effectiveSource).toBe("local");
    expect(r.bars.length).toBe(80);
    expect(r.localBars).toBe(80);
    expect(mockYahooFetch).not.toHaveBeenCalled();
    expect(mockFxFetch).not.toHaveBeenCalled();
  });
});

describe("loadHistoricalBarsDetailed — API fallthrough", () => {
  it("walks the chain in order and returns the first non-empty source", async () => {
    const supabase = stubSupabase({
      selectBars: [],
      selectBarsAfter: Array.from({ length: 120 }, (_, i) => bar(100 + i, isoAt(i))),
    });
    mockChainFor.mockReturnValue(["yahoo", "fxratesapi", "oanda"]);
    mockYahooFetch.mockResolvedValue([]);            // 1st source empty
    mockFxFetch.mockResolvedValue([bar(200)]);       // 2nd source hits
    mockOandaFetch.mockResolvedValue([bar(300)]);    // would hit but shouldn't be called

    const r = await loadHistoricalBarsDetailed(supabase, "XAUUSD", "M15", FROM, TO);

    expect(r.effectiveSource).toBe("fxratesapi");
    expect(mockYahooFetch).toHaveBeenCalledTimes(1);
    expect(mockFxFetch).toHaveBeenCalledTimes(1);
    expect(mockOandaFetch).not.toHaveBeenCalled();   // short-circuit after success
    expect(r.attempts.map((a) => a.source)).toEqual(["yahoo", "fxratesapi"]);
    expect(r.attempts[0].ok).toBe(false);
    expect(r.attempts[1].ok).toBe(true);
  });

  it("records 'no_X_mapping' when the source has no symbol mapping and moves on", async () => {
    const supabase = stubSupabase({
      selectBars: [],
      selectBarsAfter: Array.from({ length: 120 }, (_, i) => bar(100 + i, isoAt(i))),
    });
    mockChainFor.mockReturnValue(["yahoo", "oanda"]);
    mockYahooMap.mockReturnValue(null);              // Yahoo can't map this symbol
    mockOandaFetch.mockResolvedValue([bar(150)]);

    const r = await loadHistoricalBarsDetailed(supabase, "GC=F", "D1", FROM, TO);

    expect(mockYahooFetch).not.toHaveBeenCalled();
    expect(r.attempts[0]).toMatchObject({ source: "yahoo", ok: false, message: "no_yahoo_mapping" });
    expect(r.effectiveSource).toBe("oanda");
  });

  it("treats a thrown fetcher as a soft failure and tries the next source", async () => {
    const supabase = stubSupabase({
      selectBars: [],
      selectBarsAfter: Array.from({ length: 120 }, (_, i) => bar(100 + i, isoAt(i))),
    });
    mockChainFor.mockReturnValue(["yahoo", "fxratesapi"]);
    mockYahooFetch.mockRejectedValue(new Error("Yahoo 429"));
    mockFxFetch.mockResolvedValue([bar(150)]);

    const r = await loadHistoricalBarsDetailed(supabase, "EURUSD", "D1", FROM, TO);

    expect(r.attempts[0]).toMatchObject({ source: "yahoo", ok: false, message: "Yahoo 429" });
    expect(r.effectiveSource).toBe("fxratesapi");
  });

  it("returns null effectiveSource + nextSteps when every API fails", async () => {
    const supabase = stubSupabase({ selectBars: [] });
    mockChainFor.mockReturnValue(["yahoo", "oanda"]);
    mockYahooFetch.mockResolvedValue([]);
    mockOandaFetch.mockResolvedValue([]);
    mockNextSteps.mockReturnValue(["Try uploading a Tradovate CSV", "Wait for Yahoo backfill"]);

    const r = await loadHistoricalBarsDetailed(supabase, "UNKNOWN", "M5", FROM, TO);

    expect(r.effectiveSource).toBeNull();
    expect(r.bars).toEqual([]);
    expect(r.nextSteps).toContain("Try uploading a Tradovate CSV");
  });
});

describe("loadHistoricalBarsDetailed — robustness", () => {
  it("returns an empty result chain when getApiSourcesForTf is []", async () => {
    const supabase = stubSupabase({ selectBars: [] });
    mockChainFor.mockReturnValue([]);
    mockNextSteps.mockReturnValue(["No API source registered for this symbol"]);

    const r = await loadHistoricalBarsDetailed(supabase, "RANDOM", "M15", FROM, TO);

    expect(r.attempts).toEqual([]);
    expect(r.effectiveSource).toBeNull();
    expect(r.bars).toEqual([]);
  });
});

function isoAt(offsetMin: number): string {
  return new Date(new Date(FROM).getTime() + offsetMin * 60_000).toISOString();
}

// ─── Sprint G: staleness-driven refetch ──────────────────────────────────────
// When the request reaches into "now" (to ≈ now) AND the latest local bar is
// older than the per-TF threshold, the loader walks the API chain even with
// local.length >= MIN_BARS. This is what allows the dispatcher cron to see
// fresh data without needing the bars/ingest cron to fire every minute.

describe("loadHistoricalBarsDetailed — staleness refetch (Sprint G)", () => {
  const nowIso = () => new Date().toISOString();
  function isoAgo(ms: number): string {
    return new Date(Date.now() - ms).toISOString();
  }
  function freshBars(count: number, latestAgeMs: number, stepMs: number): Bar[] {
    const start = Date.now() - latestAgeMs - (count - 1) * stepMs;
    return Array.from({ length: count }, (_, i) =>
      bar(100 + i, new Date(start + i * stepMs).toISOString())
    );
  }

  it("M1 with latest bar 5min old → forces API refetch (>2min threshold)", async () => {
    // 80 stale M1 bars, latest one 5min old.
    const stale = freshBars(80, 5 * 60_000, 60_000);
    const fresh = freshBars(85, 0,           60_000);
    const supabase = stubSupabase({ selectBars: stale, selectBarsAfter: fresh });
    mockChainFor.mockReturnValue(["yahoo"]);
    mockYahooFetch.mockResolvedValue([bar(999, isoAgo(0))]);

    const r = await loadHistoricalBarsDetailed(supabase, "EURUSD", "M1", FROM, nowIso());

    // Refetched even though local had >= MIN_BARS, because tail was stale.
    expect(mockYahooFetch).toHaveBeenCalledTimes(1);
    expect(r.effectiveSource).toBe("yahoo");
    expect(r.localBars).toBe(80);
  });

  it("M15 with latest bar 10min old → stays local (threshold is 30min)", async () => {
    const local = freshBars(80, 10 * 60_000, 15 * 60_000);
    const supabase = stubSupabase({ selectBars: local });
    mockChainFor.mockReturnValue(["yahoo"]);
    mockYahooFetch.mockResolvedValue([bar(999)]);

    const r = await loadHistoricalBarsDetailed(supabase, "EURUSD", "M15", FROM, nowIso());

    expect(r.effectiveSource).toBe("local");
    expect(mockYahooFetch).not.toHaveBeenCalled();
  });

  it("staleness does NOT trigger for historical backtest windows", async () => {
    // 80 ancient bars (latest is way old), but `to` is also way in the past
    // → not a live window, so refetch should be skipped.
    const ancient = freshBars(80, 365 * 24 * 60 * 60_000, 60_000);
    const supabase = stubSupabase({ selectBars: ancient });
    mockChainFor.mockReturnValue(["yahoo"]);

    const r = await loadHistoricalBarsDetailed(
      supabase, "EURUSD", "M1",
      "2025-01-01T00:00:00Z",  // historical from
      "2025-01-02T00:00:00Z",  // historical to — well past `now`
    );

    expect(r.effectiveSource).toBe("local");
    expect(mockYahooFetch).not.toHaveBeenCalled();
  });

  it("M1 fresh tail (latest < 30s old) → stays local", async () => {
    const fresh = freshBars(80, 20_000, 60_000);  // latest 20s old
    const supabase = stubSupabase({ selectBars: fresh });
    mockChainFor.mockReturnValue(["yahoo"]);

    const r = await loadHistoricalBarsDetailed(supabase, "EURUSD", "M1", FROM, nowIso());

    expect(r.effectiveSource).toBe("local");
    expect(mockYahooFetch).not.toHaveBeenCalled();
  });

  it("D1 with latest bar 1d old → stays local (threshold is 2d)", async () => {
    const local = freshBars(80, 24 * 60 * 60_000, 24 * 60 * 60_000);
    const supabase = stubSupabase({ selectBars: local });
    mockChainFor.mockReturnValue(["yahoo"]);

    const r = await loadHistoricalBarsDetailed(supabase, "EURUSD", "D1", FROM, nowIso());

    expect(r.effectiveSource).toBe("local");
    expect(mockYahooFetch).not.toHaveBeenCalled();
  });

  it("D1 with latest bar 5d old → forces refetch (> 2d threshold)", async () => {
    const stale = freshBars(80, 5 * 24 * 60 * 60_000, 24 * 60 * 60_000);
    const fresh = freshBars(85, 0,                     24 * 60 * 60_000);
    const supabase = stubSupabase({ selectBars: stale, selectBarsAfter: fresh });
    mockChainFor.mockReturnValue(["yahoo"]);
    mockYahooFetch.mockResolvedValue([bar(999)]);

    const r = await loadHistoricalBarsDetailed(supabase, "EURUSD", "D1", FROM, nowIso());

    expect(mockYahooFetch).toHaveBeenCalledTimes(1);
    expect(r.effectiveSource).toBe("yahoo");
  });
});

// Mejora #4 — withRetry integration: transient errors get up to 2 retries
// before the chain falls to the next source. Non-retryable errors fail fast.
describe("loadHistoricalBarsDetailed — retry behavior (Mejora #4)", () => {
  it("retries Yahoo on 429 and surfaces 'succeeded after N retries' in attempts", async () => {
    const supabase = stubSupabase({
      selectBars: [],
      selectBarsAfter: Array.from({ length: 80 }, (_, i) => bar(100 + i, isoAt(i))),
    });
    mockChainFor.mockReturnValue(["yahoo"]);
    mockYahooFetch
      .mockRejectedValueOnce(new Error("Yahoo HTTP 429"))
      .mockResolvedValueOnce([bar(150)]);

    const r = await loadHistoricalBarsDetailed(supabase, "EURUSD", "D1", FROM, TO);

    expect(mockYahooFetch).toHaveBeenCalledTimes(2);
    expect(r.effectiveSource).toBe("yahoo");
    expect(r.attempts[0].source).toBe("yahoo");
    expect(r.attempts[0].ok).toBe(true);
    expect(r.attempts[0].attempts).toBe(2);
    expect(r.attempts[0].message).toContain("succeeded after 1 retry");
  });

  it("falls through to next source after exhausting retries on transient error", async () => {
    const supabase = stubSupabase({
      selectBars: [],
      selectBarsAfter: Array.from({ length: 80 }, (_, i) => bar(100 + i, isoAt(i))),
    });
    mockChainFor.mockReturnValue(["yahoo", "fxratesapi"]);
    mockYahooFetch.mockRejectedValue(new Error("Yahoo HTTP 503"));   // always fails
    mockFxFetch.mockResolvedValue([bar(200)]);

    const r = await loadHistoricalBarsDetailed(supabase, "EURUSD", "D1", FROM, TO);

    // Yahoo tried 3 times (1 initial + 2 retries), then chain walked to FX.
    expect(mockYahooFetch).toHaveBeenCalledTimes(3);
    expect(mockFxFetch).toHaveBeenCalledTimes(1);
    expect(r.effectiveSource).toBe("fxratesapi");
    expect(r.attempts[0]).toMatchObject({ source: "yahoo", ok: false, attempts: 3 });
    expect(r.attempts[0].message).toContain("503");
  });

  it("does NOT retry on non-retryable error (auth failure)", async () => {
    const supabase = stubSupabase({
      selectBars: [],
      selectBarsAfter: Array.from({ length: 80 }, (_, i) => bar(100 + i, isoAt(i))),
    });
    mockChainFor.mockReturnValue(["yahoo", "fxratesapi"]);
    mockYahooFetch.mockRejectedValue(new Error("OANDA: invalid API key"));
    mockFxFetch.mockResolvedValue([bar(200)]);

    const r = await loadHistoricalBarsDetailed(supabase, "EURUSD", "D1", FROM, TO);

    // Single attempt, then walked immediately.
    expect(mockYahooFetch).toHaveBeenCalledTimes(1);
    expect(r.effectiveSource).toBe("fxratesapi");
  });
});
