// Per-contract tick sizes (price units per tick) for CME futures the dispatcher
// can place orders against. Used by the ATR-derived SL/TP logic in
// dispatchTradovate to convert ATR (in price points) to ticks.
//
// Source: CME contract specifications. These are stable across decades — when
// CME changes a tick size it's a multi-year migration with a new symbol.
//
// "Symbol" here means the root (ES, NQ, CL) — not the contract code (ESH4).
// dispatchTradovate strips the expiry suffix before lookup.

export const TICK_SIZE: Record<string, number> = {
  // Equity indices
  ES:  0.25,
  NQ:  0.25,
  YM:  1.00,
  RTY: 0.10,
  EMD: 0.10,        // E-mini S&P MidCap 400
  MES: 0.25,        // Micro E-mini S&P
  MNQ: 0.25,        // Micro E-mini Nasdaq
  M2K: 0.10,        // Micro Russell 2000

  // Metals
  GC:  0.10,
  SI:  0.005,
  HG:  0.0005,
  PL:  0.10,
  PA:  0.10,
  MGC: 0.10,        // Micro Gold
  SIL: 0.005,       // Micro Silver

  // Energy
  CL:  0.01,
  NG:  0.001,
  BZ:  0.01,        // Brent
  HO:  0.0001,      // ULSD
  RB:  0.0001,      // RBOB Gasoline
  MCL: 0.01,        // Micro WTI

  // Interest rates (fractional ticks — kept as decimals)
  ZB:  1 / 32,      // 30-year T-Bond, 1/32 of a point
  ZN:  1 / 64,      // 10-year T-Note
  ZF:  1 / 128,     // 5-year T-Note
  ZT:  1 / 256,     // 2-year T-Note

  // Grains
  ZC:  0.25,        // Corn (¼ cent/bu)
  ZS:  0.25,        // Soybeans
  ZW:  0.25,        // Wheat
  ZL:  0.01,        // Soybean Oil
  ZM:  0.10,        // Soybean Meal

  // FX futures
  "6E": 0.00005,    // Euro FX
  "6B": 0.0001,     // British Pound
  "6J": 0.0000005,  // Japanese Yen
  "6A": 0.0001,     // Australian Dollar
  "6C": 0.0001,     // Canadian Dollar
};

/**
 * Look up the tick size for a contract root symbol.
 * Returns null when the symbol is unknown — caller should fall back to
 * static SL/TP defaults rather than placing an order with a bogus stop.
 */
export function tickSizeFor(symbol: string): number | null {
  const up = symbol.toUpperCase();
  return TICK_SIZE[up] ?? null;
}

/**
 * Strip the expiry suffix from a Tradovate contract code.
 *   "ESH4"   → "ES"
 *   "GCM5"   → "GC"
 *   "6EH4"   → "6E"
 *   "MESH4"  → "MES"
 * Tradovate uses single-letter month codes (F/G/H/J/K/M/N/Q/U/V/X/Z) followed
 * by a single digit year. Anything else is returned unchanged.
 */
const EXPIRY_RE = /[FGHJKMNQUVXZ]\d$/;
export function rootSymbolOf(contract: string): string {
  const up = contract.toUpperCase().trim();
  return up.replace(EXPIRY_RE, "");
}
