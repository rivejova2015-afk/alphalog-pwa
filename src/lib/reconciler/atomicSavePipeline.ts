// Atomic Save Pipeline
// Cada “trade cerrado guardado” dispara un pipeline transaccional: trade → KPIs → TraderMap → ProgressMap → (si aplica) mirroring.
// Si algo falla se marca “pendiente” sin romper UI.

export type PipelineStep = "trade" | "kpi" | "traderMap" | "progressMap" | "mirroring";

export interface PipelineResult {
  step: PipelineStep;
  status: "success" | "pending" | "failed";
  message?: string;
}

export type AtomicTradeData = {
  mirroring?: boolean;
} & Record<string, unknown>;

export async function atomicSavePipeline(
  tradeData: AtomicTradeData,
  options: { onStep?: (result: PipelineResult) => void } = {}
) {
  // Paso 1: Guardar trade
  try {
    // await saveTrade(tradeData)
    options.onStep?.({ step: "trade", status: "success" });
  } catch (e) {
    options.onStep?.({ step: "trade", status: "pending", message: String(e) });
    return;
  }

  // Paso 2: Actualizar KPIs
  try {
    // await updateKPIs(tradeData)
    options.onStep?.({ step: "kpi", status: "success" });
  } catch (e) {
    options.onStep?.({ step: "kpi", status: "pending", message: String(e) });
    return;
  }

  // Paso 3: Actualizar TraderMap
  try {
    // await updateTraderMap(tradeData)
    options.onStep?.({ step: "traderMap", status: "success" });
  } catch (e) {
    options.onStep?.({ step: "traderMap", status: "pending", message: String(e) });
    return;
  }

  // Paso 4: Actualizar ProgressMap
  try {
    // await updateProgressMap(tradeData)
    options.onStep?.({ step: "progressMap", status: "success" });
  } catch (e) {
    options.onStep?.({ step: "progressMap", status: "pending", message: String(e) });
    return;
  }

  // Paso 5: Mirroring (si aplica)
  if (tradeData.mirroring) {
    try {
      // await updateMirroring(tradeData)
      options.onStep?.({ step: "mirroring", status: "success" });
    } catch (e) {
      options.onStep?.({ step: "mirroring", status: "pending", message: String(e) });
      return;
    }
  }
}
