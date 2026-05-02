// L4 — Tick-level execution.
//
// Status: NOT AVAILABLE in this build. This file is an honest interface, not a
// simulation. Tick-level backtests need a real tick feed; faking ticks from OHLC
// would just produce confidently-wrong fill prices, which is worse than no tick
// support at all.
//
// To enable:
//   1. Subscribe to a tick feed (Polygon.io, Dukascopy, MetaTrader 5 history dump,
//      Databento, or your broker's tick API).
//   2. Ingest ticks into a `historical_ticks (symbol, ts, bid, ask, last)` table
//      partitioned by month — daily volume is huge (XAUUSD: ~5M ticks/day).
//   3. Implement `TickProvider.streamTicks` reading that table.
//   4. Modify `engine.ts` to consume ticks instead of bars when `cfg.tickLevel`
//      is true: walk forward tick by tick, fill at the actual ask/bid present at
//      the moment SL/TP/entry crosses.
//
// Until those steps land, this module reports `available: false` so callers can
// fall back to bar-level execution gracefully.

import type { Bar } from "@/types/backtest";

export interface Tick {
  ts: string;
  bid: number;
  ask: number;
  last?: number;
}

export interface TickProvider {
  available: boolean;
  streamTicks(symbol: string, from: string, to: string): AsyncIterable<Tick>;
  aggregateToBars(ticks: AsyncIterable<Tick>, tfMinutes: number): Promise<Bar[]>;
}

export const tickProvider: TickProvider = {
  available: false,
  async *streamTicks() {
    throw new Error(
      "Tick-level execution is not available. See src/lib/backtest/tick-stub.ts header for setup steps.",
    );
  },
  async aggregateToBars() {
    throw new Error("Tick aggregation requires a working TickProvider.");
  },
};
