// Options overlay — Black-Scholes pricing applied to underlying-level signals
// from the engine v1 funnel. The engine doesn't know how to read an options
// chain, so we evaluate the structural signal on the underlying (SPY, QQQ,
// AAPL, etc.) and approximate the option contract P&L theoretically.
//
// Assumptions (documented as deuda):
//   - Implied volatility is constant per-trade (default 25%). Real IV varies
//     with strike, expiry, and term structure — we don't have chain data
//     historically, so this is a hand-wavy proxy.
//   - Risk-free rate is constant (default 4.5%).
//   - Expiry is fixed days from entry (default 30d, configurable).
//   - Strike defaults to ATM at entry (configurable via offset_pct).
//
// Pure functions, no I/O.

export interface OptionLeg {
  type: "call" | "put";
  side: "long" | "short";
  strike: number;
  expiry_days_at_entry: number;
}

export interface OverlayOpts {
  iv?: number;                  // annualized, e.g. 0.25 = 25%
  risk_free?: number;           // annualized, e.g. 0.045 = 4.5%
  expiry_days?: number;         // days from entry to expiry
  strike_offset_pct?: number;   // 0 = ATM, +5 = 5% OTM call, -5 = 5% OTM put
}

export interface TheoreticalPnl {
  premium_at_entry: number;
  premium_at_exit:  number;
  pnl_per_contract: number;
  iv_used:          number;
  expiry_days:      number;
  strike:           number;
  type:             "call" | "put";
}

// Standard normal cumulative distribution function (Abramowitz & Stegun 7.1.26)
function normCdf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

/**
 * Black-Scholes premium for a European call or put on a non-dividend stock.
 *
 * @param spot         underlying price now
 * @param strike       strike price
 * @param tYears       time to expiry in years (e.g. 30/365 for 30 days)
 * @param r            risk-free rate annualized
 * @param sigma        implied volatility annualized
 * @param type         "call" or "put"
 */
export function blackScholesPrice(
  spot: number,
  strike: number,
  tYears: number,
  r: number,
  sigma: number,
  type: "call" | "put",
): number {
  if (tYears <= 0) {
    // At/after expiry — intrinsic value only.
    return type === "call"
      ? Math.max(0, spot - strike)
      : Math.max(0, strike - spot);
  }
  const d1 = (Math.log(spot / strike) + (r + 0.5 * sigma * sigma) * tYears) / (sigma * Math.sqrt(tYears));
  const d2 = d1 - sigma * Math.sqrt(tYears);
  if (type === "call") {
    return spot * normCdf(d1) - strike * Math.exp(-r * tYears) * normCdf(d2);
  }
  return strike * Math.exp(-r * tYears) * normCdf(-d2) - spot * normCdf(-d1);
}

/**
 * For a single engine-v1 trade (entry/exit on underlying), compute the
 * theoretical premium delta of an ATM (or offset) call/put held over the
 * same window.
 *
 * Direction-to-option mapping:
 *   - long underlying signal  → buy call (long premium)
 *   - short underlying signal → buy put  (long premium)
 *
 * P&L per contract (1 share-equivalent) = exit_premium − entry_premium.
 * To get $ P&L per options contract multiply by 100 (US standard multiplier).
 */
export function theoreticalOptionPnl(args: {
  entry_price:   number;
  exit_price:    number;
  entry_ts:      string;
  exit_ts:       string;
  direction:     "long" | "short";
  opts?:         OverlayOpts;
}): TheoreticalPnl {
  const iv          = args.opts?.iv          ?? 0.25;
  const rf          = args.opts?.risk_free   ?? 0.045;
  const expiryDays  = args.opts?.expiry_days ?? 30;
  const strikeOffPct = args.opts?.strike_offset_pct ?? 0;

  const type: "call" | "put" = args.direction === "long" ? "call" : "put";
  const strike = args.entry_price * (1 + strikeOffPct / 100);

  const tEntry = expiryDays / 365;
  // Time decay: exit happens after some real time. Approximate as proportional
  // to bars in window — for simplicity assume same-day exit (no decay) unless
  // the trade spans multiple days.
  const msDiff = new Date(args.exit_ts).getTime() - new Date(args.entry_ts).getTime();
  const daysHeld = Math.max(0, msDiff / (1000 * 60 * 60 * 24));
  const tExit = Math.max(0, (expiryDays - daysHeld) / 365);

  const premium_at_entry = blackScholesPrice(args.entry_price, strike, tEntry, rf, iv, type);
  const premium_at_exit  = blackScholesPrice(args.exit_price,  strike, tExit,  rf, iv, type);

  return {
    premium_at_entry,
    premium_at_exit,
    pnl_per_contract: premium_at_exit - premium_at_entry,
    iv_used: iv,
    expiry_days: expiryDays,
    strike,
    type,
  };
}
