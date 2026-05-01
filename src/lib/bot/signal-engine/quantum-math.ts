import type {
  Complex,
  HestonParams,
  QuantumState,
  WalkResult,
  AmplitudeResult,
  CombinedSignal,
  TickData,
  RegimeCode,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// MODELO A — Hamiltoniano de Heston (formulación cuántica discreta)
// ─────────────────────────────────────────────────────────────────────────────
// Discretizamos el operador de Heston sobre una grilla 20×20 en espacio (S, v).
// Inicializamos un paquete de onda gaussiano centrado en (S_actual, v_actual).
// La energía E = <ψ|H|ψ> cuantifica la "tensión" del precio:
//   alta energía → movimiento inminente probable.
export function hestonHamiltonianState(
  S: number,
  v: number,
  params: HestonParams
): QuantumState {
  const GRID_N = 20;
  // 5-minute window en años para XAUUSD
  const T_YEARS = 5 / (365 * 24 * 60);

  const sigmaS = Math.sqrt(Math.max(v, 1e-6) * T_YEARS) * S;
  const sigmaV = params.sigma * Math.sqrt(Math.max(v, 1e-6) * T_YEARS);

  // Grilla centrada en el punto actual
  const sMin = S - 3 * sigmaS;
  const sMax = S + 3 * sigmaS;
  const vMin = Math.max(1e-6, v - 3 * sigmaV);
  const vMax = v + 3 * sigmaV;

  const dS = (sMax - sMin) / (GRID_N - 1);
  const dV = (vMax - vMin) / (GRID_N - 1);

  const psi: Complex[] = [];
  const wavefunction: number[] = [];
  let norm2 = 0;

  // Paquete gaussiano centrado en (S, v)
  for (let i = 0; i < GRID_N; i++) {
    for (let j = 0; j < GRID_N; j++) {
      const si = sMin + i * dS;
      const vj = vMin + j * dV;
      const amp =
        Math.exp(-0.5 * ((si - S) / sigmaS) ** 2) *
        Math.exp(-0.5 * ((vj - v) / sigmaV) ** 2);
      psi.push({ re: amp, im: 0 });
      norm2 += amp * amp;
    }
  }

  const norm = Math.sqrt(norm2) || 1;
  for (let k = 0; k < psi.length; k++) {
    psi[k].re /= norm;
    wavefunction.push(psi[k].re * psi[k].re);
  }

  // E = <ψ|H|ψ> con diferencias finitas sobre el operador de Heston
  // H = -½v S²∂²/∂S² - ρσv S ∂²/∂S∂v - ½σ²v ∂²/∂v² + κ(θ-v)∂/∂v
  let energy = 0;

  for (let i = 1; i < GRID_N - 1; i++) {
    for (let j = 1; j < GRID_N - 1; j++) {
      const si = sMin + i * dS;
      const vj = vMin + j * dV;
      const idx = (pos_i: number, pos_j: number) =>
        pos_i * GRID_N + pos_j;

      const ψ_ij = psi[idx(i, j)].re;
      const ψ_ip = psi[idx(i + 1, j)].re;
      const ψ_im = psi[idx(i - 1, j)].re;
      const ψ_jp = psi[idx(i, j + 1)].re;
      const ψ_jm = psi[idx(i, j - 1)].re;
      const ψ_ipjp = psi[idx(i + 1, j + 1)].re;

      const d2ψ_dS2 = (ψ_ip - 2 * ψ_ij + ψ_im) / (dS * dS);
      const d2ψ_dV2 = (ψ_jp - 2 * ψ_ij + ψ_jm) / (dV * dV);
      // Aproximación cruzada centrada (esquina)
      const d2ψ_dSdV = (ψ_ipjp - ψ_ip - ψ_jp + ψ_ij) / (dS * dV);
      const dψ_dV = (ψ_jp - ψ_jm) / (2 * dV);

      const H_ψ =
        -0.5 * vj * si * si * d2ψ_dS2 -
        params.rho * params.sigma * vj * si * d2ψ_dSdV -
        0.5 * params.sigma * params.sigma * vj * d2ψ_dV2 +
        params.kappa * (params.theta - vj) * dψ_dV;

      energy += ψ_ij * H_ψ * dS * dV;
    }
  }

  return { psi, energy, wavefunction };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELO B — Quantum Walk con operador moneda de Hadamard
// ─────────────────────────────────────────────────────────────────────────────
// Lattice de 100 posiciones. Coin state = [↑, ↓] (alcista/bajista).
// Turno: aplicar H_coin → shift espacial.
// La distribución resultante determina la dirección esperada del precio.
export function quantumWalk(priceHistory: number[], steps: number): WalkResult {
  if (priceHistory.length < 2) {
    return {
      probabilityDistribution: new Array(100).fill(1 / 100),
      expectedMove: 0,
      variance: 0,
      bullBias: 0,
    };
  }

  const N = 100;
  const CENTER = N / 2;
  const H_FACTOR = 1 / Math.sqrt(2); // factor de Hadamard

  const minP = Math.min(...priceHistory);
  const maxP = Math.max(...priceHistory);
  const priceRange = maxP - minP || 1;

  // Posición inicial en el lattice
  const normCurrent =
    (priceHistory[priceHistory.length - 1] - minP) / priceRange;
  const startPos = Math.min(N - 1, Math.max(0, Math.round(normCurrent * (N - 1))));

  // Momentum reciente para sesgar el estado inicial de la moneda
  const recentMomentum =
    (priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceRange;
  const thetaCoin = Math.PI / 4 + (recentMomentum * Math.PI) / 4;

  // Estado de la moneda inicial: [cos θ, sin θ] → sesgado por momentum
  // Amplitudes espaciales: psi_up[pos] y psi_down[pos] (componentes real e imaginaria)
  const upRe = new Float64Array(N);
  const upIm = new Float64Array(N);
  const downRe = new Float64Array(N);
  const downIm = new Float64Array(N);

  upRe[startPos] = Math.cos(thetaCoin);
  downRe[startPos] = Math.sin(thetaCoin);

  const maxSteps = Math.min(steps, 40); // techo para mantener O(N·steps) manejable

  for (let s = 0; s < maxSteps; s++) {
    const nUpRe = new Float64Array(N);
    const nUpIm = new Float64Array(N);
    const nDownRe = new Float64Array(N);
    const nDownIm = new Float64Array(N);

    for (let pos = 0; pos < N; pos++) {
      // Aplicar moneda de Hadamard en (pos):
      // |↑'⟩ = H_FACTOR*(|↑⟩ + |↓⟩)   → shift +1
      // |↓'⟩ = H_FACTOR*(|↑⟩ - |↓⟩)   → shift -1
      const coinedUpRe = H_FACTOR * (upRe[pos] + downRe[pos]);
      const coinedUpIm = H_FACTOR * (upIm[pos] + downIm[pos]);
      const coinedDownRe = H_FACTOR * (upRe[pos] - downRe[pos]);
      const coinedDownIm = H_FACTOR * (upIm[pos] - downIm[pos]);

      if (pos + 1 < N) {
        nUpRe[pos + 1] += coinedUpRe;
        nUpIm[pos + 1] += coinedUpIm;
      }
      if (pos - 1 >= 0) {
        nDownRe[pos - 1] += coinedDownRe;
        nDownIm[pos - 1] += coinedDownIm;
      }
    }

    upRe.set(nUpRe);
    upIm.set(nUpIm);
    downRe.set(nDownRe);
    downIm.set(nDownIm);
  }

  // Distribución de probabilidad |ψ|²
  const prob = new Array<number>(N);
  let totalProb = 0;
  for (let pos = 0; pos < N; pos++) {
    prob[pos] =
      upRe[pos] ** 2 + upIm[pos] ** 2 + downRe[pos] ** 2 + downIm[pos] ** 2;
    totalProb += prob[pos];
  }
  if (totalProb > 0) {
    for (let pos = 0; pos < N; pos++) prob[pos] /= totalProb;
  }

  // Momentos: E[x] y Var[x] en coordenadas del lattice (centradas)
  let expectedPos = 0;
  let secondMoment = 0;
  for (let pos = 0; pos < N; pos++) {
    const x = pos - CENTER;
    expectedPos += x * prob[pos];
    secondMoment += x * x * prob[pos];
  }
  const variance = secondMoment - expectedPos ** 2;

  // Movimiento esperado en USD (escalar al rango de precios)
  const expectedMove = (expectedPos / CENTER) * priceRange * 0.01;

  // Bull bias: masa de probabilidad encima del centro vs debajo
  let above = 0;
  let below = 0;
  for (let pos = 0; pos < N; pos++) {
    if (pos > CENTER) above += prob[pos];
    else if (pos < CENTER) below += prob[pos];
  }
  const total = above + below + 1e-9;
  const bullBias = Math.max(-1, Math.min(1, (above - below) / total));

  return { probabilityDistribution: prob, expectedMove, variance, bullBias };
}

// ─────────────────────────────────────────────────────────────────────────────
// MODELO C — Amplitudes de Probabilidad Cuántica
// ─────────────────────────────────────────────────────────────────────────────
// Superposición |ψ⟩ = α|bull⟩ + β|bear⟩ + γ|neutral⟩
// Invariante: |α|² + |β|² + |γ|² = 1
// Se usan: momentum del precio, presión bid/ask, tendencia de volumen.
export function quantumAmplitudes(
  bidAskSpread: number,
  tickVolume: number,
  recentTicks: TickData[]
): AmplitudeResult {
  if (recentTicks.length === 0) {
    const amp = 1 / Math.sqrt(3);
    return {
      signal: "NEUTRAL",
      confidence: 1 / 3,
      amplitudes: { bull: amp, bear: amp, neutral: amp },
    };
  }

  const n = recentTicks.length;
  const firstPrice = recentTicks[0].last;
  const lastPrice = recentTicks[n - 1].last;
  const safeFirst = firstPrice || 1;

  // Momentum normalizado: positivo → alcista
  const momentum = (lastPrice - firstPrice) / safeFirst;

  // Tendencia de volumen: segunda mitad vs primera mitad
  const half = Math.floor(n / 2);
  const volFirst = recentTicks
    .slice(0, half)
    .reduce((a, t) => a + t.volume, 0);
  const volSecond = recentTicks.slice(half).reduce((a, t) => a + t.volume, 0);
  const volumeTrend = volSecond > volFirst ? 0.1 : -0.1;

  // Presión bid/ask: precio último vs midpoint
  const safeSpread = bidAskSpread || 0.01;
  const lastBid = recentTicks[n - 1].bid;
  const lastAsk = recentTicks[n - 1].ask;
  const midpoint = (lastBid + lastAsk) / 2;
  const bidPressure = (lastPrice - midpoint) / safeSpread;

  // Amplitudes (pre-normalización): valores positivos
  let bullAmp = Math.max(
    0.01,
    0.5 + momentum * 5 + bidPressure * 0.3 + (volumeTrend > 0 ? volumeTrend : 0)
  );
  let bearAmp = Math.max(
    0.01,
    0.5 - momentum * 5 - bidPressure * 0.3 + (volumeTrend < 0 ? -volumeTrend : 0)
  );
  // Spread alto → mayor incertidumbre → componente neutral más fuerte
  const spreadUncertainty = Math.min(1, safeSpread / 2);
  let neutralAmp = Math.max(
    0.01,
    0.3 + spreadUncertainty * 0.5 - Math.abs(momentum) * 3
  );

  // Normalizar: |α|² + |β|² + |γ|² = 1
  const norm = Math.sqrt(bullAmp ** 2 + bearAmp ** 2 + neutralAmp ** 2);
  bullAmp /= norm;
  bearAmp /= norm;
  neutralAmp /= norm;

  const bullProb = bullAmp ** 2;
  const bearProb = bearAmp ** 2;
  const neutralProb = neutralAmp ** 2;

  let signal: "BUY" | "SELL" | "NEUTRAL";
  let confidence: number;

  if (bullProb >= bearProb && bullProb >= neutralProb) {
    signal = "BUY";
    confidence = bullProb;
  } else if (bearProb > bullProb && bearProb >= neutralProb) {
    signal = "SELL";
    confidence = bearProb;
  } else {
    signal = "NEUTRAL";
    confidence = neutralProb;
  }

  // Suprimir señal si tickVolume es anormalmente bajo (mercado inactivo)
  if (tickVolume < 1) {
    signal = "NEUTRAL";
    confidence = neutralProb;
  }

  return {
    signal,
    confidence,
    amplitudes: { bull: bullAmp, bear: bearAmp, neutral: neutralAmp },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÑAL COMBINADA
// ─────────────────────────────────────────────────────────────────────────────
// Fusiona los tres modelos cuánticos y aplica el umbral de confianza por régimen.
// Sólo genera acción si todas las fuentes apuntan en la misma dirección
// y la confianza supera el umbral adaptativo.
export function combineQuantumSignals(
  walk: WalkResult,
  amplitude: AmplitudeResult,
  hamiltonian: QuantumState,
  regime: RegimeCode
): CombinedSignal {
  // Umbral adaptativo por régimen
  let threshold = 0.62;
  if (regime === "SIDEWAYS_LOW_VOL" || regime === "SIDEWAYS_HIGH_VOL") {
    threshold = 0.75;
  } else if (
    regime === "BULL_TREND_STRONG" ||
    regime === "BEAR_TREND_STRONG"
  ) {
    threshold = 0.55;
  }

  // Factor de energía hamiltoniana: alta energía → más tensión → boost de confianza
  // Normalizamos con tanh para mantener en [0, 1]
  const energyFactor = Math.tanh(Math.abs(hamiltonian.energy) * 1e-5);

  // Dirección del walk: +1 alcista, -1 bajista
  const walkDir = walk.bullBias; // ya en [-1, 1]

  // Dirección de la amplitud: +1 BUY, -1 SELL, 0 NEUTRAL
  const ampDir =
    amplitude.signal === "BUY" ? 1 : amplitude.signal === "SELL" ? -1 : 0;

  // Alineación: ambos modelos apuntan igual → alta puntuación
  const alignment = walkDir * ampDir; // [-1, 1]

  // Confianza combinada: peso en amplitudes + bono de alineación + energía
  const confidence = Math.min(
    1,
    Math.max(
      0,
      amplitude.confidence * (0.6 + 0.25 * Math.max(0, alignment) + 0.15 * energyFactor)
    )
  );

  // Acción: requiere alineación positiva (walk y amplitude coinciden) y umbral superado
  let action: "BUY" | "SELL" | "SKIP" = "SKIP";

  if (confidence >= threshold) {
    const walkBullish = walkDir > -0.15;
    const walkBearish = walkDir < 0.15;

    if (amplitude.signal === "BUY" && walkBullish) {
      // En tendencia bajista fuerte, ignorar señales de compra débiles
      if (regime !== "BEAR_TREND_STRONG" || confidence >= 0.72) {
        action = "BUY";
      }
    } else if (amplitude.signal === "SELL" && walkBearish) {
      if (regime !== "BULL_TREND_STRONG" || confidence >= 0.72) {
        action = "SELL";
      }
    }
  }

  const signalId = `sig_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  return {
    action,
    confidence,
    expectedMove: walk.expectedMove,
    signalId,
  };
}
