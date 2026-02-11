// Smart Dedup Guard
// Marca como posible duplicado si trade es muy similar (misma cuenta/símbolo/hora).

export interface TradeMinimal {
  id: string;
  account: string;
  symbol: string;
  time: number;
}

export function isPossibleDuplicate(trade: TradeMinimal, others: TradeMinimal[]): boolean {
  return others.some(o =>
    o.id !== trade.id &&
    o.account === trade.account &&
    o.symbol === trade.symbol &&
    Math.abs(o.time - trade.time) < 60000 // 1 min
  );
}
