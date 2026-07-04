// Perfil de volumen intradiario para VWAP — antes de este módulo, planVwap
// siempre caía a distribución uniforme (TWAP) porque nadie le pasaba un
// volumeProfile real. Construye una forma "típica" del día promediando
// volumen por hora UTC across N días de barras históricas.

import type { Bar } from "@/types/backtest";

const HOURS_IN_DAY = 24;

/**
 * Promedia el volumen de cada hora UTC (0-23) across todas las barras
 * provistas. El resultado es la forma típica de la sesión — ej. más volumen
 * cerca del open/close, menos en las horas muertas. Bucket sin barras → 0.
 */
export function buildHourlyVolumeProfile(bars: Bar[]): number[] {
  const sums = new Array(HOURS_IN_DAY).fill(0);
  const counts = new Array(HOURS_IN_DAY).fill(0);
  for (const bar of bars) {
    const hour = new Date(bar.ts).getUTCHours();
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
    sums[hour] += bar.volume;
    counts[hour] += 1;
  }
  return sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
}

/**
 * Mapea el perfil horario (24 buckets) a `sliceCount` pesos, uno por cada
 * slice de un plan TWAP/VWAP que arranca en `startAt` y dura
 * `durationMinutes` — cada slice hereda el peso promedio de la hora UTC en
 * la que cae su propio timestamp programado.
 */
export function sliceWeightsFromHourlyProfile(
  hourlyProfile: number[],
  sliceCount: number,
  durationMinutes: number,
  startAt: Date,
): number[] {
  if (sliceCount < 1) return [];
  const intervalMs = sliceCount > 1 ? (durationMinutes * 60 * 1000) / (sliceCount - 1) : 0;
  const weights: number[] = [];
  for (let i = 0; i < sliceCount; i++) {
    const ts = new Date(startAt.getTime() + i * intervalMs);
    const hour = ts.getUTCHours();
    weights.push(hourlyProfile[hour] ?? 0);
  }
  return weights;
}
