// Reglas específicas por propfirm que el risk-manager aplica a `checkOrderRisk`.
//
// Identificación por `algo_cme_accounts.provider_name` (TEXT match contra las claves
// de PROPFIRM_RULES). Si la cuenta tiene un provider_name desconocido (typo, legacy,
// custom), los checks propfirm se skipean — el resto de checks genéricos siguen
// aplicando.
//
// Fuente: Fase 1 research (Junio 2026). Las reglas de propfirms cambian; revisar
// estos valores cada ~3 meses y antes de cualquier flip a DISPATCH_MODE=live.

export type ImpactLevel = "high" | "medium" | "low";

export interface PropfirmRule {
  /** Cutoff time ET en formato "HH:MM" — bloquea nuevas órdenes a partir de este
   * momento porque la propfirm exige flat por X minutos antes del cierre. */
  overnightCutoffEt?: string;

  /** Minutos antes de un evento Tier 1 en los que se bloquean órdenes. */
  newsBlackoutMinutesBefore?: number;

  /** Minutos después del evento en los que se bloquean órdenes. */
  newsBlackoutMinutesAfter?: number;

  /** Niveles de impacto que disparan blackout (default Tier 1 = "high"). */
  newsBlackoutImpactLevels?: ImpactLevel[];

  /** Trailing DD lock-at-profit: cuando equity ≥ funded_amount + lock, el peak
   * efectivo se fija en (funded_amount + lock). Apex EOD / MFFU Pro / Tradeify
   * Select usan este patrón con $100. */
  trailingDdLockAtProfitDollars?: number;

  /** Max contracts simultáneos por tier (clave = funded_amount en USD como string).
   * Para Apex usamos el min entre eval/funded (= funded, el más restrictivo) por
   * conservadurismo. Lucid/MFFU/Tradeify: research no encontró números oficiales
   * → no se setea (caller hace fallback a `cme_risk_configs.max_positions`). */
  maxContractsByTier?: Record<string, number>;

  /** Keywords (case-insensitive substring match) que deben aparecer en
   * `terminal_events.name` para que el evento dispare blackout. Útil cuando
   * la propfirm define "Tier 1" como un subset específico (MFFU: FOMC/NFP/CPI)
   * en lugar de cualquier impact='high'. Si no se setea, blackout dispara con
   * cualquier evento que matchee `newsBlackoutImpactLevels`. */
  newsBlackoutKeywords?: string[];

  /** Si true, bloquea órdenes durante el fin de semana entero (sábado completo
   * + viernes desde overnightCutoffEt + domingo hasta apertura ETH). Útil para
   * propfirms que prohíben weekend holds — diferente de overnight (que ya
   * cubre el cierre diario). */
  disallowWeekendHolds?: boolean;
}

/**
 * PROPFIRM_RULES — keys deben matchear EXACTAMENTE `algo_cme_accounts.provider_name`.
 * Las 4 entradas corresponden a las opciones del wizard
 * (`NewStrategyWizard.client.tsx:58-60`).
 */
export const PROPFIRM_RULES: Record<string, PropfirmRule> = {
  Apex: {
    overnightCutoffEt: "16:59",
    trailingDdLockAtProfitDollars: 100,
    // Apex 4.0 (Marzo 2026): Eval contracts vs PA (funded) contracts.
    // Tomamos el min (PA) por conservadurismo — el funded es siempre más estricto.
    maxContractsByTier: {
      "25000": 2,
      "50000": 4,
      "100000": 6,
      "150000": 9,
    },
  },
  "Lucid Trading": {
    overnightCutoffEt: "16:45",
  },
  MyFundedFutures: {
    newsBlackoutMinutesBefore: 2,
    newsBlackoutMinutesAfter: 2,
    newsBlackoutImpactLevels: ["high"],
    // MFFU define "Tier 1" como FOMC + NFP + CPI específicamente.
    // Otros eventos high-impact (Retail Sales, GDP) no califican como Tier 1
    // según sus T&C — el bot puede tradearlos sin violar la regla.
    newsBlackoutKeywords: ["FOMC", "NFP", "Nonfarm", "CPI", "Consumer Price"],
    trailingDdLockAtProfitDollars: 100,
  },
  Tradeify: {
    // Cutoff inferido del comportamiento EOD trailing — sources no especifican
    // ET exacto. 16:55 es default conservador; ajustar si la T&C lo aclara.
    overnightCutoffEt: "16:55",
    trailingDdLockAtProfitDollars: 100,
  },
};

export function getPropfirmRule(providerName: string | null | undefined): PropfirmRule | null {
  if (!providerName) return null;
  return PROPFIRM_RULES[providerName] ?? null;
}

export function isPropfirmManaged(providerName: string | null | undefined): boolean {
  return getPropfirmRule(providerName) != null;
}
