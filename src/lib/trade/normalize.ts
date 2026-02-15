export type TradeDirection = "BUY" | "SELL";

const BUY_ALIASES = new Set(["BUY", "LONG", "BULL"]);
const SELL_ALIASES = new Set(["SELL", "SHORT", "BEAR"]);

export function normalizeTradeDirection(input: unknown): TradeDirection | null {
  if (typeof input !== "string") return null;
  const value = input.trim().toUpperCase();
  if (!value) return null;
  if (BUY_ALIASES.has(value)) return "BUY";
  if (SELL_ALIASES.has(value)) return "SELL";
  return null;
}
