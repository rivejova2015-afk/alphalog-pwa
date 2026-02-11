// Evidence Auto-Linking
// Sugiere link a trade/setup/cuenta/copygroup por fecha/símbolo/tags; si el match es alto se auto-asocia.

export interface Evidence {
  id: string;
  date: Date;
  symbol: string;
  tags: string[];
}

export interface LinkTarget {
  id: string;
  type: "trade" | "setup" | "cuenta" | "copygroup";
  date: Date;
  symbol: string;
  tags: string[];
}

export function suggestAutoLink(evidence: Evidence, targets: LinkTarget[]): LinkTarget | null {
  // Simulación: match por fecha y símbolo
  return targets.find(t => t.symbol === evidence.symbol && Math.abs(t.date.getTime() - evidence.date.getTime()) < 86400000) || null;
}
