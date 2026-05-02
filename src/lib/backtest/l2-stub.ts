// L10 — Microstructure / L2 order book replay.
//
// Status: NOT AVAILABLE in this build. Faking an order book from OHLC bars would
// invent depth that wasn't there, so this is a stub interface only.
//
// To enable:
//   1. Source historical L2 snapshots. For retail FX/metals this is essentially
//      unavailable — exchanges and prime brokers don't republish book history.
//      Crypto exchanges (Binance, Coinbase) publish full L2 dumps, so this is
//      mostly viable on crypto pairs only.
//   2. Store snapshots in a `historical_l2 (symbol, ts, bids jsonb, asks jsonb)`
//      table — bids/asks are arrays of `[price, size]` tuples to depth N.
//   3. Implement `L2BookProvider.snapshotAt` with binary search by ts.
//   4. Engine integration: when filling, walk the book consuming size at each
//      price level until your order is filled — gives realistic slippage and
//      partial-fill behavior that the Almgren model in `slippage.ts` only
//      approximates analytically.
//
// Without step 1, this module is non-functional. `available: false` lets callers
// silently fall back to the bar+slippage approximation.

export interface L2Level {
  price: number;
  size: number;
}

export interface L2Snapshot {
  ts: string;
  bids: L2Level[]; // sorted descending by price
  asks: L2Level[]; // sorted ascending by price
}

export interface L2BookProvider {
  available: boolean;
  snapshotAt(symbol: string, ts: string): Promise<L2Snapshot | null>;
  // Walk the book on a given side until `lots` are filled; returns vwap and
  // remaining unfilled size if the book ran out.
  marketFill(snapshot: L2Snapshot, side: "buy" | "sell", lots: number): {
    vwap: number;
    filled: number;
    remaining: number;
  };
}

export const l2BookProvider: L2BookProvider = {
  available: false,
  async snapshotAt() {
    throw new Error(
      "L2 order book replay is not available. See src/lib/backtest/l2-stub.ts header for setup steps.",
    );
  },
  marketFill() {
    throw new Error("L2 market fill requires a working L2BookProvider.");
  },
};
