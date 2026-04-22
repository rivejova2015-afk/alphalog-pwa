import type { TickData, RegimeCode } from "@/lib/bot/signal-engine/types";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos del HMM
// ─────────────────────────────────────────────────────────────────────────────

export interface HMMModel {
  /** Matriz de transición 7×7: A[i][j] = P(estado_j | estado_i) */
  A: number[][];
  /** Medias de emisión gaussiana 7×5 (estados × features) */
  mu: number[][];
  /** Varianzas de emisión 7×5 (covarianza diagonal) */
  sigma: number[][];
  /** Distribución inicial 7 estados */
  pi: number[];
}

export interface FeatureVector {
  vol15m: number;
  vol1h: number;
  momentum5m: number;
  spreadAvg: number;
  tickVolumeRatio: number;
}

export interface ViterbiResult {
  path: RegimeCode[];
  currentRegime: RegimeCode;
  confidence: number;
  stateProbabilities: Record<RegimeCode, number>;
}

export interface RegimeClassification {
  regime: RegimeCode;
  confidence: number;
  probabilities: Record<RegimeCode, number>;
  features: FeatureVector;
  isColdStart: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de estado
// ─────────────────────────────────────────────────────────────────────────────

const STATE_NAMES: RegimeCode[] = [
  "BULL_TREND_STRONG",
  "BULL_TREND_WEAK",
  "BEAR_TREND_STRONG",
  "BEAR_TREND_WEAK",
  "SIDEWAYS_LOW_VOL",
  "SIDEWAYS_HIGH_VOL",
  "BREAKOUT_IMMINENT",
];

const N_STATES = STATE_NAMES.length; // 7
const N_FEATURES = 5; // [vol15m, vol1h, momentum5m, spreadAvg, tickVolumeRatio]

const FEATURE_KEYS: (keyof FeatureVector)[] = [
  "vol15m",
  "vol1h",
  "momentum5m",
  "spreadAvg",
  "tickVolumeRatio",
];

function featureToArray(f: FeatureVector): number[] {
  return FEATURE_KEYS.map((k) => f[k]);
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN 1 — Modelo HMM con parámetros expertos para XAUUSD
// ─────────────────────────────────────────────────────────────────────────────

export function getExpertInitialHMM(): HMMModel {
  // Medias de emisión: [vol15m, vol1h, momentum5m, spreadAvg, tickVolumeRatio]
  const mu: number[][] = [
    [0.008, 0.006, 0.0015, 0.0003, 1.4], // BULL_TREND_STRONG
    [0.005, 0.004, 0.0005, 0.0003, 1.1], // BULL_TREND_WEAK
    [0.01, 0.007, -0.0018, 0.0004, 1.5], // BEAR_TREND_STRONG
    [0.005, 0.004, -0.0006, 0.0003, 1.1], // BEAR_TREND_WEAK
    [0.002, 0.002, 0.0001, 0.0002, 0.8], // SIDEWAYS_LOW_VOL
    [0.009, 0.007, 0.0002, 0.0005, 1.3], // SIDEWAYS_HIGH_VOL
    [0.003, 0.008, 0.0003, 0.0002, 0.6], // BREAKOUT_IMMINENT
  ];

  // Varianzas de emisión (covarianza diagonal)
  const sigma: number[][] = [
    [0.003, 0.002, 0.001, 0.0001, 0.3], // BULL_TREND_STRONG
    [0.002, 0.002, 0.0005, 0.0001, 0.2], // BULL_TREND_WEAK
    [0.004, 0.003, 0.001, 0.0001, 0.3], // BEAR_TREND_STRONG
    [0.002, 0.002, 0.0005, 0.0001, 0.2], // BEAR_TREND_WEAK
    [0.001, 0.001, 0.0002, 0.00005, 0.15], // SIDEWAYS_LOW_VOL
    [0.004, 0.003, 0.0005, 0.0002, 0.25], // SIDEWAYS_HIGH_VOL
    [0.001, 0.002, 0.0003, 0.00005, 0.2], // BREAKOUT_IMMINENT
  ];

  // Matriz de transición 7×7 (cada fila suma 1)
  const A: number[][] = [
    [0.6, 0.2, 0.05, 0.05, 0.05, 0.03, 0.02], // BULL_STRONG →
    [0.2, 0.5, 0.05, 0.1, 0.1, 0.03, 0.02], // BULL_WEAK →
    [0.05, 0.05, 0.6, 0.2, 0.05, 0.03, 0.02], // BEAR_STRONG →
    [0.05, 0.1, 0.2, 0.5, 0.1, 0.03, 0.02], // BEAR_WEAK →
    [0.1, 0.1, 0.1, 0.1, 0.45, 0.1, 0.05], // SIDEWAYS_LOW →
    [0.1, 0.05, 0.1, 0.05, 0.15, 0.45, 0.1], // SIDEWAYS_HIGH →
    [0.25, 0.05, 0.2, 0.05, 0.1, 0.1, 0.25], // BREAKOUT →
  ];

  // Pi: SIDEWAYS_LOW_VOL más probable al inicio (mercado en reposo)
  const pi: number[] = [0.1, 0.15, 0.1, 0.15, 0.3, 0.15, 0.05];

  return { A, mu, sigma, pi };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN 2 — Log-probabilidad gaussiana
// ─────────────────────────────────────────────────────────────────────────────

export function gaussianLogProb(
  x: number,
  mu: number,
  sigma: number
): number {
  const safeS = Math.max(sigma, 1e-10);
  return (
    -0.5 * Math.log(2 * Math.PI * safeS) - (x - mu) ** 2 / (2 * safeS)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN 3 — Extracción de features desde ticks
// ─────────────────────────────────────────────────────────────────────────────

const NEUTRAL_FEATURES: FeatureVector = {
  vol15m: 0.003,
  vol1h: 0.003,
  momentum5m: 0,
  spreadAvg: 0.0003,
  tickVolumeRatio: 1.0,
};

function sampleVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1)
  );
}

function priceReturns(tickSlice: TickData[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < tickSlice.length; i++) {
    const prev = tickSlice[i - 1].last;
    if (prev > 0) returns.push((tickSlice[i].last - prev) / prev);
  }
  return returns;
}

export function extractFeatures(
  ticks: TickData[],
  windowMinutes = 15
): FeatureVector {
  if (ticks.length < 2) return { ...NEUTRAL_FEATURES };

  const lastTs = new Date(ticks[ticks.length - 1].timestamp).getTime();
  const ms15 = windowMinutes * 60 * 1000;
  const ms60 = 60 * 60 * 1000;
  const ms5 = 5 * 60 * 1000;

  const ticks15m = ticks.filter(
    (t) => new Date(t.timestamp).getTime() >= lastTs - ms15
  );
  const ticks1h = ticks.filter(
    (t) => new Date(t.timestamp).getTime() >= lastTs - ms60
  );
  const ticks5m = ticks.filter(
    (t) => new Date(t.timestamp).getTime() >= lastTs - ms5
  );

  // Volatilidades realizadas
  const ret15m = priceReturns(ticks15m);
  const ret1h = priceReturns(ticks1h);
  const vol15m =
    ret15m.length >= 2
      ? Math.max(0.0001, Math.sqrt(sampleVariance(ret15m)))
      : NEUTRAL_FEATURES.vol15m;
  const vol1h =
    ret1h.length >= 2
      ? Math.max(0.0001, Math.sqrt(sampleVariance(ret1h)))
      : NEUTRAL_FEATURES.vol1h;

  // Momentum 5 minutos
  const firstTick5m = ticks5m[0];
  const lastTick = ticks[ticks.length - 1];
  const momentum5m =
    firstTick5m && firstTick5m.last > 0
      ? (lastTick.last - firstTick5m.last) / firstTick5m.last
      : 0;

  // Spread promedio normalizado (últimos 100 ticks)
  const last100 = ticks.slice(-100);
  const spreadAvg =
    last100.length > 0
      ? last100.reduce(
          (a, t) => a + (t.last > 0 ? (t.ask - t.bid) / t.last : 0),
          0
        ) / last100.length
      : NEUTRAL_FEATURES.spreadAvg;

  // Ratio de volumen de ticks: vol15m / (vol1h / 4)
  const volSum15m = ticks15m.reduce((a, t) => a + t.volume, 0);
  const volSum1h = ticks1h.reduce((a, t) => a + t.volume, 0);
  const tickVolumeRatio =
    volSum1h > 0 ? volSum15m / (volSum1h / 4) : 1.0;

  return {
    vol15m,
    vol1h,
    momentum5m,
    spreadAvg: Math.max(0, spreadAvg),
    tickVolumeRatio: Math.max(0.01, tickVolumeRatio),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN 4 — Algoritmo de Viterbi en log-space
// ─────────────────────────────────────────────────────────────────────────────

export function viterbi(
  model: HMMModel,
  observations: FeatureVector[]
): ViterbiResult {
  const T = observations.length;

  // Default para observaciones vacías
  if (T === 0) {
    const uniform = 1 / N_STATES;
    const probs = Object.fromEntries(
      STATE_NAMES.map((s) => [s, uniform])
    ) as Record<RegimeCode, number>;
    return {
      path: ["SIDEWAYS_LOW_VOL"],
      currentRegime: "SIDEWAYS_LOW_VOL",
      confidence: uniform,
      stateProbabilities: probs,
    };
  }

  // Probabilidad log de emisión: suma de log-gaussianas por feature
  function emissionLP(obs: FeatureVector, j: number): number {
    const feats = featureToArray(obs);
    return feats.reduce(
      (sum, f, k) => sum + gaussianLogProb(f, model.mu[j][k], model.sigma[j][k]),
      0
    );
  }

  // dp[t][j] = log-prob máxima de llegar al estado j en t
  const dp: number[][] = Array.from({ length: T }, () =>
    new Array(N_STATES).fill(-Infinity)
  );
  const backptr: number[][] = Array.from({ length: T }, () =>
    new Array(N_STATES).fill(0)
  );

  // Inicialización t=0
  for (let j = 0; j < N_STATES; j++) {
    dp[0][j] =
      Math.log(Math.max(model.pi[j], 1e-300)) + emissionLP(observations[0], j);
  }

  // Recursión
  for (let t = 1; t < T; t++) {
    for (let j = 0; j < N_STATES; j++) {
      let maxLP = -Infinity;
      let bestPrev = 0;
      for (let i = 0; i < N_STATES; i++) {
        const candidate =
          dp[t - 1][i] + Math.log(Math.max(model.A[i][j], 1e-300));
        if (candidate > maxLP) {
          maxLP = candidate;
          bestPrev = i;
        }
      }
      dp[t][j] = maxLP + emissionLP(observations[t], j);
      backptr[t][j] = bestPrev;
    }
  }

  // Backtrack del path óptimo
  const pathIdx = new Array<number>(T);
  pathIdx[T - 1] = dp[T - 1].indexOf(Math.max(...dp[T - 1]));
  for (let t = T - 2; t >= 0; t--) {
    pathIdx[t] = backptr[t + 1][pathIdx[t + 1]];
  }

  // Softmax sobre los log-probs finales → probabilidades de estado
  const finalLPs = dp[T - 1];
  const maxLP = Math.max(...finalLPs);
  const expVals = finalLPs.map((lp) => Math.exp(lp - maxLP));
  const sumExp = expVals.reduce((a, b) => a + b, 0);
  const probs = expVals.map((e) => e / sumExp);

  const stateProbabilities = Object.fromEntries(
    STATE_NAMES.map((name, i) => [name, probs[i]])
  ) as Record<RegimeCode, number>;

  const currentStateIdx = pathIdx[T - 1];
  const currentRegime = STATE_NAMES[currentStateIdx];
  const confidence = probs[currentStateIdx];

  return {
    path: pathIdx.map((i) => STATE_NAMES[i]),
    currentRegime,
    confidence,
    stateProbabilities,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN 5 — Baum-Welch (EM) con forward-backward escalado
// ─────────────────────────────────────────────────────────────────────────────
// Implementación con escalado (Rabiner 1989) para evitar underflow.
// Solo refina si hay >= 96 observaciones (24h de ventanas de 15 min).
// No actualiza pi (mantenemos la distribución inicial experta).

export function baumWelch(
  model: HMMModel,
  observations: FeatureVector[],
  maxIter = 5
): HMMModel {
  const T = observations.length;

  if (T < 96) return model; // cold start: usar parámetros expertos

  // Clonar modelo para no mutar el original
  let A = model.A.map((row) => [...row]);
  let mu = model.mu.map((row) => [...row]);
  let sigma = model.sigma.map((row) => [...row]);
  const pi = [...model.pi]; // no se actualiza

  // Probabilidad de emisión (no log, necesaria para scaling)
  function emissionProb(obs: FeatureVector, j: number): number {
    const feats = featureToArray(obs);
    // Exponenciar la suma de log-gaussianas
    const logP = feats.reduce(
      (s, f, k) => s + gaussianLogProb(f, mu[j][k], sigma[j][k]),
      0
    );
    return Math.exp(logP);
  }

  for (let iter = 0; iter < maxIter; iter++) {
    // ── Forward escalado ──────────────────────────────────────────────────
    const alpha: number[][] = Array.from({ length: T }, () =>
      new Array(N_STATES).fill(0)
    );
    const c: number[] = new Array(T).fill(0);

    // t=0
    for (let j = 0; j < N_STATES; j++) {
      alpha[0][j] = pi[j] * emissionProb(observations[0], j);
    }
    c[0] = alpha[0].reduce((a, b) => a + b, 0);
    if (c[0] < 1e-300) c[0] = 1e-300;
    for (let j = 0; j < N_STATES; j++) alpha[0][j] /= c[0];

    // t>0
    for (let t = 1; t < T; t++) {
      for (let j = 0; j < N_STATES; j++) {
        let sum = 0;
        for (let i = 0; i < N_STATES; i++) sum += alpha[t - 1][i] * A[i][j];
        alpha[t][j] = sum * emissionProb(observations[t], j);
      }
      c[t] = alpha[t].reduce((a, b) => a + b, 0);
      if (c[t] < 1e-300) c[t] = 1e-300;
      for (let j = 0; j < N_STATES; j++) alpha[t][j] /= c[t];
    }

    // ── Backward escalado ────────────────────────────────────────────────
    const beta: number[][] = Array.from({ length: T }, () =>
      new Array(N_STATES).fill(0)
    );

    // t=T-1: inicializar con 1/c[T-1]
    for (let j = 0; j < N_STATES; j++) beta[T - 1][j] = 1 / c[T - 1];

    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < N_STATES; i++) {
        let sum = 0;
        for (let k = 0; k < N_STATES; k++) {
          sum += A[i][k] * emissionProb(observations[t + 1], k) * beta[t + 1][k];
        }
        beta[t][i] = sum / c[t];
      }
    }

    // ── E-step: γ y ξ ────────────────────────────────────────────────────

    // gamma[t][j] = P(q_t=j | obs, λ)
    const gamma: number[][] = Array.from({ length: T }, () =>
      new Array(N_STATES).fill(0)
    );
    for (let t = 0; t < T; t++) {
      let denom = 0;
      for (let j = 0; j < N_STATES; j++) {
        gamma[t][j] = alpha[t][j] * beta[t][j];
        denom += gamma[t][j];
      }
      if (denom > 0) {
        for (let j = 0; j < N_STATES; j++) gamma[t][j] /= denom;
      }
    }

    // xi[t][i][j] = P(q_t=i, q_{t+1}=j | obs, λ), para t < T-1
    const xi: number[][][] = Array.from({ length: T - 1 }, () =>
      Array.from({ length: N_STATES }, () => new Array(N_STATES).fill(0))
    );
    for (let t = 0; t < T - 1; t++) {
      let denom = 0;
      for (let i = 0; i < N_STATES; i++) {
        for (let j = 0; j < N_STATES; j++) {
          xi[t][i][j] =
            alpha[t][i] *
            A[i][j] *
            emissionProb(observations[t + 1], j) *
            beta[t + 1][j];
          denom += xi[t][i][j];
        }
      }
      if (denom > 0) {
        for (let i = 0; i < N_STATES; i++) {
          for (let j = 0; j < N_STATES; j++) xi[t][i][j] /= denom;
        }
      }
    }

    // ── M-step: re-estimar A, mu, sigma ─────────────────────────────────

    // Actualizar A[i][j]
    const newA = A.map((row) => [...row]);
    for (let i = 0; i < N_STATES; i++) {
      const sumGammaI = gamma.slice(0, T - 1).reduce((a, g) => a + g[i], 0);
      for (let j = 0; j < N_STATES; j++) {
        const sumXi = xi.reduce((a, x) => a + x[i][j], 0);
        newA[i][j] = sumGammaI > 0 ? sumXi / sumGammaI : A[i][j];
      }
      // Normalizar fila para que sume 1
      const rowSum = newA[i].reduce((a, b) => a + b, 0);
      if (rowSum > 0) {
        for (let j = 0; j < N_STATES; j++) newA[i][j] /= rowSum;
      }
    }

    // Actualizar mu[j][k] y sigma[j][k]
    const newMu = mu.map((row) => [...row]);
    const newSigma = sigma.map((row) => [...row]);

    for (let j = 0; j < N_STATES; j++) {
      const sumGamma = gamma.reduce((a, g) => a + g[j], 0);
      if (sumGamma < 1e-10) continue; // estado no visitado, conservar params

      for (let k = 0; k < N_FEATURES; k++) {
        const feats = observations.map((o) => featureToArray(o)[k]);

        // Nueva media
        const newMuJK =
          feats.reduce((a, f, t) => a + gamma[t][j] * f, 0) / sumGamma;
        newMu[j][k] = newMuJK;

        // Nueva varianza
        const newSigmaJK =
          feats.reduce(
            (a, f, t) => a + gamma[t][j] * (f - newMuJK) ** 2,
            0
          ) / sumGamma;
        // Clamp: no colapsar a 0
        newSigma[j][k] = Math.max(0.00001, newSigmaJK);
      }
    }

    A = newA;
    mu = newMu;
    sigma = newSigma;
  }

  return { A, mu, sigma, pi };
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN 6 — Clasificación de régimen (entry point principal)
// ─────────────────────────────────────────────────────────────────────────────

export function classifyRegime(
  ticks: TickData[],
  storedModel?: HMMModel
): RegimeClassification {
  const isColdStart = !storedModel;
  const model = storedModel ?? getExpertInitialHMM();

  const features = extractFeatures(ticks);

  // Ventana deslizante: últimas 10 observaciones de features (cada 15 min → 2.5h de contexto)
  // Si no hay suficientes ticks para 10 ventanas, usar la feature actual como única observación
  const WINDOW_SIZE = 10;
  const observations: FeatureVector[] = [];

  if (ticks.length >= 2) {
    // Construir observaciones en ventanas solapadas de los ticks disponibles
    const segmentSize = Math.max(1, Math.floor(ticks.length / WINDOW_SIZE));
    for (let w = 0; w < WINDOW_SIZE; w++) {
      const start = w * segmentSize;
      const end = Math.min(start + segmentSize + 1, ticks.length);
      const segment = ticks.slice(start, end);
      if (segment.length >= 2) {
        observations.push(extractFeatures(segment));
      }
    }
  }

  if (observations.length === 0) observations.push(features);

  const result = viterbi(model, observations);

  return {
    regime: result.currentRegime,
    confidence: result.confidence,
    probabilities: result.stateProbabilities,
    features,
    isColdStart,
  };
}
