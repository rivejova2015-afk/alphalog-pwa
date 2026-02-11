// Trade Quality Rules
// Marca el trade como “incompleto” si faltan campos clave.

export interface Trade {
  id: string;
  notes?: string;
  setup?: string;
  tags?: string[];
}

export function isTradeComplete(trade: Trade): boolean {
  return Boolean(trade.notes && trade.setup && trade.tags && trade.tags.length > 0);
}
