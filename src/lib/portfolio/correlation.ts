// Helpers para matrices de correlación entre series de retornos.
// Base matemática del Portfolio HRP (Hierarchical Risk Parity, López de Prado 2016).

export type Matrix = number[][];

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

/** Correlación Pearson entre dos series. */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va === 0 || vb === 0) return 0;
  return cov / Math.sqrt(va * vb);
}

/** Matriz de correlación KxK donde K = número de series. Series desigualmente
 *  largas se truncan al min. */
export function correlationMatrix(series: number[][]): Matrix {
  const k = series.length;
  const m: Matrix = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    m[i][i] = 1;
    for (let j = i + 1; j < k; j++) {
      const c = pearson(series[i], series[j]);
      m[i][j] = c;
      m[j][i] = c;
    }
  }
  return m;
}

/** Matriz de distancia HRP (López de Prado 2016, ec. 1).
 *  d(i,j) = sqrt(0.5 * (1 - corr(i,j))). En [0, 1]. */
export function correlationDistance(corr: Matrix): Matrix {
  const k = corr.length;
  const d: Matrix = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      d[i][j] = Math.sqrt(0.5 * (1 - corr[i][j]));
    }
  }
  return d;
}

/** Vector de desviaciones estándar de cada serie (anualizables con sqrt(periods)).
 *  Necesario para HRP recursive bisection (inverse-variance weighting). */
export function stdVector(series: number[][]): number[] {
  return series.map((s) => stdev(s));
}
