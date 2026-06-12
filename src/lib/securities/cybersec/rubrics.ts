import type { HomeworkType } from "./types";

// Self-assessment rubrics per homework type. The student checks the criteria they
// believe they met; the score is proportional to the homework's max points.
export const RUBRICS: Record<HomeworkType, string[]> = {
  research: [
    "Cubre el tema con profundidad (no superficial)",
    "Cita fuentes, CVEs o casos reales concretos",
    "Aporta análisis propio (no solo copiar/pegar)",
    "Conclusiones claras y accionables",
  ],
  practical: [
    "Cumple toda la consigna",
    "Justifica las decisiones / pasos tomados",
    "El resultado es funcional/verificable",
    "Está documentado y es reproducible",
  ],
  reflection: [
    "Es honesta y personal",
    "Identifica vectores/lecciones concretas",
    "Propone un plan de acción o mejora",
  ],
  code: [
    "El código corre y cumple su objetivo",
    "Maneja errores y casos límite",
    "Es legible y está comentado",
    "Explica cómo se usa / qué hace",
  ],
};

export function rubricFor(type: HomeworkType): string[] {
  return RUBRICS[type] ?? [];
}

// Maps the number of checked criteria to a self-grade out of `maxPts`.
export function rubricScore(checked: number, totalCriteria: number, maxPts: number): number {
  if (totalCriteria <= 0) return 0;
  const ratio = Math.max(0, Math.min(checked, totalCriteria)) / totalCriteria;
  return Math.round(ratio * maxPts);
}
