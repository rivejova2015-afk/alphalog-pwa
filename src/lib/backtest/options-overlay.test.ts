import { describe, expect, it } from "vitest";
import { blackScholesPrice, theoreticalOptionPnl } from "./options-overlay";

describe("blackScholesPrice", () => {
  it("ATM call with 30d expiry, IV=25%, r=4.5% prices around 2-4% of spot", () => {
    // SPY-like @ $500 ATM call, 30 days → roughly $14-17 premium
    const p = blackScholesPrice(500, 500, 30 / 365, 0.045, 0.25, "call");
    expect(p).toBeGreaterThan(10);
    expect(p).toBeLessThan(20);
  });

  it("ATM put with same params has comparable premium to call (call-put parity ≈)", () => {
    const call = blackScholesPrice(500, 500, 30 / 365, 0.045, 0.25, "call");
    const put  = blackScholesPrice(500, 500, 30 / 365, 0.045, 0.25, "put");
    // call - put ≈ spot - K*exp(-r*t)  → for ATM this is small positive
    expect(Math.abs(call - put)).toBeLessThan(3);
  });

  it("deep ITM call ≈ intrinsic + small extrinsic", () => {
    // Spot 600, strike 500 → intrinsic 100
    const p = blackScholesPrice(600, 500, 30 / 365, 0.045, 0.25, "call");
    expect(p).toBeGreaterThan(100);
    expect(p).toBeLessThan(110);
  });

  it("deep OTM put ≈ near zero", () => {
    // Spot 600, strike 400 put → far OTM, tiny premium
    const p = blackScholesPrice(600, 400, 30 / 365, 0.045, 0.25, "put");
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(0.5);
  });

  it("at expiry returns intrinsic only", () => {
    expect(blackScholesPrice(510, 500, 0, 0.045, 0.25, "call")).toBe(10);
    expect(blackScholesPrice(495, 500, 0, 0.045, 0.25, "put")).toBe(5);
    expect(blackScholesPrice(500, 500, 0, 0.045, 0.25, "call")).toBe(0);
  });
});

describe("theoreticalOptionPnl", () => {
  it("long signal + price up = positive call P&L", () => {
    const r = theoreticalOptionPnl({
      entry_price: 500,
      exit_price:  510,
      entry_ts:    "2026-01-15T09:30:00Z",
      exit_ts:     "2026-01-15T15:30:00Z",  // same day, no theta decay
      direction:   "long",
    });
    expect(r.type).toBe("call");
    expect(r.pnl_per_contract).toBeGreaterThan(0);
  });

  it("short signal + price down = positive put P&L", () => {
    const r = theoreticalOptionPnl({
      entry_price: 500,
      exit_price:  490,
      entry_ts:    "2026-01-15T09:30:00Z",
      exit_ts:     "2026-01-15T15:30:00Z",
      direction:   "short",
    });
    expect(r.type).toBe("put");
    expect(r.pnl_per_contract).toBeGreaterThan(0);
  });

  it("long signal + price down = negative call P&L", () => {
    const r = theoreticalOptionPnl({
      entry_price: 500,
      exit_price:  490,
      entry_ts:    "2026-01-15T09:30:00Z",
      exit_ts:     "2026-01-15T15:30:00Z",
      direction:   "long",
    });
    expect(r.pnl_per_contract).toBeLessThan(0);
  });

  it("uses default IV=25%, expiry=30d", () => {
    const r = theoreticalOptionPnl({
      entry_price: 500, exit_price: 500,
      entry_ts: "2026-01-15T09:30:00Z", exit_ts: "2026-01-15T10:00:00Z",
      direction: "long",
    });
    expect(r.iv_used).toBe(0.25);
    expect(r.expiry_days).toBe(30);
    expect(r.strike).toBe(500);
  });

  it("strike_offset_pct shifts the strike", () => {
    const r = theoreticalOptionPnl({
      entry_price: 500, exit_price: 500,
      entry_ts: "2026-01-15T09:30:00Z", exit_ts: "2026-01-15T10:00:00Z",
      direction: "long",
      opts: { strike_offset_pct: 5 },
    });
    expect(r.strike).toBe(525);
  });

  it("theta decay reduces premium over multi-day hold", () => {
    const sameDay = theoreticalOptionPnl({
      entry_price: 500, exit_price: 500,
      entry_ts: "2026-01-15T09:30:00Z", exit_ts: "2026-01-15T15:00:00Z",
      direction: "long",
    });
    const tenDayHold = theoreticalOptionPnl({
      entry_price: 500, exit_price: 500,
      entry_ts: "2026-01-15T09:30:00Z", exit_ts: "2026-01-25T15:00:00Z",
      direction: "long",
    });
    // Same prices → all P&L diff is theta. Holding longer loses more premium.
    expect(tenDayHold.pnl_per_contract).toBeLessThan(sameDay.pnl_per_contract);
  });
});
