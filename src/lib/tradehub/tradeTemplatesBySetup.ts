// Trade Templates por Setup
// Plantilla de campos/checklist por setup para el journal.

export interface TradeTemplate {
  setup: string;
  fields: string[];
  checklist: string[];
}

export const tradeTemplates: TradeTemplate[] = [
  {
    setup: "breakout",
    fields: ["entry", "exit", "risk", "notes"],
    checklist: ["setup confirmado", "riesgo calculado", "stop definido"]
  },
  {
    setup: "reversal",
    fields: ["entry", "exit", "confirmation", "notes"],
    checklist: ["patrón validado", "riesgo bajo", "stop ajustado"]
  }
];
