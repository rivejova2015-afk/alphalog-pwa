// USD value per single tick for CME futures. Used by Kelly position sizing
// to translate stop-loss-in-ticks into dollar risk per contract.
//
//   riskPerContractUSD = slTicks × tickValueFor(symbol)
//
// Source: CME contract specifications (point value × tick size). These are
// stable across decades.

export const TICK_VALUE_USD: Record<string, number> = {
  // Equity indices — point value × tick size
  ES:  12.50,  // $50/pt × 0.25
  NQ:   5.00,  // $20/pt × 0.25
  YM:   5.00,  // $5/pt × 1.00
  RTY:  5.00,  // $50/pt × 0.10
  EMD: 10.00,  // $100/pt × 0.10 (E-mini MidCap)
  MES:  1.25,  // $5/pt × 0.25 (Micro)
  MNQ:  0.50,  // $2/pt × 0.25 (Micro)
  M2K:  0.50,  // $5/pt × 0.10 (Micro)

  // Metals
  GC:  10.00,  // $100/oz × 0.10
  SI:  25.00,  // $5000/pt × 0.005
  HG:  12.50,  // $25000/pt × 0.0005
  PL:   5.00,
  PA:  10.00,
  MGC:  1.00,
  SIL:  5.00,

  // Energy
  CL:  10.00,  // $1000/bbl × 0.01
  NG:  10.00,  // $10000/pt × 0.001
  BZ:  10.00,
  HO:   4.20,
  RB:   4.20,
  MCL:  1.00,

  // Interest rates (per 1/32 etc.)
  ZB: 31.25,   // $1000 × 1/32
  ZN: 15.625,
  ZF:  7.8125,
  ZT:  3.90625,

  // Grains
  ZC: 12.50,
  ZS: 12.50,
  ZW: 12.50,
  ZL:  6.00,
  ZM: 10.00,

  // FX futures
  "6E": 6.25,  // €125k × 0.00005
  "6B": 6.25,
  "6J": 6.25,
  "6A": 10.00,
  "6C": 10.00,
};

/**
 * Look up the USD value of a single tick for the given contract root.
 * Returns null when the symbol is unknown — Kelly sizing then falls back to
 * the manual contracts_per_trade default.
 */
export function tickValueFor(symbol: string): number | null {
  const up = symbol.toUpperCase();
  return TICK_VALUE_USD[up] ?? null;
}
