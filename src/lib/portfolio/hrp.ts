// Hierarchical Risk Parity (López de Prado 2016) — versión skeleton.
//
// Output: pesos w_1..w_K que asignan capital entre K estrategias minimizando
// concentración de riesgo. Algoritmo simplificado en 3 fases:
//
//   1. Tree clustering (single-linkage sobre correlationDistance).
//   2. Quasi-diagonalization: reordenar la matriz de covarianza para que
//      activos similares queden contiguos.
//   3. Recursive bisection: dividir el portfolio en dos mitades alineadas con
//      el cluster tree, asignando peso inverso a la varianza dentro de cada
//      mitad.
//
// **Esto es el SKELETON math-only**. La integración con `algorithms` table,
// cron de rebalance, y persistencia en `portfolio_allocations` queda como
// trabajo de la sesión P1 completa.

import { correlationMatrix, correlationDistance, stdVector } from "./correlation";

export interface HrpInput {
  /** K series de retornos. Cada series[i] es la serie histórica del algo i. */
  series: number[][];
  /** Labels de las series (para mapear back al output). */
  labels?: string[];
}

export interface HrpAllocation {
  label: string;
  weight: number;
}

/** Single-linkage clustering: emparejado iterativo por mínima distancia.
 *  Devuelve el orden quasi-diagonalizado de los índices. */
function quasiDiagOrder(dist: number[][]): number[] {
  const n = dist.length;
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);

  // Lista de clusters; cada uno es un array de índices originales.
  let clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);

  while (clusters.length > 1) {
    // Encontrar el par con mínima distancia entre cualquier elemento.
    let minD = Infinity;
    let bestA = 0;
    let bestB = 1;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        for (const a of clusters[i]) {
          for (const b of clusters[j]) {
            if (dist[a][b] < minD) {
              minD = dist[a][b];
              bestA = i;
              bestB = j;
            }
          }
        }
      }
    }
    // Mergear bestB en bestA.
    const merged = [...clusters[bestA], ...clusters[bestB]];
    clusters = clusters.filter((_, i) => i !== bestA && i !== bestB);
    clusters.push(merged);
  }

  return clusters[0];
}

/** Inverse-variance portfolio (IVP) sobre un subset de índices. */
function ivpWeights(stds: number[], indices: number[]): number[] {
  const invVars = indices.map((i) => 1 / (stds[i] * stds[i] + 1e-12));
  const sum = invVars.reduce((a, b) => a + b, 0);
  return invVars.map((iv) => iv / sum);
}

/** Recursive bisection: divide el cluster en 2 mitades, asigna peso por
 *  inverse variance, y aplica recursivamente. */
function recursiveBisection(order: number[], stds: number[]): Map<number, number> {
  const weights = new Map<number, number>();
  for (const i of order) weights.set(i, 1);

  const stack: number[][] = [order];
  while (stack.length > 0) {
    const subset = stack.pop()!;
    if (subset.length <= 1) continue;
    const mid = Math.floor(subset.length / 2);
    const left = subset.slice(0, mid);
    const right = subset.slice(mid);

    const leftIvp = ivpWeights(stds, left);
    const rightIvp = ivpWeights(stds, right);
    const leftVar = left.reduce(
      (s, idx, k) => s + leftIvp[k] * leftIvp[k] * stds[idx] * stds[idx],
      0,
    );
    const rightVar = right.reduce(
      (s, idx, k) => s + rightIvp[k] * rightIvp[k] * stds[idx] * stds[idx],
      0,
    );
    const alpha = 1 - leftVar / (leftVar + rightVar + 1e-12);
    for (const idx of left) weights.set(idx, (weights.get(idx) ?? 1) * alpha);
    for (const idx of right) weights.set(idx, (weights.get(idx) ?? 1) * (1 - alpha));

    stack.push(left);
    stack.push(right);
  }

  return weights;
}

/** HRP allocator — entrega pesos normalizados que suman 1. */
export function hrpAllocate(input: HrpInput): HrpAllocation[] {
  const { series } = input;
  const k = series.length;
  if (k === 0) return [];
  if (k === 1) return [{ label: input.labels?.[0] ?? "0", weight: 1 }];

  const corr = correlationMatrix(series);
  const dist = correlationDistance(corr);
  const stds = stdVector(series);
  const order = quasiDiagOrder(dist);
  const weights = recursiveBisection(order, stds);

  // Normalizar a suma 1.
  let sum = 0;
  for (const v of weights.values()) sum += v;

  const labels = input.labels ?? Array.from({ length: k }, (_, i) => String(i));
  const result: HrpAllocation[] = [];
  for (let i = 0; i < k; i++) {
    result.push({
      label: labels[i],
      weight: (weights.get(i) ?? 0) / (sum || 1),
    });
  }
  return result;
}
